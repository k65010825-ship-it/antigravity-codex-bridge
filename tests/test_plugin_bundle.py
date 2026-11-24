from __future__ import annotations

import json
import re
import stat
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import codex_mcp_server  # noqa: E402

BANNED_NAME_PREFIXES = ("antigravity", "gemini", "claude", "cursor")
BANNED_NAME_SUFFIXES = ("plugin", "mcp")
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
KEBAB_CASE_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def _parse_yaml_frontmatter(markdown_text: str) -> dict[str, Any]:
    """Parse simple key/value YAML frontmatter from a Markdown file without external deps."""
    lines = markdown_text.splitlines()
    if len(lines) < 3 or lines[0].strip() != "---":
        raise AssertionError("Expected YAML frontmatter starting with '---'")

    end_idx = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_idx = idx
            break
    if end_idx is None:
        raise AssertionError("Unterminated YAML frontmatter (missing closing '---')")

    data: dict[str, Any] = {}
    for raw_line in lines[1:end_idx]:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise AssertionError(f"Unsupported frontmatter line: {raw_line!r}")
        key, raw_val = line.split(":", 1)
        key = key.strip()
        val = raw_val.strip()
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            items = [item.strip().strip("\"'") for item in inner.split(",") if item.strip()] if inner else []
            data[key] = items
        elif val.lower() == "true":
            data[key] = True
        elif val.lower() == "false":
            data[key] = False
        elif (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            data[key] = val[1:-1]
        else:
            data[key] = val
    return data


class TestPluginBundle(unittest.TestCase):
    def test_root_has_no_disallowed_loader_files(self) -> None:
        for forbidden in ("AGENTS.md", "GEMINI.md", ".mcp.json", "mcp.json"):
            self.assertFalse(
                (REPO_ROOT / forbidden).exists(),
                f"Repository root must not contain {forbidden}",
            )

    def test_plugin_manifest_valid_for_marketplace(self) -> None:
        manifest_path = REPO_ROOT / "plugin.json"
        self.assertTrue(manifest_path.is_file(), "Missing plugin.json")
        data = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(data.get("$schema"), "https://antigravity.google/schemas/v1/plugin.json")
        name = data.get("name")
        display_name = data.get("displayName")
        self.assertEqual(name, "codex-bridge")
        self.assertRegex(name, KEBAB_CASE_RE)
        self.assertEqual(display_name, "Codex Bridge")

        for candidate in (name, display_name):
            lowered = candidate.lower()
            for prefix in BANNED_NAME_PREFIXES:
                self.assertFalse(
                    lowered.startswith(prefix),
                    f"Identifier {candidate!r} must not start with {prefix!r}",
                )
            for suffix in BANNED_NAME_SUFFIXES:
                self.assertFalse(
                    lowered.endswith(suffix),
                    f"Identifier {candidate!r} must not end with {suffix!r}",
                )

        version = data.get("version", "")
        self.assertRegex(version, SEMVER_RE)

        description = data.get("description", "")
        self.assertIsInstance(description, str)
        self.assertGreaterEqual(len(description), 120)
        self.assertLessEqual(len(description), 160)

        logo = data.get("logo")
        self.assertEqual(logo, "assets/logo.svg")
        self.assertTrue((REPO_ROOT / logo).is_file(), f"Missing logo file at {logo}")

        prompts = data.get("suggestedPrompts")
        self.assertIsInstance(prompts, list)
        self.assertGreaterEqual(len(prompts), 1)
        self.assertLessEqual(len(prompts), 3)
        for prompt in prompts:
            self.assertIsInstance(prompt, str)
            self.assertTrue(prompt.strip(), "suggestedPrompts entries must be non-empty")

        author = data.get("author")
        self.assertIsInstance(author, dict)
        self.assertTrue(str(author.get("name", "")).strip())
        self.assertEqual(data.get("license"), "MIT")

        keywords = data.get("keywords")
        self.assertIsInstance(keywords, list)
        self.assertGreaterEqual(len(keywords), 1)

        for url_field in ("homepage", "repository"):
            if url_field in data:
                val = data[url_field]
                url_str = val.get("url", "") if isinstance(val, dict) else str(val)
                self.assertTrue(url_str.startswith("https://"), f"{url_field} must be https://")

    def test_mcp_config_matches_server_and_plugin_vars(self) -> None:
        mcp_path = REPO_ROOT / "mcp_config.json"
        self.assertTrue(mcp_path.is_file(), "Missing mcp_config.json")
        config = json.loads(mcp_path.read_text(encoding="utf-8"))

        servers = config.get("mcpServers")
        self.assertIsInstance(servers, dict)
        self.assertIn("codex", servers)
        codex_cfg = servers["codex"]

        self.assertEqual(codex_cfg.get("command"), "python3")
        self.assertEqual(
            codex_cfg.get("args"),
            ["${PLUGIN_ROOT}/scripts/codex_mcp_server.py", "--data-dir", "${PLUGIN_DATA}"],
        )
        self.assertEqual(codex_cfg.get("timeoutSeconds"), 900)

        env = codex_cfg.get("env", {})
        self.assertIsInstance(env, dict)
        self.assertNotIn("PLUGIN_ROOT", env)
        self.assertNotIn("PLUGIN_DATA", env)

        tools = codex_cfg.get("tools")
        self.assertIsInstance(tools, dict)
        self.assertEqual(tools.get("codex_status"), {"eager": True, "background": "off"})
        self.assertEqual(tools.get("codex_plan"), {"eager": True})
        self.assertEqual(tools.get("codex_run"), {"eager": True})
        self.assertEqual(tools.get("codex_review"), {"eager": True})
        self.assertEqual(tools.get("codex_poll"), {"eager": False})

        server_tool_names = {tool["name"] for tool in codex_mcp_server._build_tool_definitions()}
        self.assertEqual(set(tools.keys()), server_tool_names)

    def test_rules_agents_md_is_plain_markdown_under_limit(self) -> None:
        rules_path = REPO_ROOT / "rules" / "AGENTS.md"
        self.assertTrue(rules_path.is_file(), "Missing rules/AGENTS.md")
        raw = rules_path.read_bytes()
        self.assertGreater(len(raw), 0)
        self.assertLess(len(raw), 24000)

        text = raw.decode("utf-8")
        self.assertFalse(text.lstrip().startswith("---"), "rules/AGENTS.md must not contain YAML frontmatter")

    def test_skills_frontmatter_matches_directory_names(self) -> None:
        skills_dir = REPO_ROOT / "skills"
        self.assertTrue(skills_dir.is_dir(), "Missing skills/ directory")
        skill_dirs = sorted(p for p in skills_dir.iterdir() if p.is_dir())
        self.assertEqual(
            [p.name for p in skill_dirs],
            ["codex-architect", "codex-subagent", "dual-track-build", "idea-redteam"],
        )

        for skill_dir in skill_dirs:
            skill_md = skill_dir / "SKILL.md"
            self.assertTrue(skill_md.is_file(), f"Missing {skill_md}")
            meta = _parse_yaml_frontmatter(skill_md.read_text(encoding="utf-8"))
            self.assertEqual(meta.get("name"), skill_dir.name)
            self.assertTrue(str(meta.get("description", "")).strip())

    def test_worker_agent_frontmatter_and_tools(self) -> None:
        agent_path = REPO_ROOT / "agents" / "codex-worker.md"
        self.assertTrue(agent_path.is_file(), "Missing agents/codex-worker.md")
        meta = _parse_yaml_frontmatter(agent_path.read_text(encoding="utf-8"))

        self.assertEqual(meta.get("name"), "codex-worker")
        self.assertTrue(str(meta.get("description", "")).strip())
        self.assertIs(meta.get("subagent"), True)
        self.assertIs(meta.get("mainAgent"), False)
        self.assertIs(meta.get("inheritMcp"), True)
        self.assertEqual(meta.get("tools"), ["read_file", "call_mcp_tool", "send_message"])

    def test_scripts_have_executable_permissions(self) -> None:
        for script_name in ("codex_mcp_server.py", "codex_runner.py", "codex_hook.py"):
            script_path = SCRIPTS_DIR / script_name
            self.assertTrue(script_path.is_file(), f"Missing scripts/{script_name}")
            mode = stat.S_IMODE(script_path.stat().st_mode)
            self.assertTrue(bool(mode & stat.S_IXUSR), f"Expected owner execute bit on {script_name}, got {oct(mode)}")
            self.assertFalse(bool(mode & stat.S_IWOTH), f"Unexpected world-writable bit on {script_name}, got {oct(mode)}")

    def test_hooks_json_and_sidecar_bundle_valid(self) -> None:
        hooks_path = REPO_ROOT / "hooks.json"
        self.assertTrue(hooks_path.is_file(), "Missing hooks.json")
        hooks = json.loads(hooks_path.read_text(encoding="utf-8"))
        self.assertIsInstance(hooks, dict)
        tracker = hooks.get("codex-conversation-tracker")
        self.assertIsInstance(tracker, dict)
        pre_tool_use = tracker.get("PreToolUse")
        self.assertIsInstance(pre_tool_use, list)
        self.assertTrue(len(pre_tool_use) >= 1)

        sidecar_dir = REPO_ROOT / "sidecars" / "codex_monitor"
        self.assertTrue(sidecar_dir.is_dir(), "Missing sidecars/codex_monitor")
        for req_file in (
            "package.json",
            "sidecar.json",
            "main.mjs",
            "monitor_store.mjs",
            "index.html",
            "styles.css",
            "sprites.js",
            "app.js",
        ):
            self.assertTrue((sidecar_dir / req_file).is_file(), f"Missing sidecar file {req_file}")

        sidecar_cfg = json.loads((sidecar_dir / "sidecar.json").read_text(encoding="utf-8"))
        self.assertIs(sidecar_cfg.get("has_web_ui"), True)
        views = sidecar_cfg.get("ui_config", {}).get("views", [])
        self.assertEqual(len(views), 1)
        self.assertEqual(views[0].get("entrypoint"), "SIDECAR_UI_ENTRYPOINT_AUX_PANE")

        html_text = (sidecar_dir / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="/preload.js"', html_text)
        self.assertNotRegex(html_text, re.compile(r'type\s*=\s*["\']module["\']', re.IGNORECASE))
        self.assertIn('src="/sprites.js"', html_text)
        self.assertIn('src="/app.js"', html_text)
        app_div_match = re.search(r'<div\s+id="app"\s*>(.*?)</div>\s*<script', html_text, re.DOTALL | re.IGNORECASE)
        self.assertIsNotNone(app_div_match, "Expected non-empty static fallback inside <div id='app'>")
        self.assertTrue(app_div_match.group(1).strip(), "Expected non-empty fallback HTML inside <div id='app'>")
        self.assertNotRegex(html_text, re.compile(r"<script[^>]+src=['\"]https?://", re.IGNORECASE))
        self.assertNotRegex(html_text, re.compile(r"<link[^>]+href=['\"]https?://", re.IGNORECASE))

        for js_name in ("sprites.js", "app.js"):
            js_text = (sidecar_dir / js_name).read_text(encoding="utf-8")
            self.assertNotRegex(js_text, re.compile(r"^\s*(?:import|export)\s", re.MULTILINE))

        # Obsolete MCP App frontend artifacts must be removed
        self.assertFalse((REPO_ROOT / "assets" / "dashboard.html").exists())
        self.assertFalse((REPO_ROOT / "ui").exists())

    def test_logo_svg_is_square_vector_with_padding(self) -> None:
        logo_path = REPO_ROOT / "assets" / "logo.svg"
        self.assertTrue(logo_path.is_file(), "Missing assets/logo.svg")
        root = ET.fromstring(logo_path.read_text(encoding="utf-8"))
        self.assertTrue(root.tag.endswith("svg"))
        view_box = root.attrib.get("viewBox", "")
        parts = view_box.split()
        self.assertEqual(len(parts), 4, f"Expected 4-part viewBox, got {view_box!r}")
        _, _, width_s, height_s = parts
        width = float(width_s)
        height = float(height_s)
        self.assertEqual(width, height)
        self.assertGreaterEqual(width, 128.0)
        self.assertGreater(len(list(root)), 0, "SVG logo must contain drawable elements")

    def test_readme_preserves_workspace_metadata_and_docs(self) -> None:
        readme_path = REPO_ROOT / "README.md"
        self.assertTrue(readme_path.is_file(), "Missing README.md")
        content = readme_path.read_text(encoding="utf-8")
        for marker in ("所属 Agent", "目录性质", "创建日期", "任务简述"):
            self.assertIn(marker, content)
        for doc_term in (
            "CODEX_BIN",
            "CODEX_BRIDGE_ALLOW_DANGER_SANDBOX",
            "agy plugin install https://github.com/ballShell/codex-bridge",
            "MIT License",
            "README.zh-CN.md",
        ):
            self.assertIn(doc_term, content)

        zh_readme = REPO_ROOT / "README.zh-CN.md"
        self.assertTrue(zh_readme.is_file(), "Missing README.zh-CN.md")
        zh_content = zh_readme.read_text(encoding="utf-8")
        self.assertIn("README.md", zh_content)
        self.assertIn("MIT License", zh_content)

    def test_license_file_matches_mit_manifest(self) -> None:
        license_path = REPO_ROOT / "LICENSE"
        self.assertTrue(license_path.is_file(), "Missing LICENSE file at repository root")
        text = license_path.read_text(encoding="utf-8")
        self.assertIn("MIT License", text)
        self.assertIn("Copyright (c) 2026 ballShell", text)
        self.assertIn("Permission is hereby granted, free of charge", text)


if __name__ == "__main__":
    unittest.main()
