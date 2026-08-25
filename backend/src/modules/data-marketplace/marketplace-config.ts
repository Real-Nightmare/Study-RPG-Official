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
  /**
   * Master switch for the whole data marketplace (owner policy update:
   * "the data marketplace should be very strict to not sell PII related
   * things"). Defaults to FALSE so a stock deployment never exposes any
   * marketplace surface. When disabled, every data-marketplace endpoint
   * answers 501 (the internal benchmark pipeline keeps working), the
   * idle-capacity Ocean Node never starts, and nothing is ever published.
   */
  enabled: boolean;
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
  /**
   * Compute-to-Data ONLY (owner policy update). When true (always, in this
   * codebase — see C2D_ONLY below) a dataset may only be "published" once a
   * real on-chain compute asset exists: buyers run their algorithms against
   * the sanitized aggregate inside an isolated compute environment. There is
   * deliberately NO download/access path: nobody ever buys a copy of the
   * data, they buy compute on it. Kept as an explicit flag so tests and the
   * status endpoint can assert it.
   */
  c2dOnly: boolean;
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
   * Allow buyers/researchers to submit their own algorithm code (raw) to run
   * against the aggregate. This is the entire point of compute-to-data: a
   * researcher proves their analysis on our data without ever receiving it.
   * Safe because published files are strictly sanitized numeric aggregates —
   * there are no raw rows, no PII and no credentials to leak — and because
   * `allowNetworkAccess` is permanently false (see below) so nothing can be
   * exfiltrated from the compute environment. Default: true.
   */
  allowRawAlgorithm: boolean;
  /**
   * Whether compute jobs may reach the public internet. PERMANENTLY FALSE:
   * this is a hard invariant of the marketplace (owner policy: strict
   * no-leak C2D). The value can no longer be overridden by env or API —
   * `normalizeC2dPolicy` forces it to false everywhere. Compute happens in
   * the isolated `c2d-runner` container (compose) which additionally has no
   * network route at all.
   */
  allowNetworkAccess: false;
  /**
   * Allowlist of algorithm publisher addresses (comma-separated). Empty
   * (default) = any published algorithm is allowed on top of raw algorithms.
   */
  trustedAlgorithmPublishers: string[];
}

/**
 * Hard invariant: the marketplace is COMPUTE-TO-DATA ONLY. No access/download
 * service may ever be registered for any asset; buyers purchase the right to
 * run an algorithm against the sanitized aggregate inside an isolated
 * compute environment, never the data itself. This constant is asserted at
 * publish time; changing it requires a code change (by design).
 */
export const C2D_ONLY = true as const;

/** Isolated compute-to-data runner configuration (researcher test harness). */
export interface C2dRunnerConfig {
  /** Base URL of the c2d-runner sidecar (network-isolated container). */
  url: string;
  /** Per-job wall clock timeout in seconds. */
  timeoutSeconds: number;
}

export function getC2dRunnerConfig(
  env: Record<string, string | undefined> = process.env,
): C2dRunnerConfig {
  return {
    url: (env.C2D_RUNNER_URL || 'http://c2d-runner:9000').replace(/\/$/, ''),
    timeoutSeconds: Math.max(1, Number(env.C2D_RUNNER_TIMEOUT_S || 30)),
  };
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
    enabled: String(env.MARKETPLACE_ENABLED ?? 'false') === 'true',
    aquariusUrl: (
      env.OCEAN_AQUARIUS_URL ||
      (network === 'mainnet' ? 'https://aquarius.mainnet.oceanprotocol.com' : '')
    ).replace(/\/$/, ''),
    publisherAddress: env.OCEAN_PUBLISHER_ADDRESS || null,
    publisherPrivateKey: env.OCEAN_PUBLISHER_PRIVATE_KEY || null,
    network,
    chainId,
    publishEnabled: String(env.MARKETPLACE_PUBLISH_ENABLED ?? 'true') !== 'false',
    c2dOnly: C2D_ONLY,
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
      // Hard invariant — never configurable, never true. See C2DPolicyConfig.
      allowNetworkAccess: false,
      trustedAlgorithmPublishers: (env.OCEAN_C2D_TRUSTED_ALGORITHM_PUBLISHERS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  };
}

/**
 * Force an incoming C2D policy (API DTO or env override) into the strict,
 * publish-safe shape: network access is always false regardless of what the
 * caller asked for, and unknown values are dropped.
 */
export function normalizeC2dPolicy(
  override?: Partial<{
    allowRawAlgorithm: boolean;
    allowNetworkAccess: boolean;
    trustedAlgorithmPublishers: string[];
  }>,
  base?: C2DPolicyConfig,
): C2DPolicyConfig {
  const source = base ?? {
    allowRawAlgorithm: true,
    allowNetworkAccess: false as const,
    trustedAlgorithmPublishers: [],
  };
  return {
    allowRawAlgorithm: override?.allowRawAlgorithm ?? source.allowRawAlgorithm,
    // Strict no-leak policy: compute jobs NEVER get internet access.
    allowNetworkAccess: false,
    trustedAlgorithmPublishers:
      override?.trustedAlgorithmPublishers ?? source.trustedAlgorithmPublishers,
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
    // Double gate: the idle-capacity node is a marketplace surface, so it
    // requires BOTH OCEAN_NODE_ENABLED=true AND MARKETPLACE_ENABLED=true.
    // With the marketplace off (the default) it can never start.
    enabled:
      String(env.OCEAN_NODE_ENABLED ?? 'false') === 'true' &&
      String(env.MARKETPLACE_ENABLED ?? 'false') === 'true',
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
