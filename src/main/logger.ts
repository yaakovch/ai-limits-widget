import log from 'electron-log/main';
import { join } from 'node:path';

export function configureLogger(dataDirectory: string): typeof log {
  log.transports.file.resolvePathFn = () => join(dataDirectory, 'logs', 'main.log');
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.level = 'info';
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.initialize({ spyRendererConsole: false });
  return log;
}

export function getLogPath(dataDirectory: string): string {
  return join(dataDirectory, 'logs', 'main.log');
}
