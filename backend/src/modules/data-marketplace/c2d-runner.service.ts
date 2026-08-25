/**
 * Compute-to-Data runner client (owner policy update: the marketplace is
 * compute-to-data ONLY, and researchers must be able to test our system in
 * isolation).
 *
 * The `c2d-runner` sidecar (see `docker/c2d-runner/`, composed in
 * docker-compose.yml) is a hardened container that executes untrusted
 * researcher algorithms against a dataset payload:
 *
 *   - it sits on an internal Docker network with NO outbound route
 *     (`internal: true`), runs with a read-only root filesystem, tmpfs /tmp,
 *     dropped capabilities, no-new-privileges and hard memory/CPU/PID caps;
 *   - algorithms receive the sanitized numeric aggregate as JSON on stdin and
 *     write results to stdout — they can never open sockets, read the host
 *     filesystem or reach the Study RPG database;
 *   - the same image powers the local Problem Solver sandbox, so the exact
 *     environment researchers test against is the one we ship.
 *
 * This service is the backend's thin HTTP client for that runner. It never
 * executes code itself.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { getC2dRunnerConfig } from './marketplace-config';

/** Languages the runner accepts (allowlist — mirrors the runner's own). */
export const C2D_RUNNER_LANGUAGES = ['python', 'javascript'] as const;
export type C2dRunnerLanguage = (typeof C2D_RUNNER_LANGUAGES)[number];

export interface C2dRunRequest {
  /** Algorithm source. */
  code: string;
  language: C2dRunnerLanguage | string;
  /**
   * Dataset payload delivered to the algorithm as JSON on stdin. Only
   * privacy-guarded aggregates may ever be passed here.
   */
  data?: string;
  timeoutSeconds?: number;
}

export interface C2dRunResult {
  status: 'success' | 'error' | 'timeout';
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
}

const MAX_CODE_LENGTH = 20_000;

@Injectable()
export class C2dRunnerService {
  private readonly logger = new Logger(C2dRunnerService.name);

  constructor(private readonly config: ConfigService) {}

  getConfig() {
    const get = (key: string) => this.config.get<string>(key);
    return getC2dRunnerConfig({
      C2D_RUNNER_URL: get('C2D_RUNNER_URL'),
      C2D_RUNNER_TIMEOUT_S: get('C2D_RUNNER_TIMEOUT_S'),
    });
  }

  /** Validate caller-supplied algorithm input before it goes anywhere. */
  validateInput(input: { code?: string; language?: string; timeoutSeconds?: number }): void {
    if (!input.code || !input.code.trim()) {
      throw new BadRequestException('Algorithm code is required.');
    }
    if (input.code.length > MAX_CODE_LENGTH) {
      throw new BadRequestException(`Algorithm too large (max ${MAX_CODE_LENGTH} characters).`);
    }
    const lang = (input.language || 'python').toLowerCase();
    if (!C2D_RUNNER_LANGUAGES.includes(lang as C2dRunnerLanguage)) {
      throw new BadRequestException(`language must be one of: ${C2D_RUNNER_LANGUAGES.join(', ')}`);
    }
  }

  /**
   * Run an algorithm inside the isolated c2d-runner container. Never throws
   * on runner errors — failures are returned as `{ status: 'error' }` so the
   * admin UI can display them; only invalid input throws.
   */
  async run(input: C2dRunRequest): Promise<C2dRunResult> {
    this.validateInput(input);
    const cfg = this.getConfig();
    const timeoutSeconds = Math.max(
      1,
      Math.min(cfg.timeoutSeconds, Number(input.timeoutSeconds || cfg.timeoutSeconds)),
    );

    let res: Response;
    try {
      res = await fetch(`${cfg.url}/c2d/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: (input.language as string).toLowerCase(),
          code: input.code,
          data: input.data ?? '',
          timeout: timeoutSeconds,
        }),
        signal: AbortSignal.timeout((timeoutSeconds + 10) * 1000),
      });
    } catch (err) {
      this.logger.warn(`c2d-runner unreachable at ${cfg.url}: ${(err as Error).message}`);
      return {
        status: 'error',
        stdout: '',
        stderr:
          `Compute runner unreachable at ${cfg.url}. Is the c2d-runner service running? ` +
          `(docker compose up -d c2d-runner)`,
        exitCode: null,
        executionTimeMs: null,
      };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        status: 'error',
        stdout: '',
        stderr: `Runner responded ${res.status}: ${body.slice(0, 500)}`,
        exitCode: null,
        executionTimeMs: null,
      };
    }
    const body = (await res.json().catch(() => null)) as Partial<C2dRunResult> | null;
    if (!body) {
      return {
        status: 'error',
        stdout: '',
        stderr: 'Runner returned a malformed response.',
        exitCode: null,
        executionTimeMs: null,
      };
    }
    return {
      status: body.status ?? 'error',
      stdout: String(body.stdout ?? ''),
      stderr: String(body.stderr ?? ''),
      exitCode: body.exitCode ?? null,
      executionTimeMs: body.executionTimeMs ?? null,
    };
  }

  /** Health probe used by the admin status endpoint. */
  async health(): Promise<{ reachable: boolean; url: string }> {
    const cfg = this.getConfig();
    try {
      const res = await fetch(`${cfg.url}/health`, { signal: AbortSignal.timeout(3000) });
      return { reachable: res.ok, url: cfg.url };
    } catch {
      return { reachable: false, url: cfg.url };
    }
  }
}
