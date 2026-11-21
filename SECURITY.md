# Security

## Local-only control plane

The workbench exposes a local HTTP API used by the DSH client. It binds to
loopback and checks same-origin/loopback requests, but it does not implement a
per-install token. Do not expose the port to a network, and do not run the
plugin on a shared host without an additional reverse-proxy control.

## Credentials and data

- Never commit `cookies.json`, browser profiles, account IDs, audit files,
  approval records, test notes, or logs.
- `bin/`, `.xhs-home/`, `cookies.json`, `demo-browser/`, and `tests/*.txt` are
  ignored by default.
- The optional `xiaohongshu-mcp` sidecar manages its own cookies. This plugin
  passes paths through environment variables and does not print them.

## External actions

Publishing and replying require a one-time approval plus `confirm=true`.
Fail-closed behavior is intentional: unknown results are recorded for manual
reconciliation, not retried automatically.

## Reporting

Open a private security advisory or contact the maintainer listed in the
repository profile. Do not open a public issue containing credentials, account
identifiers, or live post URLs.
