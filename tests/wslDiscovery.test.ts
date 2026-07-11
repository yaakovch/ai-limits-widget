import { describe, expect, it } from 'vitest';
import { discoverWslProfiles, type WslDiscoveryRunner } from '../src/main/wsl-discovery';

describe('WSL discovery', () => {
  it('discovers profiles using fixed argument arrays', async () => {
    const calls: string[][] = [];
    const runner: WslDiscoveryRunner = async (args) => {
      calls.push(args);
      if (args[0] === '--list') return { status: 0, stdout: 'Ubuntu\r\n', stderr: '' };
      return {
        status: 0,
        stdout: 'user=testuser\nhome=/home/testuser\nexecutable=/usr/local/bin/codex\ncodexHome=/home/testuser/.codex\ncodexHome=/home/testuser/.codex-work\n',
        stderr: ''
      };
    };
    const result = await discoverWslProfiles(runner);
    expect(result.profiles.map((profile) => profile.codexHome)).toEqual([
      '/home/testuser/.codex',
      '/home/testuser/.codex-work'
    ]);
    expect(calls[1].slice(0, 4)).toEqual(['--distribution', 'Ubuntu', '--exec', 'sh']);
    expect(calls[1]).not.toContain('testuser');
  });

  it('returns an actionable result when WSL is unavailable', async () => {
    const result = await discoverWslProfiles(async () => ({ status: 1, stdout: '', stderr: 'WSL not installed' }));
    expect(result.wslAvailable).toBe(false);
    expect(result.warnings[0]).toContain('WSL not installed');
  });
});
