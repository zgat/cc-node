/**
 * Bun API compatibility layer for Node.js
 *
 * This module provides polyfills for Bun-specific APIs when running under Node.js.
 */

import { createHash, randomUUID } from 'crypto';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { createServer, type Server, type Socket } from 'net';
import type { Readable, Writable } from 'stream';
import { readFile, writeFile } from 'fs/promises';
import YAML from 'yaml';
import * as semverLib from 'semver';
import { bunHash, bunHashString } from '../utils/bun-compat.ts';

const execFileAsync = promisify(execFile);

/**
 * Check if running in Bun environment
 */
export const isBun = typeof (globalThis as any).Bun !== 'undefined';

/**
 * Hash function - replaces bunHash()
 * Uses Node's crypto module for cross-platform compatibility
 */
export function bunHash(input: string | Buffer | ArrayBufferView, seed?: number | bigint): bigint {
  const hasher = createHash('sha256');

  if (typeof input === 'string') {
    hasher.update(input, 'utf-8');
  } else if (Buffer.isBuffer(input)) {
    hasher.update(input);
  } else if (ArrayBuffer.isView(input)) {
    hasher.update(Buffer.from(input.buffer, input.byteOffset, input.byteLength));
  }

  const hashHex = hasher.digest('hex');
  // Convert to bigint and apply seed if provided
  let hash = BigInt('0x' + hashHex.slice(0, 16));
  if (seed !== undefined) {
    hash = hash ^ BigInt(seed);
  }
  return hash;
}

/**
 * Compute hash as string
 */
export function bunHashString(input: string | Buffer | ArrayBufferView): string {
  return bunHash(input).toString();
}

/**
 * Which command - replaces Bun.which()
 * Uses 'which' command on Unix, 'where' on Windows
 */
