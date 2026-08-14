import { OceanNodeMonitorService, DockerExec } from './ocean-node-monitor.service';

const MIN = 60_000;

function makeConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    OCEAN_NODE_ENABLED: 'true',
    OCEAN_NODE_IDLE_WINDOW_MIN: '1',
    OCEAN_NODE_COOLDOWN_MIN: '1',
    OCEAN_NODE_PRIVATE_KEY: '0xabc',
    OCEAN_NODE_IMAGE: 'oceanprotocol/ocean-node:latest',
    OCEAN_NODE_CONTAINER_NAME: 'study-rpg-ocean-node',
    OCEAN_NODE_MAX_STARTS_PER_DAY: '3',
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) };
}

/** DatabaseService stub whose activity answer can be toggled per test. */
function makeDb(active = false) {
  const db = { queryOne: jest.fn() };
  db.queryOne.mockResolvedValue({ active });
  return db;
}

describe('OceanNodeMonitorService', () => {
  let now: number;
  let calls: string[][];
  let dockerExec: jest.MockedFunction<DockerExec>;
  let dateSpy: jest.SpyInstance;

  beforeEach(() => {
    now = 5_000_000_000;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    calls = [];
    dockerExec = jest.fn(async (args: string[], _timeoutMs: number) => {
      calls.push(args);
      // `docker ps` reports the container not running; all other commands succeed
      if (args[0] === 'ps') return { stdout: '', code: 0 };
      return { stdout: '', code: 0 };
    });
  });

  afterEach(() => {
    dateSpy.mockRestore();
    jest.clearAllMocks();
  });

  function makeService(overrides: Record<string, unknown> = {}, db = makeDb(false)) {
    return new OceanNodeMonitorService(
      makeConfig(overrides) as never,
      db as never,
      dockerExec as never,
    );
  }

  /** Non-`ps` docker invocations (the actual start/stop commands). */
  function runCalls(): string[][] {
    return calls.filter((a) => a[0] !== 'ps');
  }

  function setContainerRunning(running: boolean) {
    dockerExec.mockImplementation(async (args: string[], _timeoutMs: number) => {
      calls.push(args);
      if (args[0] === 'ps') return { stdout: running ? 'abc123\n' : '', code: 0 };
      return { stdout: '', code: 0 };
    });
  }

  it('is inert when disabled — no docker calls, no activity sampling', async () => {
    const db = makeDb(false);
    const svc = makeService({ OCEAN_NODE_ENABLED: 'false' }, db);
    await svc.poll();
    expect(dockerExec).not.toHaveBeenCalled();
    expect(db.queryOne).not.toHaveBeenCalled();
    expect(svc.status().enabled).toBe(false);
  });

  it('starts the node after the idle window elapses with no activity', async () => {
    const svc = makeService();
    await svc.poll(); // T0: idle streak begins, node not running → no action
    expect(runCalls()).toHaveLength(0);

    now += 2 * MIN; // past the 1-minute idle window
    await svc.poll(); // → start
    const startCall = runCalls().find((a) => a[0] === 'run');
    expect(startCall).toBeDefined();
    expect(startCall).toContain('--name');
    expect(startCall).toContain('study-rpg-ocean-node');
    expect(startCall).toContain('-e');
    expect(startCall).toContain('PRIVATE_KEY=0xabc');
    expect(startCall).toContain('-p');
    expect(startCall).toContain('8000:8000');
    expect(startCall).toContain('9000:9000');
    expect(startCall).toContain('oceanprotocol/ocean-node:latest');
    expect(svc.status().nodeRunning).toBe(true);
  });

  it('stops the node the moment a user appears', async () => {
    const db = makeDb(false);
    const svc = makeService({}, db);
    await svc.poll(); // seed the idle streak at T0
    now += 2 * MIN;
    await svc.poll(); // start
    expect(runCalls().find((a) => a[0] === 'run')).toBeDefined();

    setContainerRunning(true);
    db.queryOne.mockResolvedValue({ active: true }); // a focus session just started
    await svc.poll(); // → stop
    expect(runCalls().find((a) => a[0] === 'stop')).toBeDefined();
    expect(svc.status().nodeRunning).toBe(false);
  });

  it('respects the cooldown after a stop', async () => {
    const db = makeDb(false);
    const svc = makeService({}, db);
    await svc.poll(); // seed the idle streak at T0
    now += 2 * MIN;
    await svc.poll(); // start

    setContainerRunning(true);
    db.queryOne.mockResolvedValue({ active: true });
    await svc.poll(); // stop — stoppedAtMs recorded on svc

    setContainerRunning(false);
    db.queryOne.mockResolvedValue({ active: false });
    now += 30_000; // 30s < 1min cooldown → still no start
    await svc.poll();
    expect(runCalls().filter((a) => a[0] === 'run')).toHaveLength(1);

    now += 2 * MIN; // cooldown + idle window elapsed → start again
    await svc.poll();
    expect(runCalls().filter((a) => a[0] === 'run')).toHaveLength(2);
  });

  it('refuses to start without an operator wallet private key', async () => {
    const svc = makeService({ OCEAN_NODE_PRIVATE_KEY: undefined });
    await svc.poll(); // seed the idle streak at T0
    now += 2 * MIN;
    await svc.poll();
    expect(runCalls().find((a) => a[0] === 'run')).toBeUndefined();
    expect(svc.status().lastError).toContain('OCEAN_NODE_PRIVATE_KEY');
  });

  it('honours the daily start cap', async () => {
    const db = makeDb(false);
    const svc = makeService({ OCEAN_NODE_MAX_STARTS_PER_DAY: '1' }, db);
    await svc.poll(); // seed the idle streak at T0
    now += 2 * MIN;
    await svc.poll(); // start #1
    expect(runCalls().filter((a) => a[0] === 'run')).toHaveLength(1);

    setContainerRunning(true);
    db.queryOne.mockResolvedValue({ active: true });
    await svc.poll(); // stop
    expect(runCalls().filter((a) => a[0] === 'stop')).toHaveLength(1);

    setContainerRunning(false);
    db.queryOne.mockResolvedValue({ active: false });
    now += 3 * MIN; // cooldown + idle window elapsed
    await svc.poll(); // would start, but daily cap = 1 → blocked
    expect(runCalls().filter((a) => a[0] === 'run')).toHaveLength(1);
    expect(svc.status().lastError).toContain('Daily start cap');
  });

  it('degrades gracefully when docker is missing and never throws', async () => {
    dockerExec.mockResolvedValue({ stdout: '', code: 127 });
    const svc = makeService();
    await expect(svc.poll()).resolves.toBeUndefined();
    expect(svc.status().dockerUnavailable).toBe(true);
    expect(svc.status().nodeRunning).toBeNull();

    // Subsequent polls bail without touching docker further
    dockerExec.mockClear();
    await svc.poll();
    expect(dockerExec).not.toHaveBeenCalled();
  });

  it('treats a failing activity check as active (conservative)', async () => {
    const db = { queryOne: jest.fn().mockRejectedValue(new Error('db down')) };
    const svc = makeService({}, db as never);
    now += 2 * MIN;
    await svc.poll();
    expect(runCalls().find((a) => a[0] === 'run')).toBeUndefined();
    expect(svc.status().lastError).toContain('db down');
  });

  it('reports status including active connection count', async () => {
    const svc = makeService();
    const status = svc.status();
    expect(status.enabled).toBe(true);
    expect(typeof status.activeConnections).toBe('number');
    expect(typeof status.startsInLast24h).toBe('number');
  });
});
