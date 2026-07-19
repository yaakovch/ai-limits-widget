import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { LocalSuggestionStore } from '../src/main/local-suggestion-store';

describe('local suggestion machine settings', () => {
  it('stays disabled by default and stores bearer tokens encoded outside exported settings', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'agent-fleet-local-')), 'local-suggestions.json');
    const codec = { encrypt: (value: string) => `encoded:${value}`, decrypt: (value: string) => value.replace('encoded:', '') };
    const store = new LocalSuggestionStore(path, codec);
    expect(store.view().mode).toBe('off');
    store.save({ ...store.view(), mode: 'automatic', backend: 'openAICompatible', external: { ...store.view().external, bearerToken: 'secret-token' } });
    expect(store.view().external.tokenConfigured).toBe(true);
    expect(store.token()).toBe('secret-token');
    const disk = readFileSync(path, 'utf8');
    expect(disk).not.toContain('"secret-token"');
    expect(disk).toContain('encoded:secret-token');
  });

  it('migrates the version 1 enabled flag to Manual without enabling Automatic', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'agent-fleet-local-')), 'local-suggestions.json');
    writeFileSync(path, JSON.stringify({
      version: 1, enabled: true, backend: 'managedLlamaCpp', managed: { executablePath: 'server', modelPath: 'model' },
      external: { baseUrl: 'http://127.0.0.1:8080', modelId: '', encryptedBearerToken: '' }
    }));
    const store = new LocalSuggestionStore(path, { encrypt: String, decrypt: String });
    expect(store.view()).toMatchObject({ version: 2, mode: 'manual' });
  });
});
