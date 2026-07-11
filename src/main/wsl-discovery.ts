import { spawn } from 'node:child_process';
import type { CodexProfileSettings } from '../shared/settings';
import type { WslDiscoveryResult, WslDistributionDiscovery } from '../shared/app';

export interface WslDiscoveryRunner {
  (args: string[], timeoutMs: number): Promise<{ status: number | null; stdout: string; stderr: string; error?: Error }>;
}

const DISCOVERY_SCRIPT = [
  "printf 'user=%s\\n' \"$(id -un 2>/dev/null)\"",
  "printf 'home=%s\\n' \"$HOME\"",
  "printf 'executable=%s\\n' \"$(command -v codex 2>/dev/null || true)\"",
  "for dir in \"$HOME\"/.codex*; do [ -d \"$dir\" ] && printf 'codexHome=%s\\n' \"$dir\"; done"
].join('; ');

export async function discoverWslProfiles(runner: WslDiscoveryRunner = runWslDiscovery): Promise<WslDiscoveryResult> {
  const list = await runner(['--list', '--quiet'], 5000);
  if (list.error || list.status !== 0) {
    return {
      wslAvailable: false,
      distributions: [],
      profiles: [],
      warnings: [(list.error?.message || list.stderr || 'WSL is not available').trim()]
    };
  }

  const distroNames = list.stdout
    .replaceAll('\0', '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const distributions: WslDistributionDiscovery[] = [];
  for (const name of distroNames) distributions.push(await discoverDistribution(name, runner));
  const warnings = distributions.filter((item) => item.error).map((item) => `${item.name}: ${item.error}`);
  const profiles: CodexProfileSettings[] = [];

  for (const distro of distributions) {
    for (const codexHome of distro.codexHomes) {
      const base = codexHome.split('/').filter(Boolean).at(-1) ?? 'codex';
      const idBase = `${distro.name}-${base}`.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
      let id = idBase;
      let suffix = 2;
      while (profiles.some((profile) => profile.id === id)) id = `${idBase}-${suffix++}`;
      profiles.push({
        id,
        label: `${distro.name} ${base}`,
        enabled: true,
        order: profiles.length,
        distro: distro.name,
        user: distro.user,
        home: distro.home,
        codexHome,
        executable: distro.executable
      });
    }
  }

  if (distroNames.length === 0) warnings.push('No WSL distributions were found.');
  if (profiles.length === 0 && distroNames.length > 0) warnings.push('No .codex profile directories were found.');
  return { wslAvailable: true, distributions, profiles, warnings };
}

async function discoverDistribution(name: string, runner: WslDiscoveryRunner): Promise<WslDistributionDiscovery> {
  const result = await runner(['--distribution', name, '--exec', 'sh', '-lc', DISCOVERY_SCRIPT], 8000);
  if (result.error || result.status !== 0) {
    return { name, user: '', home: '', executable: '', codexHomes: [], error: (result.error?.message || result.stderr || 'Discovery failed').trim() };
  }
  const values = new Map<string, string[]>();
  for (const line of result.stdout.replaceAll('\0', '').split(/\r?\n/)) {
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals);
    const value = line.slice(equals + 1).trim();
    if (!value) continue;
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  return {
    name,
    user: values.get('user')?.[0] ?? '',
    home: values.get('home')?.[0] ?? '',
    executable: values.get('executable')?.[0] ?? '',
    codexHomes: values.get('codexHome') ?? []
  };
}

function runWslDiscovery(args: string[], timeoutMs: number): ReturnType<WslDiscoveryRunner> {
  return new Promise((resolve) => {
    const child = spawn('wsl.exe', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: { status: number | null; error?: Error }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ status: null, error: new Error('WSL discovery timed out') });
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (error) => finish({ status: null, error }));
    child.on('close', (status) => finish({ status }));
  });
}
