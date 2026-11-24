---
name: dual-track-build
description: "Coordinated dual-track build for projects combining human-facing aesthetics, UI/UX, or creative media with rigorous engineering. Gemini owns design, UI/styling, interactions, visual verification, and presentation; Codex owns core logic, backend/APIs, data or render pipelines, and logic-only review."
---

# Dual-Track Build — Aesthetics & Experience (Gemini) + Core Engine (Codex)

Build full-stack apps, interactive tools, or programmatic media/video pipelines by splitting **"surface" (Gemini)** from **"engine" (Codex)** along an explicit **Interface Contract** and **UI Freeze Zone**. Always converse, ask decisions, and deliver results in the **user's own language**.

## MCP Reference (`codex-bridge_codex`)

- Eager tools: `codex_status`, `codex_plan`, `codex_run`, `codex_review`.
- Lazy polling tool: `call_mcp_tool(ServerName="codex-bridge_codex", ToolName="codex_poll", Arguments={"task_id": "<id>", "wait_seconds": 30})`.

## Step 1: Experience & Aesthetic Blueprint (Gemini Leads)

1. Align briefly with the user in plain language on:
   - Core user journey, visual vibe/aesthetic direction, or creative storyboard (for video/presentation tools)
   - Explicit Non-Goals so scope stays crisp
   - **Rigor Level** (default **`L2` Pragmatic MVP**; use `L1` for rapid spikes or `L3` for production-critical apps)
2. Sketch the user-facing experience and visual/interaction plan **before** involving Codex so Codex builds to serve the experience, not the other way around.

## Step 2: Contract-First Split & Feasibility Audit (`codex_plan`)

1. Confirm the explicit absolute `cwd` (ask the user first if outside the active workspace) and run `codex_status(cwd="<abs_cwd>")` if readiness or Git state is unverified.
2. Define a concrete **Contract & Ownership Map**:
   - **Shared Contract:** Exact API routes/payloads, TypeScript types/schemas, hook signatures, CLI/render parameters, or file formats bridging surface and engine.
   - **Codex Slice (Engine — Codex Write Scope):** Backend routes, storage/DB, core domain logic, algorithms, state/data engines, complex FFmpeg/render/build scripts, and unit/integration tests.
   - **Gemini Slice (UI Freeze Zone — Codex Read-Only):** Visual components, page layouts, CSS/design tokens, animations, micro-interactions, copywriting, visual assets, and user-facing reports.
3. Run `codex_plan` (read-only) to validate technical feasibility and the shared contract under the active Rigor Level (`L1`/`L2`/`L3`), instructing Codex to tag findings as `[BLOCKER]`, `[TRADEOFF]`, or `[NIT]` and to stay out of visual design choices.
   - Poll `codex_poll` if `status == "running"`. Capture `session_id`.
4. Translate Codex's plan feedback using the **Red / Yellow / White** filter:
   - Show 🔴 **Red** blockers and 🟡 **Yellow** trade-offs clearly; collapse ⚪ **White** over-defensive noise into **one single sentence**.
   - Get the user's quick sign-off on the plan and any Yellow choices before writing code.

## Step 3: Dual-Track Implementation

Choose the safest execution shape for the task size:

### Track Mode A — Sequenced (Default for Small/Medium Tasks)
1. **Codex builds the Engine first (`codex_run`):**
   - Pass `session_id` (resume) or fresh brief, `sandbox="workspace-write"`, the locked **Shared Contract**, the active **Rigor Level**, and an explicit boundary directive:
     > *"Modify ONLY files in the Codex Slice (`<paths>`). Do NOT create or edit UI components, styles, layout, or copy inside the UI Freeze Zone (`<paths>`). Keep implementation lean for `<L1/L2/L3>` — no unrequested abstractions."*
   - Poll `codex_poll` if `status == "running"`. If `resume_failed: true`, retry immediately as a fresh `codex_run` omitting `session_id` with the full approved contract and scope embedded.
2. **Gemini builds the Surface (UI / UX / Visuals / Copy):**
   - Inspect Codex's `changed_files` and shared types/endpoints directly, then author the UI/UX, styling, animations, and copy directly in the Gemini Slice to high aesthetic quality.

### Track Mode B — Parallel Disjoint Slices (For Larger Independent Work)
- Only when Codex Slice and Gemini Slice touch **strictly disjoint, non-overlapping files** and the Shared Contract is locked:
  - Spawn a background `codex-worker` subagent for the Codex Slice (with explicit allowed paths, Rigor Level, and UI Freeze Zone boundary).
  - Concurrently author the Gemini Slice in the main session against the locked contract.
  - Wait for the `codex-worker` report and wire/verify integration once both slices finish.

## Step 4: Cross-Model Verification

Both models verify what they are best at:

1. **Gemini Audits Codex (Contract + Anti-Overengineering Spot-Check):**
   - Check `changed_files`, `pre_existing_dirty_files` (never misattribute pre-existing dirty files), and `diff_stat`.
   - Read key Codex files to confirm contract fidelity and ensure Codex did not sneak in needless L3 bloat/abstractions at L1/L2. Trim or ask Codex to simplify if it over-engineered.
2. **Codex Audits Gemini (Logic-Only Review):**
   - Run `codex_review(cwd="<abs_cwd>", mode="uncommitted", prompt=...)` with an explicit aesthetic guardrail:
     > *"Active Rigor Level: `<L1/L2/L3>`. Review ONLY functional correctness, state/hook bugs, async race conditions, error paths, memory leaks, contract mismatches, and type safety. Do NOT critique CSS, layout, visual styling, animation aesthetics, or copywriting. Tag each finding `[BLOCKER]`, `[TRADEOFF]`, or `[NIT]`."*
   - Filter findings through **Red / Yellow / White**:
     - Fix 🔴 **Red** logic bugs cleanly on the Gemini side (preserving visual polish and UX!).
     - Note any 🟡 **Yellow** trade-offs for the user.
     - Collapse ⚪ **White** noise into a single sentence.
3. **Runtime & Visual Self-Check (Gemini):**
   - Run tests/build commands to confirm clean execution.
   - For web UIs or visual outputs, visually inspect the live result (e.g., via built-in browser preview/screenshots when applicable) to make sure layout, spacing, contrast, and interaction feel genuinely polished before handing off.

## Step 5: Human-First Delivery & Presentation

Present the outcome in clear, natural language tailored to the user (never raw logs or internal tool dumps):
- **成果总览：** What was built and how to open/try it right away.
- **前后端分工摘要：** Brief breakdown of core logic (Codex) vs. UI/experience (Gemini) and key files touched.
- **验收证据：** Build/test results + visual/interaction checks performed.
- **待定权衡 & 过滤备注：** Any remaining 🟡 Yellow choices (if any), plus at most **one sentence** summarizing filtered ⚪ White items.
- Use structured tables, Mermaid diagrams, or interactive visual previews whenever they make the handover clearer.
