import { describe, expect, it } from 'vitest';
import {
  formatCodexError,
  getWslCodexLaunch,
  mapCodexWindows
} from '../src/main/collectors/codex';

describe('mapCodexWindows', () => {
  it('maps 300-minute and 10080-minute windows to 5h and weekly', () => {
    const windows = mapCodexWindows({
      primary: { usedPercent: 25, resetsAt: 2000, windowDurationMins: 300 },
      secondary: { usedPercent: 60, resetsAt: 9000, windowDurationMins: 10080 }
    });

    expect(windows.fiveHour?.usedPercent).toBe(25);
    expect(windows.fiveHour?.remainingPercent).toBe(75);
    expect(windows.weekly?.usedPercent).toBe(60);
    expect(windows.weekly?.remainingPercent).toBe(40);
  });

  it('falls back to primary as 5h and secondary as weekly when duration is missing', () => {
    const windows = mapCodexWindows({
      primary: { usedPercent: 10, resetsAt: null, windowDurationMins: null },
      secondary: { usedPercent: 90, resetsAt: null, windowDurationMins: null }
    });

    expect(windows.fiveHour?.usedPercent).toBe(10);
    expect(windows.weekly?.usedPercent).toBe(90);
  });

  it('builds an explicit WSL launch without relying on inherited HOME', () => {
    expect(getWslCodexLaunch({
      id: 'profile-1',
      label: 'Profile 1',
      distro: 'Ubuntu',
      user: 'testuser',
      home: '/home/testuser',
      codexHome: '/home/testuser/.codex-work',
      executable: '/home/testuser/.local/bin/codex'
    })).toEqual({
      command: 'wsl.exe',
      args: [
        '-d',
        'Ubuntu',
        '-u',
        'testuser',
        '--exec',
        'env',
        'HOME=/home/testuser',
        'CODEX_HOME=/home/testuser/.codex-work',
        '/home/testuser/.local/bin/codex',
        'app-server',
        '--stdio'
      ]
    });
  });

  it('turns an invalidated token response into a concise diagnostic', () => {
    expect(formatCodexError(new Error('401 Unauthorized: token_invalidated'))).toBe(
      'Sign in required (authentication token invalidated)'
    );
  });
});
