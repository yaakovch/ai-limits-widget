import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  fleetConfigurationExport,
  parseFleetPairingBundle,
  type FleetPairingBundle
} from '../shared/fleet-configuration';
import { getWidgetDataDir } from './app-paths';

export interface FleetConfigurationActivation {
  status: 'activated' | 'unchanged';
  configurationRevision: number;
  previousRevision: number;
}

export class FleetConfigurationStore {
  readonly root: string;

  constructor(root = join(getWidgetDataDir(), 'fleet-configuration')) {
    this.root = root;
  }

  current(): FleetPairingBundle | null {
    return this.read('current.json');
  }

  previous(): FleetPairingBundle | null {
    return this.read('previous.json');
  }

  review(content: string): FleetPairingBundle {
    return parseFleetPairingBundle(content);
  }

  activate(content: string): FleetConfigurationActivation {
    const candidate = parseFleetPairingBundle(content);
    const current = this.current();
    if (current && candidate.configurationRevision < current.configurationRevision) {
      throw new Error('Fleet configuration is older than the last healthy revision');
    }
    if (current && candidate.configurationRevision === current.configurationRevision) {
      if (candidate.integrity.digest !== current.integrity.digest) {
        throw new Error('Fleet configuration revision was reused with different content');
      }
      return {
        status: 'unchanged',
        configurationRevision: current.configurationRevision,
        previousRevision: this.previous()?.configurationRevision ?? 0
      };
    }
    mkdirSync(this.root, { recursive: true });
    if (current) atomicWrite(join(this.root, 'previous.json'), fleetConfigurationExport(current));
    atomicWrite(join(this.root, 'current.json'), fleetConfigurationExport(candidate));
    return {
      status: 'activated',
      configurationRevision: candidate.configurationRevision,
      previousRevision: current?.configurationRevision ?? 0
    };
  }

  rollback(): FleetPairingBundle {
    const previous = this.previous();
    const current = this.current();
    if (!previous || !current) throw new Error('No previous healthy fleet configuration is available');
    atomicWrite(join(this.root, 'previous.json'), fleetConfigurationExport(current));
    atomicWrite(join(this.root, 'current.json'), fleetConfigurationExport(previous));
    return previous;
  }

  export(): string {
    const current = this.current();
    if (!current) throw new Error('No active fleet configuration is available');
    return fleetConfigurationExport(current);
  }

  private read(name: string): FleetPairingBundle | null {
    const path = join(this.root, name);
    return existsSync(path) ? parseFleetPairingBundle(readFileSync(path, 'utf8')) : null;
  }
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}
