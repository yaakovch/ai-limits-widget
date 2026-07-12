import { spawn, type ChildProcess } from 'node:child_process';

export interface FleetSessionOpenTarget {
  id: string;
  hostId: string;
  project: string;
  sessionName: string;
  label: string;
}

export interface FleetTerminalCommand {
  command: 'wt.exe';
  args: string[];
}

const SAFE_ID = /^[A-Za-z0-9._:-]{1,320}$/u;
const SAFE_SESSION = /^[A-Za-z0-9._-]{1,128}$/u;

export function buildFleetTerminalCommand(target: FleetSessionOpenTarget, distro: string): FleetTerminalCommand {
  if (!SAFE_ID.test(target.id) || !SAFE_ID.test(target.hostId)) throw new Error('Session identity is invalid');
  if (!SAFE_SESSION.test(target.sessionName)) throw new Error('Session name is invalid');
  if (!safeText(target.project, 256) || !safeText(target.label, 128) || !safeText(distro, 64)) {
    throw new Error('Session terminal metadata is invalid');
  }
  return {
    command: 'wt.exe',
    args: [
      'new-tab', '--title', target.label,
      'wsl.exe', '-d', distro, '--cd', '~', '--',
      '.local/bin/wtmux', '--host', target.hostId, '--project', target.project,
      '--session', target.sessionName, '--fast'
    ]
  };
}

export function openFleetTerminal(
  target: FleetSessionOpenTarget,
  distro: string,
  spawnProcess: typeof spawn = spawn
): Promise<void> {
  const launch = buildFleetTerminalCommand(target, distro);
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawnProcess(launch.command, launch.args, { detached: true, stdio: 'ignore', windowsHide: false });
    } catch (error) {
      reject(error);
      return;
    }
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
    child.once('error', reject);
  });
}

function safeText(value: string, maximum: number): boolean {
  return Boolean(value) && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
}
