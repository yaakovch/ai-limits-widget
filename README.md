# AI Limits Widget

AI Limits Widget is a local-only Windows desktop widget for comparing Codex and Claude Code 5-hour and weekly usage limits. It supports multiple Codex profiles under WSL, a transparent click-through desktop mode, safe settings transfer, and a tray-owned workflow.

## Requirements

- Windows 10 or 11, x64
- WSL with at least one Linux distribution for Codex profiles
- Codex installed inside the selected WSL distribution
- Claude Code for the optional Claude status-line integration

The app never reads, copies, exports, or uploads authentication tokens. See [PRIVACY.md](PRIVACY.md).

## Install And Setup

Download the signed Setup EXE from [GitHub Releases](https://github.com/yaakovch/ai-limits-widget/releases). The installer is per-user and does not require administrator rights. A portable EXE is also published; it stores configuration in `%APPDATA%\AI Limits Widget` but does not install updates or launch on login.

On first run, import a previously exported settings file or scan WSL. Discovery checks distribution names, the default Linux user and HOME, `command -v codex`, and top-level `.codex*` directories. Confirm and test profiles before finishing.

Claude integration is opt-in. The app explains the change, backs up `~/.claude/settings.json`, and refuses to replace an unrelated status line.

## Development

```powershell
npm ci
npm run dev
```

Verification and packaging:

```powershell
npm run lint
npm test
npm run build
npm run package:dir
npm run smoke:packaged
npm run package
npm run sbom
npm run finalize:release
```

The packaged artifacts are written to `dist/`. Public releases require Authenticode signing; local builds are intentionally unsigned.

## Settings Transfer

Settings → Import/Export transfers provider and widget configuration in a versioned JSON envelope. Imports are validated and previewed before replacement. The previous configuration is backed up and can be restored with Rollback. Usage caches, logs, window position, Claude settings, and authentication data are excluded.

## Release Process

Version tags must match `package.json`. GitHub Actions builds an unpacked app, submits it for SignPath open-source signing, packages the signed app, signs the final Setup/Portable artifacts, regenerates updater metadata and checksums, verifies signatures, and creates a draft release. See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete gate.
