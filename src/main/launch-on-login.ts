import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SHORTCUT_NAME = 'AI Limits Widget.lnk';

export function getStartupShortcutPath(): string {
  const appData = process.env.APPDATA ?? join(process.env.USERPROFILE ?? '.', 'AppData', 'Roaming');
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', SHORTCUT_NAME);
}

export function setLaunchOnLogin(enabled: boolean, appRoot: string, shortcutPath = getStartupShortcutPath()): void {
  if (!enabled) {
    rmSync(shortcutPath, { force: true });
    return;
  }

  mkdirSync(dirname(shortcutPath), { recursive: true });
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', buildShortcutScript(shortcutPath, appRoot)], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Could not create startup shortcut').trim());
}

export function isLaunchOnLoginEnabled(shortcutPath = getStartupShortcutPath()): boolean {
  return existsSync(shortcutPath);
}

export function buildShortcutScript(shortcutPath: string, appRoot: string): string {
  const escapedShortcut = escapePowerShellSingleQuoted(shortcutPath);
  const escapedRoot = escapePowerShellSingleQuoted(appRoot);
  const command = `Set-Location -LiteralPath '${escapedRoot}'; npm run dev`;
  const argumentsText = `-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "${command.replaceAll('"', '\\"')}"`;

  return [
    `$shortcutPath = '${escapedShortcut}'`,
    `$workingDirectory = '${escapedRoot}'`,
    '$shell = New-Object -ComObject WScript.Shell',
    '$shortcut = $shell.CreateShortcut($shortcutPath)',
    "$shortcut.TargetPath = 'powershell.exe'",
    `$shortcut.Arguments = '${escapePowerShellSingleQuoted(argumentsText)}'`,
    '$shortcut.WorkingDirectory = $workingDirectory',
    "$shortcut.Description = 'AI Limits Widget'",
    '$shortcut.WindowStyle = 7',
    '$shortcut.Save()'
  ].join('\n');
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replaceAll("'", "''");
}
