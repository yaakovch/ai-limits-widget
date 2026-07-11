import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  STALE_AFTER_MS,
  createLimitWindow,
  type LimitWindowSnapshot,
  type ProviderLimitSnapshot
} from '../../shared/limits';
import { inspectClaudeStatusLineInstallation, type ClaudeStatusLineInstallResult } from '../claude-statusline-install';
import { getWidgetDataDir } from '../app-paths';

interface ClaudeCacheFile {
  version: 1;
  provider: 'claude';
  source: 'claude-statusline';
  fetchedAt: number;
  windows: {
    fiveHour?: LimitWindowSnapshot;
    weekly?: LimitWindowSnapshot;
  };
}

interface ClaudeStatusLineInput {
  rate_limits?: {
    five_hour?: {
      used_percentage?: number;
      resets_at?: number;
    };
    seven_day?: {
      used_percentage?: number;
      resets_at?: number;
    };
  };
}

export interface ClaudeRuntimeInfo {
  runningProcessCount: number;
  runningProcessStartedBeforeStatusLineInstall: boolean;
  oldestProcessStartTimeMs: number | null;
  statusLineSettingsMtimeMs: number | null;
}

interface ClaudeProcessInfo {
  id: number;
  startTimeMs: number | null;
}

export interface ClaudeCollectorOptions {
  nowMs?: number;
  staleAfterMs?: number;
  inspectInstallation?: () => ClaudeStatusLineInstallResult | null;
  runtimeInfo?: ClaudeRuntimeInfo | (() => ClaudeRuntimeInfo | null) | null;
}

export function getClaudeCachePath(): string {
  return join(getWidgetDataDir(), 'claude-limits.json');
}

export function collectClaudeLimits(cachePath = getClaudeCachePath(), options: ClaudeCollectorOptions = {}): ProviderLimitSnapshot {
  if (!existsSync(cachePath)) {
    const installation = inspectClaudeStatusLineInstallation();
    return {
      id: 'claude',
      provider: 'claude',
      label: 'Claude Code',
      status: 'unavailable',
      source: 'claude statusline cache',
      fetchedAt: null,
      message:
        installation.status === 'ready'
          ? 'Collector ready. Restart Claude Code, then complete one response'
          : installation.message,
      windows: {}
    };
  }

  try {
    const raw = readFileSync(cachePath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw) as ClaudeCacheFile;
    return withClaudeFreshness(mapClaudeCache(parsed), cachePath, options);
  } catch (error) {
    return {
      id: 'claude',
      provider: 'claude',
      label: 'Claude Code',
      status: 'error',
      source: 'claude statusline cache',
      fetchedAt: Math.floor(Date.now() / 1000),
      message: error instanceof Error ? error.message : String(error),
      windows: {}
    };
  }
}

export function mapClaudeCache(cache: ClaudeCacheFile): ProviderLimitSnapshot {
  return {
    id: 'claude',
    provider: 'claude',
    label: 'Claude Code',
    status: cache.windows.fiveHour || cache.windows.weekly ? 'ok' : 'unavailable',
    source: cache.source,
    fetchedAt: cache.fetchedAt,
    message: cache.windows.fiveHour || cache.windows.weekly ? undefined : 'Claude status line has not provided rate limits yet',
    windows: cache.windows
  };
}

function withClaudeFreshness(
  snapshot: ProviderLimitSnapshot,
  cachePath: string,
  options: ClaudeCollectorOptions
): ProviderLimitSnapshot {
  if (snapshot.status !== 'ok' || snapshot.fetchedAt === null) return snapshot;

  const nowMs = options.nowMs ?? Date.now();
  const ageMs = nowMs - snapshot.fetchedAt * 1000;
  if (ageMs <= (options.staleAfterMs ?? STALE_AFTER_MS)) return snapshot;

  const canInspectLocalRuntime = isDefaultClaudeCachePath(cachePath);
  const installation =
    options.inspectInstallation?.() ?? (canInspectLocalRuntime ? inspectClaudeStatusLineInstallation() : null);
  const runtimeInfo = resolveRuntimeInfo(options, canInspectLocalRuntime);

  return {
    ...snapshot,
    status: 'stale',
    message: formatClaudeStaleMessage(ageMs, installation, runtimeInfo)
  };
}

function resolveRuntimeInfo(
  options: ClaudeCollectorOptions,
  canInspectLocalRuntime: boolean
): ClaudeRuntimeInfo | null {
  if (typeof options.runtimeInfo === 'function') return options.runtimeInfo();
  if (options.runtimeInfo !== undefined) return options.runtimeInfo;
  return canInspectLocalRuntime ? inspectClaudeRuntimeInfo() : null;
}

