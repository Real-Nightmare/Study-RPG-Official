import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { C2dRunnerService } from './c2d-runner.service';

function makeService(env: Record<string, string | undefined> = {}) {
  return new C2dRunnerService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('C2dRunnerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('defaults to the compose-isolated runner URL', () => {
    expect(makeService().getConfig()).toEqual({
      url: 'http://c2d-runner:9000',
      timeoutSeconds: 30,
    });
  });

  describe('validateInput', () => {
    it('accepts allowlisted languages only', () => {
      const svc = makeService();
      svc.validateInput({ code: 'print(1)', language: 'python' });
      expect(() => svc.validateInput({ code: 'rm -rf /', language: 'bash' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects empty or oversized algorithms', () => {
      const svc = makeService();
      expect(() => svc.validateInput({ code: '   ' })).toThrow(BadRequestException);
      expect(() => svc.validateInput({ code: 'x'.repeat(20_001) })).toThrow(BadRequestException);
    });
  });

  it('posts the algorithm + payload to the isolated runner and returns the result', async () => {
    const fetchMock = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://runner:9000/c2d/run');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        language: 'python',
        code: 'print(sum(DATA.values()))',
        data: '{"a":1}',
        timeout: 30,
      });
      return new Response(
        JSON.stringify({
          status: 'success',
          stdout: '1\n',
          stderr: '',
          exitCode: 0,
          executionTimeMs: 7,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const svc = makeService({ C2D_RUNNER_URL: 'http://runner:9000' });
    const result = await svc.run({
      code: 'print(sum(DATA.values()))',
      language: 'python',
      data: '{"a":1}',
    });
    expect(result).toMatchObject({ status: 'success', stdout: '1\n', exitCode: 0 });
  });

  it('clamps caller timeouts to the configured maximum', async () => {
    let seenTimeout: number | undefined;
    const fetchMock = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      seenTimeout = JSON.parse(String(init?.body)).timeout;
      return new Response(JSON.stringify({ status: 'success', stdout: '', stderr: '' }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const svc = makeService({ C2D_RUNNER_URL: 'http://runner:9000', C2D_RUNNER_TIMEOUT_S: '10' });
    await svc.run({ code: 'x', language: 'javascript', timeoutSeconds: 500 });
    expect(seenTimeout).toBe(10);
  });

  it('returns a friendly error instead of throwing when the runner is unreachable', async () => {
    const fetchMock = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const svc = makeService({ C2D_RUNNER_URL: 'http://runner:9000' });
    const result = await svc.run({ code: 'print(1)', language: 'python' });
    expect(result.status).toBe('error');
    expect(result.stderr).toContain('c2d-runner');
    expect(result.stderr).toContain('docker compose up -d c2d-runner');
  });

  it('reports health reachability for the admin status endpoint', async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ) as unknown as typeof fetch;
    const svc = makeService({ C2D_RUNNER_URL: 'http://runner:9000' });
    await expect(svc.health()).resolves.toEqual({ reachable: true, url: 'http://runner:9000' });

    global.fetch = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    await expect(svc.health()).resolves.toEqual({ reachable: false, url: 'http://runner:9000' });
  });
});
