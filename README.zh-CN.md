# Codex Bridge

[English](README.md) | **简体中文**

**前店后厂的双模型协作插件**：让 Gemini 发挥创意、审美与“会说人话”的优势，把 OpenAI Codex CLI 封装为 Antigravity 的严谨主程与质检员，并附带嵌入式右侧 **像素风 Codex Monitor** 实时看板。

- **前店（Antigravity / Gemini）**：负责自然对话、想 Idea、界面与交互设计、视觉审美把关、视频/多媒体策划、写报告，以及把 Codex 的技术输出过滤翻译成人话向你汇报。
- **后厂（Codex CLI）**：专注技术可行性红队审查、后端与核心逻辑落地、复杂算法/渲染脚本、多文件重构，以及只看逻辑不碰审美的代码审查。
- **像素工坊看板（Codex Monitor）**：在 Antigravity 右侧边栏按**当前会话独立**展示所有由本对话（及子代理）派出的 Codex 状态、思考强度、Token 消耗与耗时统计，并由可爱的像素小人实时演绎工作状态。

## 像素工坊小人一览

每个派出干活的 Codex 都会化身一只 `24×24` 像素小机器人，头顶天线、护目镜表情和桌面道具会随着状态实时动起来：

| 闲置待命 | 思考规划 | 编码执行 | 代码审查 | 任务完成 | 异常中断 |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ![闲置](assets/pose-idle.gif) | ![思考](assets/pose-thinking.gif) | ![编码](assets/pose-coding.gif) | ![审查](assets/pose-reviewing.gif) | ![完成](assets/pose-completed.gif) | ![异常](assets/pose-failed.gif) |
| 偶尔眨眼卖萌 | 亮起小灯泡 + 雷达 | 键盘狂敲冒火花 | 举着放大镜逐行扫 | 举手欢呼 `^ ^` + 星星 | 晕头 `X X` 冒青烟 |

## 协同工作流与智能分工

日常直接自然对话即可，Gemini 会按任务类型自动分流（随时可一句话手动切换）：

| 任务类型 | 自动路由 / Skill | 双模型分工方式 |
| :--- | :--- | :--- |
| 想 Idea、写报告、文案、视觉原型、纯样式修改 | **Gemini 直出** | 全程由 Gemini 完成，不惊动 Codex，保持高审美与沟通流畅度。 |
| 创意方案 / 架构可行性把关 | **`idea-redteam`** | Gemini 先陪你聊出有灵性的方案 → Codex 只读做技术红队挑刺 → Gemini 过滤防御性噪音，只用人话汇报结论。 |
| 带界面的全栈应用、交互工具、程序化视频/多媒体管线 | **`dual-track-build`** | Gemini 主导体验与视觉 → 锁定共享接口契约与 **UI 隔离墙** → Codex 写后端/核心引擎、Gemini 写 UI/样式（支持串行或 `codex-worker` 分片并行） → Codex **只审逻辑不准碰样式** → Gemini 视觉自检并交付。 |
| 纯硬核后端、深度重构、疑难排错 | **`codex-architect`** | 先只读出方案（`codex_plan`）→ 人工拍板 → 续跑落盘（`codex_run`）→ 防过度设计抽检与汇报。 |
| 显式点名调用 Codex 或定向 Code Review | **`codex-subagent`** / **`codex-worker`** | 零多余仪式感的快速通道，支持只读分析、定向改代码、会话续跑、代码审查与无冲突并行切片。 |

## 使用说明

### 1. 严谨度档位（`L1` / `L2` / `L3`）

为了治好 Codex 动不动“过度防御、过度抽象”的毛病，每次派活都会带上明确的**严谨度档位**（默认 **`L2`**，对话中随时一句话切换）：