export async function bunWhich(command: string): Promise<string | null> {
  const isWindows = process.platform === 'win32';
  const whichCmd = isWindows ? 'where' : 'which';

  try {
    const { stdout } = await execFileAsync(whichCmd, [command]);
    const result = stdout.trim().split('\n')[0];
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Synchronous version of which
 */
export function bunWhichSync(command: string): string | null {
  const isWindows = process.platform === 'win32';
  const whichCmd = isWindows ? 'where' : 'which';

  try {
    const { stdout } = require('child_process').execFileSync(whichCmd, [command], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Parse YAML - replaces bunYamlParse()
 */
export function bunYamlParse<T = unknown>(input: string): T {
  return YAML.parse(input) as T;
}

/**
 * Stringify YAML - replaces bunYamlStringify()
 */
export function bunYamlStringify(value: unknown): string {
  return YAML.stringify(value);
}

/**
 * Spawn process - replaces Bun.spawn()
 * Returns a child process with similar interface
 */
export interface BunSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'inherit' | 'pipe' | null;
  stdout?: 'inherit' | 'pipe' | null;
  stderr?: 'inherit' | 'pipe' | null;
  argv0?: string;
}

export interface BunSubprocess {
  pid: number;
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  exited: Promise<number>;
  kill(signal?: number | string): boolean;
}

export function bunSpawn(
  command: string[],
  options: BunSpawnOptions = {}
): BunSubprocess {
  const [cmd, ...args] = command;
  const { cwd, env, stdin, stdout, stderr, argv0 } = options;

  const child = spawn(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    stdio: [
      stdin === 'inherit' ? 'inherit' : stdin === 'pipe' ? 'pipe' : 'ignore',
      stdout === 'inherit' ? 'inherit' : stdout === 'pipe' ? 'pipe' : 'ignore',
      stderr === 'inherit' ? 'inherit' : stderr === 'pipe' ? 'pipe' : 'ignore'
    ],
    argv0,
  });

  const exited = new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });

  return {
    pid: child.pid!,
    stdin: child.stdin,
    stdout: child.stdout,
    stderr: child.stderr,
    exited,
    kill: (signal?: number | string) => child.kill(signal as any),
  };
}

/**
 * Listen for connections - replaces Bun.listen()
 * Uses Node's net.createServer
 */
export interface BunListenOptions<T> {
  hostname?: string;
  port: number;
  socket: {
    data(socket: T, data: Buffer): void;
    open?(socket: T): void;
    close?(socket: T): void;
    error?(socket: T, error: Error): void;
  };
}

export interface BunListener<T> {
  hostname: string;
  port: number;
  stop(): Promise<void>;
}

export function bunListen<T extends { data: Buffer }>(
  options: BunListenOptions<T>
): BunListener<T> {
  const hostname = options.hostname || '0.0.0.0';
  const port = options.port;

  const sockets = new Set<Socket>();

  const server = createServer((socket) => {
    const wrapper = {
      data: Buffer.alloc(0),
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    } as T;

    sockets.add(socket);

    socket.on('data', (data) => {
      options.socket.data(wrapper, data);
    });

    socket.on('close', () => {
      sockets.delete(socket);
      options.socket.close?.(wrapper);
    });

    socket.on('error', (err) => {
      options.socket.error?.(wrapper, err);
    });

    options.socket.open?.(wrapper);
  });

  server.listen(port, hostname);

  return {
    hostname,
    port,
    stop: () => new Promise((resolve) => {
      for (const socket of sockets) {
        socket.destroy();
      }
      server.close(() => resolve());
    }),
  };
}

/**
 * Semver utilities - replaces bunSemver
 */
export const bunSemver = {
  order(a: string, b: string): number {
    const result = semverLib.compare(a, b);
    if (result > 0) return 1;
    if (result < 0) return -1;
    return 0;
  },

  satisfies(version: string, range: string): boolean {
    return semverLib.satisfies(version, range);
  },
};

/**
 * GC trigger - replaces bunGc()
 * Note: In Node, --expose-gc flag is required
 */
export function bunGc(force?: boolean): void {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Generate heap snapshot - replaces Bun.generateHeapSnapshot()
 * Requires --heapsnapshot-near-heap-limit flag in Node
 */
export function bunGenerateHeapSnapshot(): object {
  const v8 = require('v8');
  return v8.getHeapSnapshot();
}

/**
 * Embedded files - replaces Bun.embeddedFiles
 * Node.js doesn't have this concept, returns empty array
 */
export const bunEmbeddedFiles: string[] = [];

/**
 * Password hashing - replaces Bun.password
 * Uses Node's crypto module
 */
export const bunPassword = {
  async hash(password: string, algorithm: string = 'bcrypt'): Promise<string> {
    // Fallback to simple hash - in production, use bcrypt package
    const salt = randomUUID();
    const hash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return `${algorithm}$${salt}$${hash}`;
  },

  async verify(password: string, hash: string): Promise<boolean> {
    const [algo, salt, hashed] = hash.split('$');
    const check = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return check === hashed;
  },
};

/**
 * File API - replaces Bun.file()
 */
export function bunFile(path: string): {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
} {
  return {
    async text(): Promise<string> {
      return readFile(path, 'utf-8');
    },
    async arrayBuffer(): Promise<ArrayBuffer> {
      const buf = await readFile(path);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    async json(): Promise<unknown> {
      const text = await readFile(path, 'utf-8');
      return JSON.parse(text);
    },
  };
}

/**
 * Write file - replaces Bun.write()
 */
export async function bunWrite(path: string, content: string | Buffer | ArrayBufferView): Promise<void> {
  let buf: Buffer;
  if (typeof content === 'string') {
    buf = Buffer.from(content, 'utf-8');
  } else if (Buffer.isBuffer(content)) {
    buf = content;
  } else {
    buf = Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  }
  await writeFile(path, buf);
}

// Default export for convenience
export default {
  hash: bunHash,
  hashString: bunHashString,
  which: bunWhich,
  whichSync: bunWhichSync,
  yaml: {
    parse: bunYamlParse,
    stringify: bunYamlStringify,
  },
  spawn: bunSpawn,
  listen: bunListen,
  semver: bunSemver,
  gc: bunGc,
  generateHeapSnapshot: bunGenerateHeapSnapshot,
  embeddedFiles: bunEmbeddedFiles,
  password: bunPassword,
  file: bunFile,
  write: bunWrite,
  isBun,
};
