import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HOST_RUNTIME_RECOVERY,
  hostRuntimeRecovery
} from '../src/shared/host-runtime-contract';

const fixture = JSON.parse(readFileSync(
  resolve('tests/fixtures/contracts/host-runtime-conformance-v1.json'),
  'utf8'
)) as {
  entrypoint: string;
  apiVersion: number;
  channels: Array<{ id: string; privacy: string; maxConcurrent: number }>;
  operations: Array<{ id: string; mutationBinding: string }>;
  resourceBudgets: Record<string, number>;
  errors: Array<{ code: keyof typeof HOST_RUNTIME_RECOVERY; publicTitle: string; recoveryAction: string }>;
  sessionIndex: { state: string; authority: string; reason: string; killSwitch: string };
};

describe('stable host runtime contract', () => {
  it('uses one public entrypoint with isolated bounded channels', () => {
    expect(fixture).toMatchObject({ entrypoint: 'wtmux-host-runtime', apiVersion: 1 });
    expect(fixture.channels.map((channel) => channel.id)).toEqual([
      'control', 'conversation', 'terminal', 'transfer', 'repository'
    ]);
    expect(fixture.channels.find((channel) => channel.id === 'control')).toMatchObject({
      privacy: 'metadata-only', maxConcurrent: 1
    });
    expect(fixture.resourceBudgets).toMatchObject({
      maxInFlightControl: 1,
      maxChildProcessesPerControl: 1,
      maxHelperOutputBytes: 262144,
      maxHelperErrorBytes: 8192
    });
  });

  it('implements every canonical error with the same public recovery', () => {
    expect(new Set(fixture.errors.map((error) => error.code))).toEqual(
      new Set(Object.keys(HOST_RUNTIME_RECOVERY))
    );
    for (const error of fixture.errors) {
      const recovery = hostRuntimeRecovery(error.code);
      expect(recovery?.title).toBe(error.publicTitle);
      expect(recovery?.action).toBeTruthy();
    }
  });

  it('binds mutations and rejects the session-index prototype', () => {
    const operations = Object.fromEntries(fixture.operations.map((operation) => [operation.id, operation]));
    expect(operations.session.mutationBinding).toBe('revision-and-idempotency');
    expect(operations['model-control'].mutationBinding).toBe('config-revision-and-idempotency');
    expect(operations.conversation.mutationBinding).toBe('provider-revision-and-idempotency');
    expect(fixture.sessionIndex).toEqual({
      state: 'rejected',
      authority: 'tmux',
      reason: 'NO_MATERIAL_RECOVERY_VALUE',
      killSwitch: 'WTMUX_SESSION_INDEX'
    });
  });
});
