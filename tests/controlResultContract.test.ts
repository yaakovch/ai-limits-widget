import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAgentFleetControlResult, parseAgentFleetControlResultsFixtureJson } from '../src/shared/control-result-contract';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', 'contracts', name), 'utf8');

describe('canonical control result families', () => {
  it('accepts every shared result family', () => {
    const results = parseAgentFleetControlResultsFixtureJson(fixture('control-results-v1.json'));
    expect(results).toHaveLength(14);
    results.forEach((value) => assertAgentFleetControlResult(JSON.parse(JSON.stringify(value))));
  });

  it.each(['control-result-unknown-field-v1.json', 'control-result-content-field-v1.json'])(
    'rejects shared invalid result %s', (name) => {
      expect(() => assertAgentFleetControlResult(JSON.parse(fixture(name)))).toThrow('Invalid control result');
    }
  );

  it('rejects deterministic field, size, and nesting mutations', () => {
    const values = JSON.parse(fixture('control-results-v1.json')).results as Array<Record<string, unknown>>;
    for (const original of values) {
      const unknown = structuredClone(original); unknown.unexpected = true;
      expect(() => assertAgentFleetControlResult(unknown)).toThrow();
    }
    expect(() => assertAgentFleetControlResult({ rootName: 'x'.repeat(256 * 1024), relativePath: '', parentPath: null, entries: [], nextCursor: null, truncated: false })).toThrow();
    let nested: Record<string, unknown> = { unexpected: true };
    for (let index = 0; index < 18; index += 1) nested = { nested };
    expect(() => assertAgentFleetControlResult(nested)).toThrow('nesting');
  });

  it('requires the stable host runtime before session discovery', () => {
    const values = JSON.parse(fixture('control-results-v1.json')).results as Array<Record<string, unknown>>;
    const agent = structuredClone(values[0]);
    (agent.hostRuntime as Record<string, unknown>).entrypoint = 'private-helper';
    expect(() => assertAgentFleetControlResult(agent)).toThrow('stable host entrypoint');

    const bridge = { ...structuredClone(values[1]), hostRuntime: structuredClone(values[0].hostRuntime) };
    expect(() => assertAgentFleetControlResult(bridge)).toThrow('impersonate');
  });
});
