import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAgentFleetControlRequest, controlMethods, parseAgentFleetControlRequestJson } from '../src/shared/control-contract';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', 'contracts', name), 'utf8');

describe('canonical control v1 requests', () => {
  it('accepts exactly one shared request for every method', () => {
    const frames = JSON.parse(fixture('control-frames-v1.json')).frames as unknown[];
    const requests = frames.filter((value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && (value as Record<string, unknown>).type === 'request'
    );
    requests.forEach((request) => {
      assertAgentFleetControlRequest(request);
      assertAgentFleetControlRequest(JSON.parse(JSON.stringify(request)));
    });
    expect(new Set(requests.map((request) => request.method))).toEqual(new Set(controlMethods()));
    expect(parseAgentFleetControlRequestJson(JSON.stringify(requests[0])).method).toBe('fleet.snapshot');
  });

  it.each(['control-unknown-field-v1.json', 'control-content-field-v1.json'])(
    'rejects shared invalid request %s', (name) => {
      expect(() => parseAgentFleetControlRequestJson(fixture(name))).toThrow('Invalid control request');
    }
  );

  it('rejects deterministic field, revision, size, and nesting mutations', () => {
    const requests = JSON.parse(fixture('control-frames-v1.json')).frames.filter(
      (frame: Record<string, unknown>) => frame.type === 'request'
    ) as Array<Record<string, unknown>>;
    for (const request of requests) {
      const unknown = structuredClone(request); unknown.unexpected = true;
      expect(() => assertAgentFleetControlRequest(unknown)).toThrow();
    }
    const value = requests.find(
      (frame: Record<string, unknown>) => frame.method === 'directory.list'
    ) as any;
    delete value.params.idempotencyKey;
    expect(() => assertAgentFleetControlRequest(value)).toThrow();
    expect(() => parseAgentFleetControlRequestJson(' '.repeat(256 * 1024 + 1))).toThrow();
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 18; index += 1) nested = { nested };
    expect(() => assertAgentFleetControlRequest(nested)).toThrow('nesting');
  });
});
