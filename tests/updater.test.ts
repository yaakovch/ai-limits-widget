import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { UpdaterManager, type UpdateClient } from '../src/main/updater';

class FakeUpdateClient extends EventEmitter implements UpdateClient {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  allowPrerelease = false;
  logger: unknown = null;
  checkForUpdates = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
}

describe('updater manager', () => {
  it('disables automatic updates for ineligible builds', async () => {
    const client = new FakeUpdateClient();
    const updater = new UpdaterManager({ currentVersion: '1.0.0', eligible: false, prerelease: false, client });
    updater.setEnabled(true);
    expect(updater.getState().status).toBe('disabled');
    await updater.checkNow();
    expect(client.checkForUpdates).not.toHaveBeenCalled();
  });

  it('tracks download progress and restarts only after download', () => {
    const client = new FakeUpdateClient();
    const updater = new UpdaterManager({ currentVersion: '0.9.0', eligible: true, prerelease: true, client });
    client.emit('update-available', { version: '1.0.0' });
    client.emit('download-progress', { percent: 42 });
    expect(updater.getState()).toMatchObject({ status: 'downloading', progressPercent: 42 });
    updater.restartToUpdate();
    expect(client.quitAndInstall).not.toHaveBeenCalled();
    client.emit('update-downloaded', { version: '1.0.0' });
    updater.restartToUpdate();
    expect(client.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('redacts verbose update feed errors before exposing them to the UI', () => {
    const client = new FakeUpdateClient();
    const updater = new UpdaterManager({ currentVersion: '0.9.0', eligible: true, prerelease: true, client });
    client.emit('error', new Error('HTTP 404\nheaders: authorization=secret'));
    expect(updater.getState()).toMatchObject({
      status: 'error',
      message: 'No published update feed is available yet.'
    });
  });
});