| 档位 | 级别 | 适用场景与对 Codex 的约束 |
| :---: | :--- | :--- |
| **`L1`** | **原型级（Spike / Prototype）** | 快速验证脑洞、做 Demo 或一次性实验。代码直给、用合理默认值、极简抽象，**明令禁止冗余兜底和过度防御样板**。 |
| **`L2`** *(默认)* | **MVP 级（Pragmatic MVP）** | 日常绝大多数实用项目。核心逻辑与数据完整性扎实、主流程报错清晰；极低概率边缘情况直接 Fail Fast，**严守 YAGNI**，不造多余的企业级抽象层。 |
| **`L3`** | **生产级（Production Hardened）** | 核心生产服务、支付/权限/关键数据链路。彻底放开 Codex 的防御严谨度，拉满并发与幂等安全、严格入参校验与全面边界测试。 |

### 2. 红 / 黄 / 白 三色降噪滤镜

每次 Codex 审查方案或代码后，Gemini 会先替你降噪翻译，再按三层呈现，彻底告别看不懂的长篇免责声明：

- 🔴 **红（真硬伤 / 必改项）**：真实 Bug、逻辑矛盾、安全/丢数据隐患或架构死胡同——用大白话讲清后果与修复方式。
- 🟡 **黄（权衡项 / 你来拍板）**：有真实取舍价值的边缘情况或复杂度权衡——整理成简短 A/B 选择题，让你一秒决策。
- ⚪ **白（过度防御噪音）**：不符合当前严谨度档位的吹毛求疵或过度抽象建议——**不展开刷屏，统一折叠成一句话带过**。

### 3. UI 审美隔离墙（UI Freeze Zone）

- 在混合开发任务中，Codex 仅限修改后端、核心逻辑、Schema、Hooks 与工程脚本，**禁止触碰 UI 布局、CSS 样式、动效与用户文案**（除非你明确要求）。
- 让 `codex_review` 审查 Gemini 写的前端代码时，强制限定**只查逻辑 Bug、状态切换、异步竞态、内存泄漏与类型安全**，严禁点评视觉排版和审美。

### 4. 日常对话触发示例

不需要背任何命令，像平时聊天一样说就行：

- 「我想做一个个人复盘工具，先聊聊方案，然后让 Codex 审一下可行性」→ 自动走 **`idea-redteam`**（默认 `L2`）
- 「帮我做一个好看的阅读笔记 Web 应用，界面精致一点，数据存储要稳」→ 自动走 **`dual-track-build`**（`L2` + UI 隔离墙）
- 「这个先按 **L1 原型级** 来，快速跑通核心体验就行，别过度设计」→ 临时降档到 **`L1`**
- 「这个支付回调模块拉到 **L3 生产级**，让 Codex 把并发和边界全审一遍」→ 临时升档到 **`L3`**
- 「让 Codex review 一下我未提交的代码，只给我看红黄项」→ 自动走 **`codex-subagent`** 审查 + 三色过滤

## 适合谁

- 喜欢跟 Gemini 聊需求、看重审美与表达体验，同时又想借助 Codex 的严谨工程能力与代码审查的开发者。
- 同时使用 Antigravity 与 OpenAI Codex CLI、不想手动在两个工具间来回复制上下文和 Prompt，还想顺便看着几个小机器人干活的用户。
- 运行前提：`Python 3.9+`（零三方包依赖），以及本机可用的 `codex` CLI（支持 `codex login`、`OPENAI_API_KEY` 或 `$CODEX_HOME/config.toml` 自定义 Provider）。

## 安装

方式一：通过 Antigravity CLI 直接安装

```bash
agy plugin install https://github.com/k65010825-ship-it/antigravity-codex-bridge
```

方式二：克隆到 Antigravity 全局插件目录

```bash
git clone https://github.com/k65010825-ship-it/antigravity-codex-bridge.git ~/.gemini/config/plugins/codex-bridge
```

> 可选环境变量：`CODEX_BIN`（自定义 `codex` 路径）、`CODEX_BRIDGE_ALLOW_DANGER_SANDBOX=1`（默认禁用无沙盒模式，仅在明确需要时手动开启）。
