---
name: idea-redteam
description: "Gemini-first ideation and planning paired with Codex read-only feasibility red-teaming. Use when brainstorming ideas, shaping product or architecture plans, or asking Codex to pressure-test feasibility, hidden traps, and technical assumptions before implementation."
---

# Idea Red-Team — Creative Vision + Pragmatic Feasibility Audit

Let **Gemini** shape creative, human-centered ideas and plans with the user first, then dispatch **Codex** (`codex_plan`, strict read-only) as a pragmatic technical reviewer to catch real flaws — filtered through the **Red / Yellow / White** lens so the user never drowns in defensive noise. Always converse and present findings in the **user's own language**.

## MCP Reference (`codex-bridge_codex`)

- Eager tools: `codex_status`, `codex_plan`, `codex_run`, `codex_review`.
- Lazy polling tool: `call_mcp_tool(ServerName="codex-bridge_codex", ToolName="codex_poll", Arguments={"task_id": "<id>", "wait_seconds": 30})`.

## Step 1: Gemini Leads Discovery & Drafts the Proposal

Do **not** hand a raw, half-baked idea straight to Codex (it will anchor on rigid engineering defaults and kill momentum).

1. Collaborate naturally with the user to shape a crisp draft covering:
   - **Core idea & user value** (what makes it genuinely good/useful/delightful)
   - **Proposed approach** (user flow, key components, data flow, or media/script concept)
   - **Explicit Non-Goals** (what we intentionally are NOT building right now)
2. Determine the **Rigor Level** (default **`L2` Pragmatic MVP**; switch to `L1` for quick prototypes/experiments or `L3` for production-critical systems; confirm in passing only if ambiguous).

## Step 2: Workspace Guard & Readiness Check

1. Resolve target `cwd` as an explicit absolute path:
   - If the idea builds on an existing project, confirm its absolute `cwd` (if outside the active workspace, ask the user before calling any Codex tool).
   - If greenfield with no workspace yet, confirm a read-only reference directory with the user before calling `codex_plan`.
2. Call `codex_status(cwd="<abs_cwd>")` only if Codex readiness is unverified or after a setup/auth error. Translate any `remediation` plainly if `binary_found` or `auth_ready` is `false`.

## Step 3: Dispatch Codex Pragmatic Feasibility Audit (`codex_plan`)

Call `codex_plan` (enforces `-s read-only`) with a tightly scoped red-team brief:

```markdown
## Task: Pragmatic Technical Feasibility Red-Team (Read-Only)
Evaluate the proposal below against real codebase/technical constraints. Do NOT rewrite the product vision or critique visual/UX aesthetics unless they directly cause a technical impossibility.

## Active Rigor Level
- Level: <L1 Spike | L2 Pragmatic MVP | L3 Production Hardened>
- Anti-Overengineering Rule: Calibrate strictly to this rigor level. Flag real blockers, broken assumptions, hidden dependencies, data/state consistency traps, or unexpectedly high implementation costs. Do NOT pad the audit with speculative enterprise hardening or premature abstractions.

## Proposal to Audit
<Concise structured summary of Gemini + User's plan, target architecture, and explicit non-goals>

## Workspace & Key Context
- Target cwd: <abs_cwd>
- Key files / systems (if existing repo): <paths or none>

## Required Output Structure
Tag every finding strictly as one of:
- [BLOCKER] Real technical flaw, contradiction, impossible assumption, or severe data/security risk.
- [TRADEOFF] Genuine design/scope decision with meaningful cost vs. benefit trade-offs.
- [NIT] Minor or conservative defensive hardening suggestion.
Include exact file/symbol evidence when referencing existing code, plus the leanest viable alternative for each BLOCKER.
```

- If `status == "running"`, poll `codex_poll` via `call_mcp_tool` until terminal status.
- Save `session_id` from the completed payload in case the user wants to proceed directly to implementation.

## Step 4: Critically Filter (Red / Yellow / White) & Translate

Never parrot Codex's output verbatim. Think independently as the user's technical translator:

1. Spot-check any referenced repo files with `read_file` if Codex makes a surprising claim about existing code.
2. **Re-calibrate severity honestly:** If Codex marked a speculative `L3` concern as `[BLOCKER]` during an `L1`/`L2` project, demote it to Yellow or White yourself.
3. Present a clean, human-friendly **Feasibility Checkup** in the user's language:
   - **一句话结论 (Verdict):** Is the idea solid as-is, solid with 1–2 tweaks, or blocked by a fundamental constraint?
   - 🔴 **必须修的硬伤 (Red):** Only true technical blockers — explain what would break in plain terms and propose the cleanest fix. (If none, say so clearly!)
   - 🟡 **需要你拍板的权衡 (Yellow):** Short A/B options with clear pros/cons so the user can pick in seconds.
   - ⚪ **过滤说明 (White):** Collapse all over-defensive/speculative noise into **one single sentence** (e.g., *"另已过滤 4 条偏保守的防御性建议（如多活容灾、额外抽象层等），当前 L2 阶段暂无需考虑。"*).

## Step 5: Revise & Route Next Step

Once the user responds to any Yellow choices:
- Update the plan cleanly so the user has one coherent blueprint.
- Recommend the leanest next track:
  - **Pure design / report / prototype mockup:** Stay in Gemini Direct.
  - **UI/UX + real code or multimedia pipeline:** Transition to `dual-track-build`.
  - **Pure backend/core implementation:** Transition to `codex-architect` or `codex_run` (reusing `session_id` when helpful).
