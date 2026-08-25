import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseGateway } from '../../common/gateways';
import { DatabaseService } from '../database';
import { getOceanNodeConfig, OceanNodeConfig } from './marketplace-config';
import { decideNodeAction, NodeAction, updateIdleSince } from './ocean-node-policy';

const execFileAsync = promisify(execFile);

/** Injectable docker wrapper (replaced in tests). Never throws — returns code/stdout. */
export type DockerExec = (
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string; code: number | null }>;

const defaultDockerExec: DockerExec = async (args, timeoutMs) => {
  try {
    const { stdout } = await execFileAsync('docker', args, {
      timeout: timeoutMs,
      encoding: 'utf8',
      // MaxBuffer needs to be generous for `docker ps -q` style output; this
      // wrapper only ever emits short outputs so 1 MB is plenty.
      maxBuffer: 1024 * 1024,
    });
    return { stdout: stdout.trim(), code: 0 };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    // ENOENT means the docker binary is not installed — the caller disables
    // itself rather than logging errors forever.
    return { stdout: '', code: code === 'ENOENT' ? 127 : 1 };
  }
};

export interface OceanNodeStatus {
  enabled: boolean;
  nodeRunning: boolean | null;
  idleSince: string | null;
  stoppedAt: string | null;
  lastAction: NodeAction | null;
  lastError: string | null;
  startsInLast24h: number;
  activeConnections: number;
  dockerUnavailable: boolean;
}

/**
 * Idle-capacity Ocean Node monitor (owner brief follow-up): when the platform
 * is fully idle (no WebSocket connections, no focus sessions started within
 * the idle window) for a sustained period, start an official
 * `oceanprotocol/ocean-node` container so the spare server capacity earns
 * provider fees on the Ocean network. The moment any real user appears the
 * node is stopped, and a cooldown + daily start cap prevent container flapping.
 *
 * Everything is best-effort and opt-in (`OCEAN_NODE_ENABLED=true`): without
 * docker, without a node wallet private key, or on any docker failure the
 * monitor degrades to logging only and never throws.
 */
