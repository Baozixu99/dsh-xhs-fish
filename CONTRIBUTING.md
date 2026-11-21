# Contributing

This is a community DSH bundle. Keep it safe-by-default.

## Rules

- Never commit cookies, browser profiles, account IDs, audit logs, approval
  records, test notes, or screenshots from a live account.
- Use the mock engine in tests. Real-engine tests must not run in CI.
- Keep the L2 human-approval boundary. Do not add automatic publish or reply
  paths without an explicit approval and `confirm=true`.
- Do not add bulk account management, auto DMs, unsolicited comments, or
  captcha bypasses.
- If you change the package metadata, locales, detail document, or icon, check
  the packed file list with `npm pack --dry-run`.

## Development

```powershell
node --test
node scripts/doctor.mjs
```

The unit suite does not call Xiaohongshu. The optional `xiaohongshu-mcp`
sidecar is downloaded separately and is licensed under Apache-2.0.
