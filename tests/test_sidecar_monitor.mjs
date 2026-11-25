import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  buildMonitorHtml,
  createMonitorStore,
  resolveCodexBin,
  resolvePaths,
} from '../sidecars/codex_monitor/monitor_store.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDECAR_DIR = resolve(HERE, '..', 'sidecars', 'codex_monitor');

function makeMockCanvas(w, h) {
  let fillOps = 0;
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    scale() {},
    translate() {},
    clearRect() {},
    fillRect() {
      fillOps += 1;
    },
    strokeRect() {},
    fillText() {},
    measureText(s) {
      return { width: String(s).length * 6 };
    },
  };
  return {
    width: w,
    height: h,
    clientWidth: w,
    style: {},
    getContext() {
      return ctx;
    },
    getFillOps() {
      return fillOps;
    },
  };
}

function loadClassicSprites(sandboxOverrides = {}) {
  const spritesCode = readFileSync(join(SIDECAR_DIR, 'sprites.js'), 'utf8');
  const ctx = {
    window: { devicePixelRatio: 1 },
    Math,
    ...sandboxOverrides,
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(spritesCode, ctx, { filename: 'sprites.js' });
  return { CodexSprites: ctx.CodexSprites, context: ctx };
}

function makeFakeCodexEnv(rootDir) {
  const codexHome = join(rootDir, 'codex_home');
  mkdirSync(join(codexHome, 'sessions'), { recursive: true });
  writeFileSync(
    join(codexHome, 'config.toml'),
    'model = "gpt-6.2-sol"\nmodel_reasoning_effort = "high"\nmodel_provider = "custom"\n',
    'utf8'
  );
  return { codexHome };
}

test('resolvePaths derives brainDir and pluginDataDir from ANTIGRAVITY_EXECUTABLE_DATA_DIR', () => {
  const paths = resolvePaths({
    ANTIGRAVITY_EXECUTABLE_DATA_DIR: '/tmp/appData/sidecar_data/codex-bridge/codex_monitor/data',
  });
  assert.equal(paths.appDataDir, '/tmp/appData');
  assert.equal(paths.brainDir, '/tmp/appData/brain');
  assert.equal(paths.pluginDataDir, '/tmp/appData/plugin_data/codex-bridge');
  assert.equal(paths.tasksDir, '/tmp/appData/plugin_data/codex-bridge/tasks');
});

test('resolveCodexBin skips .sandbox-bin shim when Windows Desktop CODEX_CLI_PATH exists', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-bin-resolve-'));
  try {
    const codexHome = join(root, '.codex');
    const sandboxDir = join(codexHome, '.sandbox-bin');
    const desktopDir = join(root, 'WindowsApps', 'OpenAI.Codex_26', 'app', 'resources');
    mkdirSync(sandboxDir, { recursive: true });
    mkdirSync(desktopDir, { recursive: true });
    const shimBin = join(sandboxDir, 'codex.exe');
    const desktopBin = join(desktopDir, 'codex.exe');
    writeFileSync(shimBin, '', 'utf8');
    writeFileSync(desktopBin, '', 'utf8');
    writeFileSync(join(codexHome, 'config.toml'), `CODEX_CLI_PATH = '${desktopBin}'\n`, 'utf8');

    const resolved = resolveCodexBin({
      PATH: sandboxDir,
      CODEX_HOME: codexHome,
    });
    assert.equal(resolved, desktopBin);

    const resolvedFromOverride = resolveCodexBin({
      CODEX_BIN: shimBin,
      CODEX_HOME: codexHome,
    });
    assert.equal(resolvedFromOverride, desktopBin);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('per-conversation isolation, subagent tree inheritance, historical backfill, and scoped clear', async () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-monitor-test-'));
  try {
    const appData = join(root, 'app_data');
    const brainDir = join(appData, 'brain');
    const dataDir = join(appData, 'plugin_data', 'codex-bridge');
    const tasksDir = join(dataDir, 'tasks');
    mkdirSync(tasksDir, { recursive: true });
    const { codexHome } = makeFakeCodexEnv(root);

    const convA = '11111111-1111-1111-1111-111111111111';
    const convSub = '33333333-3333-3333-3333-333333333333';
    const convB = '22222222-2222-2222-2222-222222222222';

    // Conv A transcript spawns subagent convSub and references legacy task_deadbeef1234
    const logsA = join(brainDir, convA, '.system_generated', 'logs');
    mkdirSync(logsA, { recursive: true });
    writeFileSync(
      join(logsA, 'transcript.jsonl'),
      [
        JSON.stringify({
          type: 'GENERIC',
          content: `{"spec":{"typeName":"codex-worker"},"result":{"conversationId":"${convSub}"}}`,
        }),
        JSON.stringify({
          type: 'GENERIC',
          content: '{"task_id":"task_deadbeef1234","status":"completed"}',
        }),
      ].join('\n') + '\n',
      'utf8'
    );

    const logsB = join(brainDir, convB, '.system_generated', 'logs');
    mkdirSync(logsB, { recursive: true });
    writeFileSync(join(logsB, 'transcript.jsonl'), JSON.stringify({ type: 'USER_INPUT', content: 'hi' }) + '\n', 'utf8');

    // Task 1: belongs directly to convA (completed)
    writeFileSync(
      join(tasksDir, 'task_aaaa11112222.json'),
      JSON.stringify({
        task_id: 'task_aaaa11112222',
        status: 'completed',
        activity: 'completed',
        mode: 'exec',
        conversation_id: convA,
        model: 'gpt-6.2-sol',
        reasoning_effort: 'high',
        elapsed_ms: 4000,
        started_at: 1000,
        finished_at: 1004,
        usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, total_tokens: 120 },
      }),
      'utf8'
    );

    // Task 2: spawned by subagent convSub (running under current process PID so dead-PID check keeps it running!)
    writeFileSync(
      join(tasksDir, 'task_bbbb11112222.json'),
      JSON.stringify({
        task_id: 'task_bbbb11112222',
        status: 'running',
        activity: 'coding',
        mode: 'exec',
        conversation_id: convSub,
        model: 'gpt-6.1-sol',
        reasoning_effort: 'xhigh',
        pid: process.pid,
        owner_pid: process.pid,
        elapsed_ms: 1500,
        started_at: Date.now() / 1000 - 1.5,
      }),
      'utf8'
    );

    // Task 3: legacy historical task without conversation_id, referenced in convA's transcript
    writeFileSync(
      join(tasksDir, 'task_deadbeef1234.json'),
      JSON.stringify({
        task_id: 'task_deadbeef1234',
        status: 'completed',
        activity: 'completed',
        mode: 'plan',
        model: 'gpt-6-astra',
        reasoning_effort: 'medium',
        elapsed_ms: 2000,
        started_at: 900,
        finished_at: 902,
        usage: { input_tokens: 200, output_tokens: 50, total_tokens: 250 },
      }),
      'utf8'
    );

    // Task 4: belongs exclusively to convB
    writeFileSync(
      join(tasksDir, 'task_cccc11112222.json'),
      JSON.stringify({
        task_id: 'task_cccc11112222',
        status: 'completed',
        activity: 'completed',
        mode: 'review',
        conversation_id: convB,
        model: 'gpt-6.2-sol',
        reasoning_effort: 'low',
        elapsed_ms: 3000,
        started_at: 1010,
        finished_at: 1013,
        usage: { input_tokens: 500, output_tokens: 100, total_tokens: 600 },
      }),
      'utf8'
    );

    const store = createMonitorStore({
      ANTIGRAVITY_EXECUTABLE_DATA_DIR: join(appData, 'sidecar_data', 'codex-bridge', 'codex_monitor', 'data'),
      CODEX_HOME: codexHome,
      CODEX_BIN: '/nonexistent/codex-bin',
    });

    // No conversationId -> empty safe state
    const emptySnap = await store.getSnapshot({ conversationId: '', scope: 'conversation' });
    assert.equal(emptySnap.has_conversation, false);
    assert.equal(emptySnap.workers.length, 0);
    assert.equal(emptySnap.stats.total_workers, 0);

    // Conv A sees direct task + subagent running task + historical transcript task, NEVER convB
    const snapA = await store.getSnapshot({ conversationId: convA, scope: 'conversation' });
    assert.equal(snapA.has_conversation, true);
    assert.equal(snapA.subagent_count, 1);
    assert.equal(snapA.stats.total_workers, 3);
    assert.equal(snapA.stats.running_count, 1);
    assert.equal(snapA.stats.completed_count, 2);
    assert.equal(snapA.stats.tokens.total_tokens, 370);
    assert.deepEqual(
      snapA.workers.map((w) => w.task_id),
      ['task_bbbb11112222', 'task_aaaa11112222', 'task_deadbeef1234']
    );

    // Conv B sees ONLY task 4
    const snapB = await store.getSnapshot({ conversationId: convB, scope: 'conversation' });
    assert.equal(snapB.stats.total_workers, 1);
    assert.equal(snapB.stats.running_count, 0);
    assert.equal(snapB.stats.tokens.total_tokens, 600);
    assert.deepEqual(
      snapB.workers.map((w) => w.task_id),
      ['task_cccc11112222']
    );

    // Scope 'all' sees all 4 bridge tasks and 0 CLI sessions
    const snapAll = await store.getSnapshot({ conversationId: convA, scope: 'all' });
    assert.equal(snapAll.stats.total_workers, 4);
    assert.equal(snapAll.stats.cli_count, 0);

    // Clearing convA removes ONLY convA's 2 finished tasks, keeping running task_bbbb11112222 & convB's task
    const removed = store.clearFinishedTasks({ conversationId: convA, scope: 'conversation' });
    assert.equal(removed, 2);

    const afterA = await store.getSnapshot({ conversationId: convA, scope: 'conversation' });
    assert.deepEqual(
      afterA.workers.map((w) => w.task_id),
      ['task_bbbb11112222']
    );
    const afterB = await store.getSnapshot({ conversationId: convB, scope: 'conversation' });
    assert.deepEqual(
      afterB.workers.map((w) => w.task_id),
      ['task_cccc11112222']
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('classic sprites.js renders all 6 pixel states, standby stage, and multi-worker workshop stage cleanly', () => {
  const { CodexSprites } = loadClassicSprites();
  const { ANIMATION_STATES, drawWorkerSprite, drawWorkshopStage, getPaletteForWorker } = CodexSprites;

  assert.equal(ANIMATION_STATES.length, 6);
  for (const pose of ANIMATION_STATES) {
    const c = makeMockCanvas(48, 48);
    const p = getPaletteForWorker({ model: 'gpt-6.2-sol', worker_id: 'w1' }, 0);
    drawWorkerSprite(c, pose, p, 4, 'xhigh', 'dark');
    assert.ok(c.getFillOps() > 0, `Expected fillOps > 0 for state ${pose}`);
  }

  // Standby stage with 0 workers still draws background + standby pixel bot
  const standbyStage = makeMockCanvas(360, 128);
  const standbyHits = drawWorkshopStage(standbyStage, [], { theme: 'light' }, 0);
  assert.equal(standbyHits.length, 0);
  assert.ok(standbyStage.getFillOps() > 0, 'Expected standby stage to draw pixels');

  const stage = makeMockCanvas(360, 128);
  const workers = [
    { worker_id: 'w1', model: 'gpt-6.2-sol', reasoning_effort: 'xhigh', status: 'running', activity: 'coding' },
    { worker_id: 'w2', model: 'gpt-6.1-sol', reasoning_effort: 'medium', status: 'running', activity: 'thinking' },
    { worker_id: 'w3', model: 'gpt-6-astra', reasoning_effort: 'low', status: 'completed', activity: 'completed' },
  ];
  const hitboxes = drawWorkshopStage(stage, workers, { theme: 'dark', selectedWorkerId: 'w1' }, 3);
  assert.equal(hitboxes.length, 2);
});

test('buildMonitorHtml inlines classic CSS/JS without module scripts and preserves fallback shell', () => {
  const html = buildMonitorHtml(SIDECAR_DIR);
  assert.match(html, /src="\/preload\.js"/);
  assert.match(html, /<style>[\s\S]*\.app-shell[\s\S]*<\/style>/);
  assert.match(html, /<script>[\s\S]*globalThis\.CodexSprites[\s\S]*<\/script>/);
  assert.doesNotMatch(html, /type\s*=\s*["']module["']/i);
  assert.doesNotMatch(html, /<!--INLINE_STYLES_START-->/);
  assert.doesNotMatch(html, /<!--INLINE_SCRIPTS_START-->/);
  assert.match(html, /<div id="app">[\s\S]*Codex Monitor[\s\S]*<\/div>/);
});

async function runAppInMockVm({ fetchImpl }) {
  const appCode = readFileSync(join(SIDECAR_DIR, 'app.js'), 'utf8');
  const spritesCode = readFileSync(join(SIDECAR_DIR, 'sprites.js'), 'utf8');
  const appRoot = { innerHTML: '' };
  const workshopCanvas = makeMockCanvas(360, 128);
  const rootEl = {
    attrs: {},
    style: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    appendChild() {},
  };
  const winListeners = {};
  const ctx = {
    console,
    Math,
    Date,
    Set,
    Map,
    JSON,
    URLSearchParams,
    Error,
    navigator: { language: 'zh-CN' },
    location: { search: '?conversationId=11111111-1111-1111-1111-111111111111' },
    CSS: { escape: (s) => String(s) },
    getComputedStyle: () => ({ color: 'rgb(255, 255, 255)' }),
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    document: {
      hidden: false,
      documentElement: rootEl,
      body: rootEl,
      createElement: () => ({ style: {}, remove() {} }),
      getElementById: (id) => (id === 'app' ? appRoot : id === 'workshop-canvas' ? workshopCanvas : null),
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {
      devicePixelRatio: 1,
      sidecar: {
        conversationId: '11111111-1111-1111-1111-111111111111',
        fetch: fetchImpl,
      },
      addEventListener(name, fn) {
        winListeners[name] = fn;
      },
    },
  };
  ctx.globalThis = ctx;
  ctx.self = ctx;

  vm.runInNewContext(spritesCode, ctx, { filename: 'sprites.js' });
  vm.runInNewContext(appCode, ctx, { filename: 'app.js' });
  const initialHtml = appRoot.innerHTML;
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return {
    initialHtml,
    finalHtml: appRoot.innerHTML,
    mounted: Boolean(ctx.window.__codexMonitorMounted),
    workshopFillOps: workshopCanvas.getFillOps(),
  };
}

test('app.js renders default dashboard for zero-task conversations and degrades gracefully on fetch error', async () => {
  const zeroTaskRun = await runAppInMockVm({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          generated_at: Date.now() / 1000,
          scope: 'conversation',
          conversation_id: '11111111-1111-1111-1111-111111111111',
          has_conversation: true,
          subagent_count: 0,
          cli_status: { binary_found: true, auth_ready: true, default_model: 'gpt-6.2-sol' },
          stats: {
            total_workers: 0,
            running_count: 0,
            completed_count: 0,
            failed_count: 0,
            tokens: {
              input_tokens: 0,
              cached_input_tokens: 0,
              output_tokens: 0,
              reasoning_output_tokens: 0,
              total_tokens: 0,
              cache_hit_rate: 0,
            },
            total_elapsed_ms: 0,
            avg_elapsed_ms: 0,
            total_changed_files: 0,
            success_rate: 0,
            by_model: [],
            by_effort: [],
            by_mode: [],
          },
          workers: [],
        };
      },
    }),
  });

  assert.equal(zeroTaskRun.mounted, true);
  assert.ok(zeroTaskRun.workshopFillOps > 0);
  assert.match(zeroTaskRun.initialHtml, /id="workshop-canvas"/);
  assert.match(zeroTaskRun.initialHtml, /0 \/ 0/);
  assert.match(zeroTaskRun.finalHtml, /CLI 就绪 · gpt-6\.2-sol/);
  assert.match(zeroTaskRun.finalHtml, /class="empty-title"/);
  assert.match(zeroTaskRun.finalHtml, /class="empty-card"/);
  assert.doesNotMatch(zeroTaskRun.finalHtml, /class="empty-desc"/);
  assert.doesNotMatch(zeroTaskRun.finalHtml, /data-action="switch-all"/);
  assert.doesNotMatch(zeroTaskRun.finalHtml, /<button class="btn" id="btn-refresh" disabled/);

  const errorRun = await runAppInMockVm({
    fetchImpl: async () => {
      throw new Error('backend unreachable');
    },
  });
  assert.equal(errorRun.mounted, true);
  assert.match(errorRun.finalHtml, /class="error-banner"/);
  assert.match(errorRun.finalHtml, /backend unreachable/);
  assert.match(errorRun.finalHtml, /id="workshop-canvas"/);
  assert.match(errorRun.finalHtml, /0 \/ 0/);
});
