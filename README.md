# dsh-xhs-fish

小红书 AI 主理人工作台（DSH 插件，Phase 1 骨架）。

它把“选题 → 草稿 → 合规检查 → 审批 → 发布 / 评论 → 回复审批 → 审计”放进一个 DSH 会话视图。  
**默认 mock 引擎，不会访问真实小红书。** 所有发布与回复都必须人工审批；没有 `approvalId + confirm=true` 不会外发。

实现状态与未完成项：[docs/STATUS.md](docs/STATUS.md)

## 这是什么，不是什么

- 是：人工运营的 AI 虚拟鱼的工作台；AI 辅助创作，人负责发布和敏感回复。
- 不是：全自动养号机、AI 托管代发、批量矩阵、自动私信、主动评论陌生人。
- 账号资料页必须如实标注“AI 虚拟角色，人工运营”；内容必须标注 AI 生成。
- 本项目是社区插件，不是小红书或 DeepSeek 官方产品。

## 安装

本地开发：

```powershell
dsh plugin --profile web add "link:D:\path\to\dsh-xhs-fish"
```

如果当前 DSH 使用 `desktop` profile，把 `web` 换成 `desktop`。

或从 GitHub：

```powershell
dsh plugin --profile web add "github:Baozixu99/dsh-xhs-fish"
```

装完重启 DSH，刷新页面；会话顶部会出现「小红书工作台」。

## 引擎

### Mock（默认）

`config.json` 默认 `engine: "mock"`。UI 中可点“Mock 登录”，用于验证草稿、审批、评论流程；不会产生真实请求。

### 真实引擎：xiaohongshu-mcp

1. 从 <https://github.com/xpzouying/xiaohongshu-mcp/releases> 下载 Windows x64 主程序。
2. 放到：

```text
plugins/dsh-xhs-fish/bin/xiaohongshu-mcp.exe
```

3. 在设置页把 `engine` 改为 `mcp`，或直接编辑：

```text
%USERPROFILE%\.dsh-xhs-fish\config.json
```

```json
{
  "engine": "mcp",
  "engineBinary": "D:\\path\\to\\xiaohongshu-mcp.exe",
  "enginePort": 18060,
  "engineHome": "D:\\path\\to\\xhs-engine-home",
  "cookiesPath": "D:\\path\\to\\cookies.json"
}
```

- `engineHome`：隔离 sidecar 的 `LOCALAPPDATA` / `APPDATA` / `TEMP`，避免 AppData 权限问题，并复用已下载浏览器。
- `cookiesPath`：通过 `COOKIES_PATH` 传给 sidecar，指向登录工具生成的 `cookies.json`。

4. 重启 DSH（或让下一次工具调用重建适配器）。
5. 在「概览」点“扫码登录”，用测试账号扫码。
6. 先用 `publishVisibility = 仅自己可见` 验证发布。

> 主程序首次运行会下载约 150MB 无头浏览器。  
> 真实引擎尚未在本仓库的 CI 中验证；Phase 0 必须先跑通登录、搜索、详情、私有发布。

## 数据

默认目录：

```text
%USERPROFILE%\.dsh-xhs-fish\
  config.json
  drafts.json
  approvals.json
  posts.json
  comments.json
  replies.json
  audit.jsonl
  engine.log
```

- Cookie 由 `xiaohongshu-mcp` 自己管理；插件不保存、不打印。
- `audit.jsonl` 只追加；记录审批、发布、回复、失败码。
- 卸载插件不会删除数据目录。

可通过环境变量覆盖：

```powershell
$env:DSH_XHS_FISH_HOME = "D:\xhs-fish-data"
```

## 工具

只读：

- `xhs_status`
- `xhs_login_status`
- `xhs_login_qr`
- `xhs_research`
- `xhs_feed_detail`
- `xhs_compliance_check`
- `xhs_inbox_sync`
- `xhs_list_approvals`
- `xhs_list_drafts`

本地生成（不产生平台外发）：

- `xhs_topic_propose`
- `xhs_draft_create`
- `xhs_publish_prepare`
- `xhs_reply_prepare`

外发（必须审批 + confirm）：

- `xhs_publish_commit`
- `xhs_reply_commit`

安全：

- `xhs_kill_switch`

## 自动化级别

当前只支持 L2：AI 准备内容，人在 UI 里点发布/批准回复。  
L3 全自动不实现；`AutonomyPolicy` 只预留接口，L3 分支返回 `POLICY_DENIED`。

## 开发

```powershell
cd plugins\dsh-xhs-fish
node --test
node scripts/doctor.mjs
```

当前状态：13 个测试通过（Node v24.12.0，含工具注册测试）；`doctor` 通过。测试不覆盖真实小红书网络调用。

## 隐私

- 仓库不包含 cookie、浏览器 profile、发送记录、审批记录、账号 ID、测试笔记或日志。
- `bin/`、`.xhs-home/`、`cookies.json`、`demo-browser/`、`tests/*.txt` 等运行产物已在 `.gitignore` 中排除。
- 真实引擎的二进制由使用者从上游自行下载；项目不重新分发。
- 本地 API 只监听本机并做同源检查；不要把端口暴露到公网。

## 已知限制

- `McpEngine` 已在本地真实账号上做过 smoke test，但不在 CI 中覆盖真实网络调用。
- 未实现 `xhs-api` 备选引擎。
- 未实现封面渲染；目前草稿只接受本地图片路径/URL。
- 未实现通知/私信收件箱；只同步指定笔记的评论。
- 评论分类为关键词规则，不是模型分类。
- 本地 HTTP 目前做同源 + 127.0.0.1 检查，没有 per-install token；不要将端口暴露到公网。
- 小红书平台规则可能变化；使用前请复核 AI 虚拟人标识与 AI 内容标识要求。

## 许可证

MIT。第三方引擎 `xiaohongshu-mcp` 为 Apache-2.0；使用和分发时保留其许可证与 NOTICE。
