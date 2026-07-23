import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  reduceSupervisorState,
  SUPERVISOR_HEARTBEAT_TIMEOUT_MS,
  SUPERVISOR_MAX_FRAME_BYTES,
  SUPERVISOR_MAX_IN_FLIGHT_CONTROL,
  SUPERVISOR_MAX_QUEUED_CONTROL,
  SUPERVISOR_RECONNECT_DELAYS_MS,
  SUPERVISOR_REQUEST_DEADLINE_MS,
  type SupervisorAction,
  type SupervisorState
} from '../src/shared/supervisor-contract';

interface SupervisorFixture {
  contract: {
    maxFrameBytes: number;
    maxQueuedControl: number;
    maxInFlightControl: number;
    requestDeadlineMs: number;
    heartbeatTimeoutMs: number;
    reconnectDelaysMs: number[];
    channels: Array<{ id: string; failureDomain: string }>;
  };
  scenarios: Array<{
    id: string;
    initial: SupervisorState;
    steps: Array<{ action: SupervisorAction; expected: SupervisorState }>;
  }>;
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'tests', 'fixtures', 'contracts', 'supervisor-conformance-v1.json'), 'utf8')
) as SupervisorFixture;

describe('shared supervisor contract', () => {
  it('matches the canonical resource and queue budgets', () => {
    expect(fixture.contract).toMatchObject({
      maxFrameBytes: SUPERVISOR_MAX_FRAME_BYTES,
      maxQueuedControl: SUPERVISOR_MAX_QUEUED_CONTROL,
      maxInFlightControl: SUPERVISOR_MAX_IN_FLIGHT_CONTROL,
      requestDeadlineMs: SUPERVISOR_REQUEST_DEADLINE_MS,
      heartbeatTimeoutMs: SUPERVISOR_HEARTBEAT_TIMEOUT_MS,
      reconnectDelaysMs: [...SUPERVISOR_RECONNECT_DELAYS_MS]
    });
  });

  it('implements every canonical lifecycle scenario', () => {
    for (const scenario of fixture.scenarios) {
      let state = scenario.initial;
      for (const step of scenario.steps) {
        state = reduceSupervisorState(state, step.action);
        expect(state, `${scenario.id}:${step.action.type}`).toEqual(step.expected);
      }
    }
  });

  it('keeps non-control channel failures out of the control failure domain', () => {
    const channels = new Map(fixture.contract.channels.map((channel) => [channel.id, channel]));
    expect([...channels]).toHaveLength(6);
    expect(channels.get('control')?.failureDomain).toBe('supervisor');
    for (const id of ['conversation', 'terminal', 'transfer', 'diagnostics', 'update']) {
      expect(channels.get(id)?.failureDomain).not.toBe('supervisor');
    }
  });
});
