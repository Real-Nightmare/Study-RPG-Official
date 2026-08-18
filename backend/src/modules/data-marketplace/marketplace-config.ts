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
  // -------------------------------------------------------------------
  // Compute-to-Data (C2D) — on-chain publishing (owner follow-up)
  // -------------------------------------------------------------------
  /**
   * Ocean Node / provider URL used to encrypt files + DDO and to serve as the
   * compute service endpoint. Current mainnet node: https://compute1.oceanprotocol.com/
   */
  nodeUrl: string;
  /**
   * RPC URL of the chain the assets are deployed on. Defaults to a public
   * Polygon mainnet RPC (the owner has MATIC there); override for other
   * networks (e.g. Base: https://mainnet.base.org).
   */
  rpcUrl: string;
  /** ERC721Factory address for the configured chain (Polygon mainnet default). */
  factoryAddress: string | null;
  /** FixedRateExchange address for the configured chain (Polygon mainnet default). */
  fixedRateExchangeAddress: string | null;
  /** Ocean (base token) address for the configured chain (Polygon mainnet default). */
  oceanTokenAddress: string | null;
  /** C2D policy defaults (can be overridden per dataset at publish time). */
  c2d: C2DPolicyConfig;
}

export interface C2DPolicyConfig {
  /**
   * Allow buyers to submit their own algorithm code (raw) to run against the
   * aggregate. Safe on this platform because published files are strictly
   * sanitized numeric aggregates — there are no raw rows or credentials to
   * leak — and `allowNetworkAccess` (below) blocks exfiltration anyway.
   * Defaults to true so the asset is actually usable for compute; admins may
   * tighten it per dataset. Default: true.
   */
  allowRawAlgorithm: boolean;
  /**
   * Whether compute jobs may reach the public internet. Defaults to FALSE:
   * aggregates are meant to be computed on, not exfiltrated.
   */
  allowNetworkAccess: boolean;
  /**
   * Allowlist of algorithm publisher addresses (comma-separated). Empty
   * (default) = any published algorithm is allowed on top of raw algorithms.
   */
  trustedAlgorithmPublishers: string[];
}

// Default addresses for the Ocean Protocol deployment on Polygon mainnet
// (chain 137) — the network the owner funded with MATIC. Every address can be
// overridden via env to target other supported chains (e.g. Base 8453).
export const OCEAN_POLYGON_DEFAULTS = {
  chainId: 137,
  factoryAddress: '0x6fd867E5AEE6D62a24f97939db90C4e67A73A651',
  fixedRateExchangeAddress: '0xb28Ab1AaDe4c75F8cF013136fc0c290AeaeA9BA6',
  oceanTokenAddress: '0x282d8efCe846A88B159800bd4130ad77443Fa1A1',
  rpcUrl: 'https://polygon-rpc.com',
};

/** Current mainnet Ocean Node (provider + metadata + compute endpoint). */
export const OCEAN_MAINNET_NODE_URL = 'https://compute1.oceanprotocol.com/';

export function getMarketplaceConfig(
  env: Record<string, string | undefined> = process.env,
): MarketplaceConfig {
  // MAINNET is the default and the only network this module targets by
  // default — the owner brief: "I want it to be mainnet not testnet so I can
  // pay for servers". Testnet requires an explicit OCEAN_NETWORK=testnet plus
  // explicit OCEAN_CHAIN_ID / OCEAN_AQUARIUS_URL overrides; nothing ever
  // defaults to a testnet chain.
  const network: OceanNetwork = env.OCEAN_NETWORK === 'testnet' ? 'testnet' : 'mainnet';
  const chainId = Number(env.OCEAN_CHAIN_ID || OCEAN_POLYGON_DEFAULTS.chainId);
  return {
    aquariusUrl: (
      env.OCEAN_AQUARIUS_URL ||
      (network === 'mainnet' ? 'https://aquarius.mainnet.oceanprotocol.com' : '')
    ).replace(/\/$/, ''),
    publisherAddress: env.OCEAN_PUBLISHER_ADDRESS || null,
    publisherPrivateKey: env.OCEAN_PUBLISHER_PRIVATE_KEY || null,
    network,
    chainId,
    publishEnabled: String(env.MARKETPLACE_PUBLISH_ENABLED ?? 'true') !== 'false',
    minGroupSize: Number(env.MARKETPLACE_MIN_GROUP_SIZE || 10),
    consentThreshold: Number(env.MARKETPLACE_CONSENT_THRESHOLD || 0.8),
    license: env.MARKETPLACE_DATASET_LICENSE || 'CC-BY-4.0 (aggregate statistics only)',
    nodeUrl: (env.OCEAN_NODE_URL || OCEAN_MAINNET_NODE_URL).replace(/\/$/, '') + '/',
    rpcUrl: env.OCEAN_RPC_URL || OCEAN_POLYGON_DEFAULTS.rpcUrl,
    factoryAddress: env.OCEAN_ERC721_FACTORY || OCEAN_POLYGON_DEFAULTS.factoryAddress,
    fixedRateExchangeAddress:
      env.OCEAN_FIXED_RATE_EXCHANGE || OCEAN_POLYGON_DEFAULTS.fixedRateExchangeAddress,
    oceanTokenAddress: env.OCEAN_TOKEN_ADDRESS || OCEAN_POLYGON_DEFAULTS.oceanTokenAddress,
    c2d: {
      allowRawAlgorithm: String(env.OCEAN_C2D_ALLOW_RAW_ALGORITHM ?? 'true') !== 'false',
      allowNetworkAccess: String(env.OCEAN_C2D_ALLOW_NETWORK_ACCESS ?? 'false') === 'true',
      trustedAlgorithmPublishers: (env.OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
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
