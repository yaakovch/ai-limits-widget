# Privacy

AI Limits Widget operates locally on the Windows computer where it is installed.

- No telemetry, analytics, crash reports, settings, or usage-limit data are sent to the project maintainer.
- The app invokes the locally installed Codex app-server inside WSL and reads a local Claude Code status-line cache.
- Authentication tokens are owned by Codex and Claude Code. The widget does not read, copy, log, export, or upload them.
- Settings exports include provider labels and configured WSL paths. They exclude authentication, usage caches, logs, window position, and Claude settings.
- Diagnostics archives are created only after an explicit user action and remain on the local filesystem until the user chooses to share them.
- Installed builds contact GitHub Releases to check for application updates. Portable and development builds do not install updates automatically.

Uninstall removes the app-owned Claude status-line hook when it is still unchanged. App data is retained unless the user explicitly chooses removal.
