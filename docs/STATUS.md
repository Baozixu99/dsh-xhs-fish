# Status

This is a community DSH bundle, not an official Xiaohongshu or DeepSeek product.

## Implemented

- Mock engine by default: draft, compliance, approval, publish, comment sync, reply approval.
- Real engine adapter for `xiaohongshu-mcp` over local HTTP MCP.
- Human-in-the-loop only (L2): publish and reply require an approval id plus explicit confirmation.
- Local JSON/JSONL storage for drafts, approvals, posts, comments, replies, and audit.
- DSH web workbench and model-facing tools.
- Local API same-origin and loopback checks.

## Verified locally

- `node --test` passes the unit suite.
- `node scripts/doctor.mjs` exits 0.
- Real-engine smoke path was verified in a local test account: login, search, note detail, private publish, comment sync, reply, and manual reconciliation of an uncertain send. No account identifiers or platform URLs are included in this repository.

## Not included

- No account cookies, browser profile, logs, approval records, or test content.
- No `xiaohongshu-mcp` binaries; install them from the upstream release.
- No L3 automatic publishing.
- No multi-account matrix, auto DM, or unsolicited comments.
- No cover renderer or scheduler.

## Platform caveat

Xiaohongshu rules for AI-generated content and AI virtual characters can change. Review the current platform rules and keep the account profile label and AI content declaration accurate.
