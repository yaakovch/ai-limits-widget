import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getWidgetDataDir } from './app-paths';

export interface ClaudeStatusLinePaths {
  sourceScript: string;
  targetScript: string;
  settingsPath: string;
}

export interface ClaudeStatusLineInstallResult {
  status: 'ready' | 'installed' | 'updated' | 'removed' | 'missing' | 'conflict';
  message: string;
}

interface ClaudeSettings {
  statusLine?: {
    type?: string;
    command?: string;
    refreshInterval?: number;
    padding?: number;
  };
  [key: string]: unknown;
}

const SCRIPT_NAME = 'claude-statusline.ps1';

export function getClaudeStatusLinePaths(resourceRoot: string, dataDir = getWidgetDataDir()): ClaudeStatusLinePaths {
  const userProfile = process.env.USERPROFILE ?? process.env.HOME;
  if (!userProfile) throw new Error('Cannot resolve the user profile directory.');
  return {
    sourceScript: join(resourceRoot, 'scripts', SCRIPT_NAME),
    targetScript: join(dataDir, SCRIPT_NAME),
    settingsPath: join(userProfile, '.claude', 'settings.json')
  };
}

export function buildClaudeStatusLineCommand(targetScript: string): string {
  const commandPath = targetScript.replaceAll('\\', '/');
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${commandPath}"`;
}

export function isLimitsWidgetStatusLine(command: string | undefined): boolean {
  if (!command) return false;
  const normalized = command.replaceAll('\\', '/').toLowerCase();
  return (
    normalized.endsWith(`/${SCRIPT_NAME.toLowerCase()}"`) &&
    (normalized.includes('/limits-widget/') || normalized.includes('/ai limits widget/'))
  );
}

export function ensureClaudeStatusLineInstalled(
  paths: ClaudeStatusLinePaths,
  now = new Date()
): ClaudeStatusLineInstallResult {
  if (!existsSync(paths.sourceScript)) throw new Error(`Claude status-line source is missing: ${paths.sourceScript}`);

  const settings = readSettings(paths.settingsPath);
  const existingCommand = settings.statusLine?.command;
  const expectedCommand = buildClaudeStatusLineCommand(paths.targetScript);
  if (existingCommand && !isLimitsWidgetStatusLine(existingCommand)) {
    return { status: 'conflict', message: 'Claude Code already has a different status line configured' };
  }

  mkdirSync(dirname(paths.targetScript), { recursive: true });
  mkdirSync(dirname(paths.settingsPath), { recursive: true });
  copyFileSync(paths.sourceScript, paths.targetScript);

  if (
    existingCommand === expectedCommand &&
    settings.statusLine?.type === 'command' &&
    settings.statusLine.refreshInterval === 60
  ) {
    return { status: 'ready', message: 'Claude status-line collector is installed' };
  }

  const existed = existsSync(paths.settingsPath);
  if (existed) backupClaudeSettings(paths.settingsPath, now);
  settings.statusLine = {
    type: 'command',
    command: expectedCommand,
    refreshInterval: 60,
    padding: 0
  };
  writeSettings(paths.settingsPath, settings);
  return {
    status: existed ? 'updated' : 'installed',
    message: existed ? 'Claude status-line collector was updated' : 'Claude status-line collector was installed'
  };
}

export function removeClaudeStatusLine(paths: ClaudeStatusLinePaths, now = new Date()): ClaudeStatusLineInstallResult {
  const settings = readSettings(paths.settingsPath);
  const command = settings.statusLine?.command;
  if (command && !isLimitsWidgetStatusLine(command)) {
    return { status: 'conflict', message: 'Claude Code is using a different status line; no settings were changed' };
  }
  if (!command && !existsSync(paths.targetScript)) {
    return { status: 'missing', message: 'Claude status-line collector is not installed' };
  }
  if (existsSync(paths.settingsPath) && command) {
    backupClaudeSettings(paths.settingsPath, now);
    delete settings.statusLine;
    writeSettings(paths.settingsPath, settings);
  }
  rmSync(paths.targetScript, { force: true });
  return { status: 'removed', message: 'Claude status-line collector was removed' };
}

export function inspectClaudeStatusLineInstallation(
  targetScript = join(getWidgetDataDir(), SCRIPT_NAME),
  settingsPath = getDefaultClaudeSettingsPath()
): ClaudeStatusLineInstallResult {
  if (!existsSync(settingsPath)) return { status: 'missing', message: 'Claude collector is not installed' };
  try {
    const settings = readSettings(settingsPath);
    const command = settings.statusLine?.command;
    if (!command) return { status: 'missing', message: 'Claude collector is not installed' };
    if (!isLimitsWidgetStatusLine(command)) {
      return { status: 'conflict', message: 'Claude Code is using a different status line' };
    }
    if (buildClaudeStatusLineCommand(targetScript) !== command || !existsSync(targetScript)) {
      return { status: 'missing', message: 'Claude collector needs to be installed or repaired for this app' };
    }
    return { status: 'ready', message: 'Claude status-line collector is installed' };
  } catch (error) {
    return { status: 'conflict', message: error instanceof Error ? error.message : String(error) };
  }
}

function getDefaultClaudeSettingsPath(): string {
  const userProfile = process.env.USERPROFILE ?? process.env.HOME ?? '.';
  return join(userProfile, '.claude', 'settings.json');
}

function backupClaudeSettings(settingsPath: string, now: Date): void {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  copyFileSync(settingsPath, `${settingsPath}.ai-limits-widget-backup-${stamp}`);
}

function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) return {};
  const raw = readFileSync(settingsPath, 'utf8').trim();
  return raw ? (JSON.parse(raw) as ClaudeSettings) : {};
}

function writeSettings(settingsPath: string, settings: ClaudeSettings): void {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}
