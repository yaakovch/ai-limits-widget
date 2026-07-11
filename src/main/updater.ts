import { EventEmitter } from 'node:events';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import type { UpdaterState } from '../shared/app';

const STARTUP_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface UpdateClient {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  logger: unknown;
  on(event: 'checking-for-update', listener: () => void): this;
  on(event: 'update-available' | 'update-not-available' | 'update-downloaded', listener: (info: UpdateInfo) => void): this;
  on(event: 'download-progress', listener: (progress: ProgressInfo) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

interface UpdaterManagerOptions {
  currentVersion: string;
  eligible: boolean;
  prerelease: boolean;
  client?: UpdateClient;
  logger?: unknown;
}

export class UpdaterManager extends EventEmitter {
  private readonly client: UpdateClient;
  private readonly eligible: boolean;
  private readonly currentVersion: string;
  private enabled = false;
  private startupTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private state: UpdaterState;

  constructor(options: UpdaterManagerOptions) {
    super();
    this.client = options.client ?? (electronUpdater.autoUpdater as unknown as UpdateClient);
    this.eligible = options.eligible;
    this.currentVersion = options.currentVersion;
    this.state = {
      status: options.eligible ? 'idle' : 'disabled',
      currentVersion: options.currentVersion,
      message: options.eligible ? undefined : 'Automatic updates are available in the installed app'
    };
    this.client.autoDownload = true;
    this.client.autoInstallOnAppQuit = true;
    this.client.allowPrerelease = options.prerelease;
    this.client.logger = options.logger ?? null;
    this.attachEvents();
  }

  getState(): UpdaterState {
    return { ...this.state };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled && this.eligible;
    this.clearTimers();
    if (!this.enabled) {
      this.setState({
        status: this.eligible ? 'disabled' : 'disabled',
        currentVersion: this.currentVersion,
        message: this.eligible ? 'Automatic update checks are disabled' : 'Automatic updates are available in the installed app'
      });
      return;
    }
    this.setState({ status: 'idle', currentVersion: this.currentVersion });
    this.startupTimer = setTimeout(() => void this.checkNow(), STARTUP_DELAY_MS);
    this.startupTimer.unref();
    this.intervalTimer = setInterval(() => void this.checkNow(), CHECK_INTERVAL_MS);
    this.intervalTimer.unref();
  }

  stop(): void {
    this.clearTimers();
  }

  async checkNow(): Promise<UpdaterState> {
    if (!this.eligible) return this.getState();
    try {
      await this.client.checkForUpdates();
    } catch (error) {
      this.setState({
        status: 'error',
        currentVersion: this.currentVersion,
        message: formatUpdateError(error)
      });
    }
    return this.getState();
  }

  restartToUpdate(): void {
    if (this.state.status === 'downloaded') this.client.quitAndInstall(false, true);
  }

  private attachEvents(): void {
    this.client.on('checking-for-update', () => this.setState({ status: 'checking', currentVersion: this.currentVersion }));
    this.client.on('update-available', (info) =>
      this.setState({ status: 'available', currentVersion: this.currentVersion, availableVersion: info.version })
    );
    this.client.on('update-not-available', () =>
      this.setState({ status: 'up-to-date', currentVersion: this.currentVersion, message: 'AI Limits Widget is up to date' })
    );
    this.client.on('download-progress', (progress) =>
      this.setState({
        status: 'downloading',
        currentVersion: this.currentVersion,
        availableVersion: this.state.availableVersion,
        progressPercent: Math.max(0, Math.min(100, progress.percent))
      })
    );
    this.client.on('update-downloaded', (info) =>
      this.setState({
        status: 'downloaded',
        currentVersion: this.currentVersion,
        availableVersion: info.version,
        progressPercent: 100,
        message: 'Update downloaded. Restart when convenient.'
      })
    );
    this.client.on('error', (error) =>
      this.setState({ status: 'error', currentVersion: this.currentVersion, message: formatUpdateError(error) })
    );
  }

  private setState(state: UpdaterState): void {
    this.state = state;
    this.emit('changed', this.getState());
  }

  private clearTimers(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.startupTimer = null;
    this.intervalTimer = null;
  }
}

function formatUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b404\b/.test(message)) return 'No published update feed is available yet.';
  const firstLine = message.split(/\r?\n/, 1)[0].trim();
  return firstLine.slice(0, 240) || 'Update check failed';
}
