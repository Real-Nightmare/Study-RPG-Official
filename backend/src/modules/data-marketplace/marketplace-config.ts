/**
 * Data marketplace configuration (owner brief: "keep Study RPG sustainable by
 * selling educational data through the Ocean Protocol ecosystem").
 *
 * Every value is env-driven with a safe default so development boots are
 * unaffected. Secrets are never logged. When Ocean/Aquarius is not configured
 * the marketplace still fully works in "draft" mode: datasets are created,
 * privacy-guarded aggregates are computed and stored (privacy report +
 * checksum + DDO), and publishing simply records `published=false` so an admin
 * can complete the on-chain step later or export the DDO for manual upload.
 */

export type OceanNetwork = 'mainnet' | 'testnet';

export interface MarketplaceConfig {
  /** Base URL of the Ocean Aquarius metadata store (e.g. mainnet). */
  aquariusUrl: string;
  /** Publisher wallet address (checksummed hex) — optional. */
  publisherAddress: string | null;
  /** Publisher wallet private key — optional, never logged. */
  publisherPrivateKey: string | null;
  /** Ocean network — defaults to MAINNET (never testnet). */
  network: OceanNetwork;
  /** Chain id used for the did:op DID. */
  chainId: number;
  /** Master switch for outbound publish calls (kept true by default). */
  publishEnabled: boolean;
  /** Minimum cohort size before an aggregate may be published. */
  minGroupSize: number;
  /** Minimum consent coverage (0–1) before publication. */
  consentThreshold: number;
  /** Default license string stamped into published DDOs. */
  license: string;
}

export function getMarketplaceConfig(
  env: Record<string, string | undefined> = process.env,
): MarketplaceConfig {
  // MAINNET is the default and the only network this module targets by
  // default — the owner brief: "I want it to be mainnet not testnet so I can
  // pay for servers". Testnet requires an explicit OCEAN_NETWORK=testnet plus
  // explicit OCEAN_CHAIN_ID / OCEAN_AQUARIUS_URL overrides; nothing ever
  // defaults to a testnet chain.
  const network: OceanNetwork = env.OCEAN_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  return {
    aquariusUrl: (
      env.OCEAN_AQUARIUS_URL ||
      (network === 'mainnet' ? 'https://aquarius.mainnet.oceanprotocol.com' : '')
    ).replace(/\/$/, ''),
    publisherAddress: env.OCEAN_PUBLISHER_ADDRESS || null,
    publisherPrivateKey: env.OCEAN_PUBLISHER_PRIVATE_KEY || null,
    network,
    chainId: Number(env.OCEAN_CHAIN_ID || 1),
    publishEnabled: String(env.MARKETPLACE_PUBLISH_ENABLED ?? 'true') !== 'false',
    minGroupSize: Number(env.MARKETPLACE_MIN_GROUP_SIZE || 10),
    consentThreshold: Number(env.MARKETPLACE_CONSENT_THRESHOLD || 0.8),
    license: env.MARKETPLACE_DATASET_LICENSE || 'CC-BY-4.0 (aggregate statistics only)',
  };
}

export const MARKETPLACE_DEFAULTS = {
  minGroupSize: 10,
  consentThreshold: 0.8,
};

/**
 * Idle-capacity Ocean Node config (owner brief follow-up): when the server is
 * fully idle (no users), Study RPG can run an official `oceanprotocol/ocean-node`
 * container that joins the Ocean network and earns provider fees by executing
 * compute-to-data (C2D) jobs for other network participants. Everything is
 * opt-in via `OCEAN_NODE_ENABLED` and every docker call is best-effort — an
 * unconfigured or docker-less host is simply logged, never fatal.
 *
 * Per the official ocean-node README, `PRIVATE_KEY` (the node operator wallet)
 * is the only mandatory variable; `RPC_URLS` is a JSON map of chainId -> RPC
 * used to settle payments on the configured chain (mainnet by default).
 */
export interface OceanNodeConfig {
  /** Master switch for the idle-capacity node (default: off). */
  enabled: boolean;
  /** Official Ocean Node image (pin to a stable tag in production). */
  image: string;
  /** Docker container name for the node. */
  containerName: string;
  /** How often the idle monitor samples activity (ms). */
  checkIntervalMs: number;
  /** How long the server must be fully idle before the node is started (ms). */
  idleWindowMs: number;
  /** Cooldown after a stop before the node may start again (ms) — anti-flap. */
  cooldownMs: number;
  /** Node operator wallet private key (0x…) — never logged; null = refuse to start. */
  privateKey: string | null;
  /** JSON map of chainId -> RPC URL for payment settlement, e.g. {"1":"https://eth.llamarpc.com"}. */
  rpcUrls: string | null;
  /** Optional IPFS gateway for the node. */
  ipfsGateway: string | null;
  /** Host port for the node's HTTP API (default 8000). */
  httpApiPort: number;
  /** Host port for the node's P2P listener (default 9000). */
  p2pPort: number;
  /** Docker binary path (default "docker"). */
  dockerBinary: string;
  /** Max node starts per rolling 24h — a hard anti-flap cap. */
  maxStartsPerDay: number;
}

export function getOceanNodeConfig(
  env: Record<string, string | undefined> = process.env,
): OceanNodeConfig {
  return {
    enabled: String(env.OCEAN_NODE_ENABLED ?? 'false') === 'true',
    image: env.OCEAN_NODE_IMAGE || 'oceanprotocol/ocean-node:latest',
    containerName: env.OCEAN_NODE_CONTAINER_NAME || 'study-rpg-ocean-node',
    checkIntervalMs: Math.max(15_000, Number(env.OCEAN_NODE_CHECK_INTERVAL_S || 60) * 1000),
    idleWindowMs: Math.max(60_000, Number(env.OCEAN_NODE_IDLE_WINDOW_MIN || 10) * 60_000),
    cooldownMs: Math.max(60_000, Number(env.OCEAN_NODE_COOLDOWN_MIN || 60) * 60_000),
    privateKey: env.OCEAN_NODE_PRIVATE_KEY || null,
    rpcUrls: env.OCEAN_NODE_RPC_URLS || null,
    ipfsGateway: env.OCEAN_NODE_IPFS_GATEWAY || null,
    httpApiPort: Number(env.OCEAN_NODE_HTTP_API_PORT || 8000),
    p2pPort: Number(env.OCEAN_NODE_P2P_PORT || 9000),
    dockerBinary: env.OCEAN_NODE_DOCKER_BINARY || 'docker',
    maxStartsPerDay: Math.max(1, Number(env.OCEAN_NODE_MAX_STARTS_PER_DAY || 3)),
  };
}

/** Dataset types the marketplace can publish (aggregates only). */
export const DATASET_TYPES = [
  'study_engagement',
  'academic_outcomes',
  'rpg_effectiveness',
] as const;

export type DatasetType = (typeof DATASET_TYPES)[number];

/** Allowlisted cohort filter keys — never free-form SQL. */
export const ALLOWED_COHORT_FILTERS = ['country', 'board', 'grade'] as const;
export type CohortFilterKey = (typeof ALLOWED_COHORT_FILTERS)[number];
