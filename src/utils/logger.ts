import type { LogLevel } from '../types';

const PREFIXES: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

class Logger {
  private level: LogLevel = 'info';
  private timers = new Map<string, number>();

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(this.level)) return;

    const prefix = PREFIXES[level];
    const color = COLORS[level];
    const formatted = args.length > 0 ? `${message} ${args.map(a => JSON.stringify(a)).join(' ')}` : message;
    const output = `${color}${prefix}${RESET} ${formatted}`;

    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, ...args: unknown[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log('error', message, ...args);
  }

  time(label: string) {
    this.timers.set(label, performance.now());
  }

  timeEnd(label: string) {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.warn(`Timer "${label}" does not exist`);
      return;
    }
    const elapsed = performance.now() - start;
    this.info(`⏱ ${label}: ${elapsed.toFixed(2)}ms`);
    this.timers.delete(label);
  }

  divider() {
    this.info('─'.repeat(60));
  }
}

export const logger = new Logger();