function formatClaudeStaleMessage(
  ageMs: number,
  installation: ClaudeStatusLineInstallResult | null,
  runtimeInfo: ClaudeRuntimeInfo | null
): string {
  const ageMinutes = Math.max(1, Math.round(ageMs / 60000));
  const prefix = `Last update was ${ageMinutes} minutes ago.`;

  if (installation && installation.status !== 'ready') {
    return `${prefix} ${installation.message}`;
  }

  if (runtimeInfo?.runningProcessStartedBeforeStatusLineInstall) {
    const session = runtimeInfo.runningProcessCount === 1 ? 'session' : 'sessions';
    return `${prefix} Restart Claude Code; running ${session} started before the status-line collector was installed.`;
  }

  if (runtimeInfo?.runningProcessCount === 0) {
    return `${prefix} Start Claude Code, then complete one response to refresh.`;
  }

  return `${prefix} Complete one Claude Code response to refresh.`;
}

export function inspectClaudeRuntimeInfo(settingsPath = getClaudeSettingsPath()): ClaudeRuntimeInfo {
  const statusLineSettingsMtimeMs = getFileMtimeMs(settingsPath);
  const processes = listRunningClaudeProcesses();
  const startTimes = processes
    .map((process) => process.startTimeMs)
    .filter((startTime): startTime is number => typeof startTime === 'number');

  return {
    runningProcessCount: processes.length,
    runningProcessStartedBeforeStatusLineInstall:
      statusLineSettingsMtimeMs !== null && startTimes.some((startTime) => startTime < statusLineSettingsMtimeMs),
    oldestProcessStartTimeMs: startTimes.length > 0 ? Math.min(...startTimes) : null,
    statusLineSettingsMtimeMs
  };
}

function listRunningClaudeProcesses(): ClaudeProcessInfo[] {
  if (process.platform !== 'win32') return [];

  const command = [
    '$processes = Get-Process -Name claude -ErrorAction SilentlyContinue | ForEach-Object {',
    '  [pscustomobject]@{ Id = $_.Id; StartTime = $_.StartTime.ToUniversalTime().ToString("o") }',
    '}',
    '$processes | ConvertTo-Json -Compress'
  ].join('\n');

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      encoding: 'utf8',
      timeout: 2000,
      windowsHide: true
    }
  );
  const output = result.stdout.trim();
  if (result.error || result.status !== 0 || !output) return [];

  try {
    const parsed = JSON.parse(output) as PowerShellClaudeProcess | PowerShellClaudeProcess[];
    if (!parsed) return [];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .map((entry) => {
        const id = Number(entry.Id);
        const startTimeMs = typeof entry.StartTime === 'string' ? Date.parse(entry.StartTime) : Number.NaN;
        return {
          id,
          startTimeMs: Number.isFinite(startTimeMs) ? startTimeMs : null
        };
      })
      .filter((process) => Number.isFinite(process.id));
  } catch {
    return [];
  }
}

interface PowerShellClaudeProcess {
  Id?: unknown;
  StartTime?: unknown;
}

function getClaudeSettingsPath(): string {
  const userProfile = process.env.USERPROFILE ?? process.env.HOME ?? '.';
  return join(userProfile, '.claude', 'settings.json');
}

function getFileMtimeMs(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function isDefaultClaudeCachePath(cachePath: string): boolean {
  return cachePath.toLowerCase() === getClaudeCachePath().toLowerCase();
}

export function mapClaudeStatusLineInput(input: ClaudeStatusLineInput, fetchedAt: number): ClaudeCacheFile | null {
  const rateLimits = input.rate_limits;
  if (!rateLimits?.five_hour && !rateLimits?.seven_day) return null;

  return {
    version: 1,
    provider: 'claude',
    source: 'claude-statusline',
    fetchedAt,
    windows: {
      ...(rateLimits.five_hour
        ? {
            fiveHour: createLimitWindow(
              'fiveHour',
              rateLimits.five_hour.used_percentage ?? null,
              rateLimits.five_hour.resets_at ?? null,
              300
            )
          }
        : {}),
      ...(rateLimits.seven_day
        ? {
            weekly: createLimitWindow(
              'weekly',
              rateLimits.seven_day.used_percentage ?? null,
              rateLimits.seven_day.resets_at ?? null,
              10080
            )
          }
        : {})
    }
  };
}
