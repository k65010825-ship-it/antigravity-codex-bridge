# Codex Bridge

**English** | [简体中文](README.zh-CN.md)

A **"creative front-of-house / rigorous back-of-house"** Antigravity plugin that pairs Gemini's human fluency, visual taste, and product sense with OpenAI Codex CLI's engineering rigor — complete with a live **Pixel-Art Codex Monitor** right inside Antigravity's side pane.

- **Front-of-House (Antigravity / Gemini):** Owns ideation, UX/UI design, styling, visual polish, video/media direction, reports, plain-language translation, and final presentation.
- **Back-of-House (Codex CLI):** Owns technical feasibility red-teaming, rigorous core/backend implementation, complex algorithms/pipelines, multi-file refactoring, and logic-only code review.
- **Live Pixel Monitor (Codex Monitor):** Opens in Antigravity's right-hand side pane, isolated per conversation, showing real-time worker cards (model, reasoning effort, token breakdown, elapsed time) and an animated **Pixel Workshop** crew.

## Meet the Pixel Codex Crew

Every Codex worker gets its own color-coded `24×24` pixel bot whose pose, visor, and props react live to what it's doing:

| Idle | Thinking | Coding | Reviewing | Completed | Failed |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ![Idle](assets/pose-idle.gif) | ![Thinking](assets/pose-thinking.gif) | ![Coding](assets/pose-coding.gif) | ![Reviewing](assets/pose-reviewing.gif) | ![Completed](assets/pose-completed.gif) | ![Failed](assets/pose-failed.gif) |
| Blinks on standby | Lightbulb & radar sparks | Typing fast with sparks | Sweeping magnifying glass | Cheering `^ ^` + stars | Dizzy `X X` + smoke puffs |

## Collaboration Workflows & Smart Routing

Just talk naturally — Gemini automatically routes each task to the right collaboration track (and you can override with a single sentence):

| Task Type | Track / Skill | How Gemini & Codex Split the Work |
| :--- | :--- | :--- |
| Ideation, copywriting, reports, visual mockups, pure styling | **Gemini Direct** | Handled entirely by Gemini without invoking Codex. |
| Idea & architecture feasibility checks | **`idea-redteam`** | Gemini shapes the plan with you → Codex runs a read-only feasibility red-team audit → Gemini filters noise and presents plain-language takeaways. |
| Full-stack UI apps, interactive tools, programmatic video/media pipelines | **`dual-track-build`** | Gemini leads UX/visuals → locks a shared contract & **UI Freeze Zone** → Codex builds core logic/backend while Gemini builds UI/styling (sequenced or parallel via `codex-worker`) → Codex runs a **logic-only review** → Gemini verifies visuals & delivers. |
| Pure heavy backend features, deep refactors, tricky debugging | **`codex-architect`** | Read-only plan (`codex_plan`) → human sign-off → resumed implementation (`codex_run`) → anti-overengineering spot-check. |
| Explicit Codex delegation or targeted code review | **`codex-subagent`** / **`codex-worker`** | Direct fast path for `codex_plan`, `codex_run`, `codex_review`, or parallel disjoint file slices. |

## Usage Guide

### 1. Rigor Level Dial (`L1` / `L2` / `L3`)

To keep Codex rigorous without turning every small task into over-engineered boilerplate, every Codex brief carries a **Rigor Level** (defaults to **`L2`**, switchable anytime in conversation):

| Level | Mode | When to Use & How Codex Behaves |
| :---: | :--- | :--- |
| **`L1`** | **Prototype / Spike** | Fast idea validation & throwaway demos. Direct code, sensible defaults, minimal abstraction; speculative fallbacks and defensive boilerplate are prohibited. |
| **`L2`** *(Default)* | **Pragmatic MVP** | Everyday product development. Solid core logic, data integrity, and clear main-path error handling; fail fast on unlikely edge cases. Strict YAGNI — no unrequested enterprise abstractions. |
| **`L3`** | **Production Hardened** | Critical backend services, payments, or core infra. Full defensive rigor, concurrency/idempotency safety, strict input validation, and thorough edge-case test coverage. |

### 2. Red / Yellow / White Signal Filter

You never have to wade through walls of defensive Codex jargon. Every audit or review is translated into three clean tiers:

- 🔴 **Red (Must-Fix Blockers):** Real bugs, broken assumptions, security/data-loss hazards, or architectural dead ends — explained in plain language with a clear fix.
- 🟡 **Yellow (Your Call — Trade-Offs):** Legitimate scope/edge-case trade-offs presented as concise A/B choices you can decide in seconds.
- ⚪ **White (Over-Defensive Noise):** Speculative nits or conservative boilerplate mismatched with the active Rigor Level — never dumped in detail, collapsed into **one brief sentence**.

### 3. UI Freeze Zone (Aesthetic Firewall)

- Codex is restricted to core logic, APIs, schemas, hooks, and scripts — it **never edits UI layouts, CSS/styling, animations, or copy** unless you explicitly ask it to.
- When `codex_review` audits Gemini-authored frontend code, it is strictly limited to **logic bugs, state transitions, async race conditions, memory leaks, and type safety** (hands off styling and visual taste).

### 4. Everyday Prompt Examples

- *"Let's brainstorm a personal dashboard tool, then ask Codex to red-team its technical feasibility."* → triggers **`idea-redteam`** (`L2`)
- *"Build a web app for tracking reading notes — make the UI clean and modern, and keep the backend storage solid."* → triggers **`dual-track-build`** (`L2`, UI Freeze Zone active)
- *"Keep this at L1 prototype level — just get the core workflow running fast without extra abstractions."* → dials down to **`L1`**
- *"Crank this payment webhook handler up to L3 production rigor and have Codex review all edge cases."* → dials up to **`L3`**
- *"Have Codex review my uncommitted changes and give me only the Red/Yellow issues."* → triggers **`codex-subagent`** review

## Who It's For

- Developers who want Gemini's human-friendly communication, creativity, and UI polish paired with Codex's backend engineering rigor and code review.
- Users with both Antigravity and OpenAI Codex CLI access who want seamless cross-agent orchestration and live visual progress without manually copying prompts back and forth.
- Requirements: `Python 3.9+` (zero third-party dependencies), `Node.js` (built into Antigravity for the sidecar panel), and a working local `codex` CLI (`codex login`, `OPENAI_API_KEY`, or custom `model_provider` in `$CODEX_HOME/config.toml`).

## Installation

Install directly from GitHub via Antigravity CLI:

```bash
agy plugin install https://github.com/ballShell/codex-bridge
```

Or clone into your global Antigravity plugins directory:

```bash
git clone https://github.com/ballShell/codex-bridge.git ~/.gemini/config/plugins/codex-bridge
```

> Optional environment variables: `CODEX_BIN` (custom `codex` binary path) and `CODEX_BRIDGE_ALLOW_DANGER_SANDBOX=1` (unsandboxed mode is blocked by default unless explicitly opted in).

## License

Licensed under the [MIT License](LICENSE).

---

<details>
<summary>Workspace Metadata (AgentsWorkSpace)</summary>

- **所属 Agent**：Antigravity (Gemini)
- **目录性质**：持久化（长期保留）
- **创建日期**：2026-11-21
- **任务简述**：将 OpenAI Codex CLI 封装为 Antigravity 原生插件（`codex-bridge`），实现前店后厂双模型协同。

</details>