@Injectable()
export class OceanNodeMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OceanNodeMonitorService.name);

  private interval: NodeJS.Timeout | null = null;
  private polling = false;
  private dockerUnavailable = false;

  private idleSinceMs: number | null = null;
  private stoppedAtMs: number | null = null;
  private lastAction: NodeAction | null = null;
  private lastError: string | null = null;
  private nodeRunning: boolean | null = null;
  private startTimestamps: number[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly dockerExec: DockerExec = defaultDockerExec,
  ) {}

  getConfig(): OceanNodeConfig {
    const get = (key: string) => this.config.get<string>(key);
    return getOceanNodeConfig({
      OCEAN_NODE_ENABLED: get('OCEAN_NODE_ENABLED'),
      MARKETPLACE_ENABLED: get('MARKETPLACE_ENABLED'),
      OCEAN_NODE_IMAGE: get('OCEAN_NODE_IMAGE'),
      OCEAN_NODE_CONTAINER_NAME: get('OCEAN_NODE_CONTAINER_NAME'),
      OCEAN_NODE_CHECK_INTERVAL_S: get('OCEAN_NODE_CHECK_INTERVAL_S'),
      OCEAN_NODE_IDLE_WINDOW_MIN: get('OCEAN_NODE_IDLE_WINDOW_MIN'),
      OCEAN_NODE_COOLDOWN_MIN: get('OCEAN_NODE_COOLDOWN_MIN'),
      OCEAN_NODE_PRIVATE_KEY: get('OCEAN_NODE_PRIVATE_KEY'),
      OCEAN_NODE_RPC_URLS: get('OCEAN_NODE_RPC_URLS'),
      OCEAN_NODE_IPFS_GATEWAY: get('OCEAN_NODE_IPFS_GATEWAY'),
      OCEAN_NODE_HTTP_API_PORT: get('OCEAN_NODE_HTTP_API_PORT'),
      OCEAN_NODE_P2P_PORT: get('OCEAN_NODE_P2P_PORT'),
      OCEAN_NODE_DOCKER_BINARY: get('OCEAN_NODE_DOCKER_BINARY'),
      OCEAN_NODE_MAX_STARTS_PER_DAY: get('OCEAN_NODE_MAX_STARTS_PER_DAY'),
    });
  }

  onModuleInit(): void {
    const cfg = this.getConfig();
    // Owner policy: the idle-capacity node is a marketplace surface — it must
    // NEVER start unless the whole data marketplace is explicitly enabled.
    if (!cfg.enabled || !this.marketplaceEnabled()) {
      this.logger.log(
        'Idle-capacity Ocean Node monitor disabled (requires OCEAN_NODE_ENABLED=true AND ' +
          'MARKETPLACE_ENABLED=true)',
      );
      return;
    }
    this.logger.log(
      `Idle-capacity Ocean Node monitor enabled — idle window ${Math.round(
        cfg.idleWindowMs / 60_000,
      )} min, cooldown ${Math.round(cfg.cooldownMs / 60_000)} min, image ${cfg.image}`,
    );
    this.interval = setInterval(() => void this.poll(), cfg.checkIntervalMs);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.log('Idle-capacity Ocean Node monitor stopped');
  }

  /** One poll cycle: sample activity, decide, act. Never throws. */
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.tick();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error('Ocean Node monitor tick failed', error);
    } finally {
      this.polling = false;
    }
  }

  status(): OceanNodeStatus {
    return {
      enabled: this.getConfig().enabled && this.marketplaceEnabled(),
      nodeRunning: this.nodeRunning,
      idleSince: this.idleSinceMs !== null ? new Date(this.idleSinceMs).toISOString() : null,
      stoppedAt: this.stoppedAtMs !== null ? new Date(this.stoppedAtMs).toISOString() : null,
      lastAction: this.lastAction,
      lastError: this.lastError,
      startsInLast24h: this.startsInLast24h(),
      activeConnections: BaseGateway.activeConnections,
      dockerUnavailable: this.dockerUnavailable,
    };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /** Marketplace master switch — the node is a marketplace surface. */
  private marketplaceEnabled(): boolean {
    return this.config.get<string>('MARKETPLACE_ENABLED') === 'true';
  }

  private async tick(): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg.enabled || !this.marketplaceEnabled() || this.dockerUnavailable) return;
    const now = Date.now();

    const activity = await this.sampleActivity();
    const nodeRunning = await this.isContainerRunning(cfg);

    this.idleSinceMs = updateIdleSince(this.idleSinceMs, activity, now);
    const action = decideNodeAction({
      activity,
      nodeRunning,
      idleSinceMs: this.idleSinceMs,
      stoppedAtMs: this.stoppedAtMs,
      now,
      idleWindowMs: cfg.idleWindowMs,
      cooldownMs: cfg.cooldownMs,
    });

    if (action === 'start') {
      await this.startNode(cfg, now);
    } else if (action === 'stop') {
      await this.stopNode(cfg, now);
    }
    this.lastAction = action;
  }

  /**
   * Is anyone using the platform right now? Conservative: any WebSocket
   * connection, or any focus session started within the idle window. If the
   * DB check fails we assume activity so the node never starts on a broken
   * signal path.
   */
  private async sampleActivity(): Promise<boolean> {
    if (BaseGateway.activeConnections > 0) {
      return true;
    }
    const cfg = this.getConfig();
    try {
      const row = await this.db.queryOne<{ active: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM focus_sessions
           WHERE started_at > NOW() - ($1::int * INTERVAL '1 second')
         ) AS active`,
        [Math.ceil(cfg.idleWindowMs / 1000)],
      );
      return Boolean(row?.active);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn('Could not sample focus activity — treating as active', error);
      return true;
    }
  }

  private async isContainerRunning(cfg: OceanNodeConfig): Promise<boolean> {
    const { stdout, code } = await this.dockerExec(
      ['ps', '-q', '--filter', `name=^/${cfg.containerName}$`],
      10_000,
    );
    if (code === 127) {
      this.dockerUnavailable = true;
      this.nodeRunning = null;
      this.logger.warn(
        `Docker binary "${cfg.dockerBinary}" not found — idle-capacity Ocean Node disabled`,
      );
      return false;
    }
    if (code !== 0) {
      this.nodeRunning = null;
      return false;
    }
    this.nodeRunning = stdout.length > 0;
    return this.nodeRunning;
  }

  private async startNode(cfg: OceanNodeConfig, now: number): Promise<void> {
    if (!cfg.privateKey) {
      this.lastError = 'OCEAN_NODE_PRIVATE_KEY is not set — node cannot earn; not starting';
      this.logger.warn(this.lastError);
      return;
    }
    if (this.startsInLast24h() >= cfg.maxStartsPerDay) {
      this.lastError = `Daily start cap (${cfg.maxStartsPerDay}) reached — skipping start`;
      this.logger.warn(this.lastError);
      return;
    }

    const args = [
      'run',
      '-d',
      '--name',
      cfg.containerName,
      '--restart',
      'unless-stopped',
      '-p',
      `${cfg.httpApiPort}:8000`,
      '-p',
      `${cfg.p2pPort}:9000`,
      '-e',
      `PRIVATE_KEY=${cfg.privateKey}`,
    ];
    if (cfg.rpcUrls) {
      args.push('-e', `RPC_URLS=${cfg.rpcUrls}`);
    }
    if (cfg.ipfsGateway) {
      args.push('-e', `IPFS_GATEWAY=${cfg.ipfsGateway}`);
    }
    args.push(cfg.image);

    // `docker run` may need to pull the image — allow up to 5 minutes.
    const { code } = await this.dockerExec(args, 300_000);
    if (code !== 0) {
      this.lastError = `docker run failed (code ${code})`;
      this.logger.error(this.lastError);
      return;
    }
    this.startTimestamps.push(now);
    this.nodeRunning = true;
    this.lastError = null;
    this.logger.log(`Idle-capacity Ocean Node started (container ${cfg.containerName})`);
  }

  private async stopNode(cfg: OceanNodeConfig, now: number): Promise<void> {
    const { code } = await this.dockerExec(['stop', cfg.containerName, '-t', '30'], 45_000);
    if (code !== 0) {
      this.lastError = `docker stop failed (code ${code})`;
      this.logger.error(this.lastError);
      return;
    }
    this.nodeRunning = false;
    this.stoppedAtMs = now;
    // The user's departure is the moment the next idle window starts counting:
    // cooldown and idle window then run concurrently from the stop, so the
    // node may restart as soon as both have elapsed.
    this.idleSinceMs = now;
    this.lastError = null;
    this.logger.log(`Idle-capacity Ocean Node stopped (users are back)`);
  }

  private startsInLast24h(): number {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.startTimestamps = this.startTimestamps.filter((ts) => ts >= cutoff);
    return this.startTimestamps.length;
  }
}
