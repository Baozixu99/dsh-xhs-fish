# Releasing

## 1. Create the public repository

Create a public GitHub repository (suggested: `dsh-xhs-fish`), then push this
sanitized directory as its root:

```powershell
git remote add origin https://github.com/Baozixu/dsh-xhs-fish.git
git push -u origin main
git push origin v0.1.0
```

Add the GitHub topic `dsh-plugin` to the repository.

## 2. Publish a release

Attach the prebuilt tarball to a GitHub Release:

```powershell
gh release create v0.1.0 .\dsh-xhs-fish-0.1.0.tgz `
  --title "dsh-xhs-fish v0.1.0" `
  --notes "First public release."
```

The repository also installs from source:

```powershell
dsh plugin --profile web add "github:Baozixu/dsh-xhs-fish"
```

## 3. Submit to the DSH plugin market

The market catalog is the curated `awesome-dsh-plugin` repository, not the
market app itself. Wait until the public repository is at least one day old
(CI enforces this), then open a PR there adding one file:

`data/plugins/Baozixu__dsh-xhs-fish.yml`

```yaml
url: https://github.com/Baozixu/dsh-xhs-fish
name: Baozixu/dsh-xhs-fish
category: workflow
description:
  en: 'Human-in-the-loop Xiaohongshu workbench for DSH: topics, drafts, compliance, approval, comment sync, and reply approval. The default mock engine never calls Xiaohongshu; external actions require explicit approval.'
  zh: 'DSH 内的小红书人机协作工作台：选题、草稿、合规检查、人工审批、评论同步与回复审批；默认 mock 引擎，不会访问小红书，外发必须显式审批。'
icon: https://raw.githubusercontent.com/Baozixu/dsh-xhs-fish/main/assets/icon-180.png
```

If a prebuilt tarball is attached, add:

```yaml
tarball: https://github.com/Baozixu/dsh-xhs-fish/releases/download/v0.1.0/dsh-xhs-fish-0.1.0.tgz
```

Do not edit the generated READMEs. The submission is one YAML file.

## 4. Verify

- `dsh plugin --profile web add "github:Baozixu/dsh-xhs-fish"` works on a clean
  profile.
- The Plugins page shows the localized title/description and the detail image.
- `node --test` passes; no account data or cookies are present in the repo.
- The market card loads the icon and the install command.

## Privacy checklist

- No `cookies.json`, `.xhs-home/`, browser profile, audit logs, approval
  records, test notes, screenshots from a live account, or personal paths.
- No binaries. `xiaohongshu-mcp` is downloaded by the user from upstream.
- Do not publish from a working directory that contains the live plugin data.
