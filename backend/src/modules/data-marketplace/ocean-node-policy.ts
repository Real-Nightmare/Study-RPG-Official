/**
 * Idle-capacity Ocean Node policy (pure, unit-tested).
 *
 * Decides whether the Ocean Node container should be started, stopped, or left
 * alone, based only on activity samples and the current state. The rule set is
 * deliberately simple and conservative:
 *
 *  - A live user (any WebSocket connection or focus session started within the
 *    idle window) counts as activity → the node must STOP immediately, because
 *    study traffic always outranks spare-capacity mining.
 *  - The node only STARTS after the server has been continuously idle for the
 *    configured idle window, AND the post-stop cooldown has elapsed (so a busy
 *    evening doesn't flap the container on and off).
 *  - A hard daily start cap is enforced by the monitor, not here.
 *
 * All timestamps are epoch millis. `idleSinceMs` is the moment the current idle
 * streak began (null while there is activity).
 */

export type NodeAction = 'start' | 'stop' | 'none';

export interface NodePolicyInput {
  /** True when any user activity was observed in the current sample. */
  activity: boolean;
  /** Whether the Ocean Node container is currently running. */
  nodeRunning: boolean;
  /** Start of the current idle streak, or null while activity is present. */
  idleSinceMs: number | null;
  /** When the node was last stopped (null if never started this process). */
  stoppedAtMs: number | null;
  /** Current time (epoch millis). */
  now: number;
  /** Idle duration required before the node may start (ms). */
  idleWindowMs: number;
  /** Cooldown after a stop before the node may start again (ms). */
  cooldownMs: number;
}

/**
 * Advance the idle-streak bookkeeping for one sample.
 * Returns the new `idleSinceMs` value (null = activity is present).
 */
export function updateIdleSince(
  previous: number | null,
  activity: boolean,
  now: number,
): number | null {
  if (activity) return null;
  return previous ?? now;
}

/** Decide what to do with the node given the current sample and state. */
export function decideNodeAction(input: NodePolicyInput): NodeAction {
  const { activity, nodeRunning, idleSinceMs, stoppedAtMs, now, idleWindowMs, cooldownMs } = input;

  // Users are on the platform — the node must never compete with them.
  if (activity) {
    return nodeRunning ? 'stop' : 'none';
  }

  // Node already running and nobody is online: keep earning.
  if (nodeRunning) {
    return 'none';
  }

  // Not running and nobody online: only start once the server has been idle
  // for the full window and the post-stop cooldown has elapsed.
  if (idleSinceMs === null) {
    return 'none';
  }
  const idleEnough = now - idleSinceMs >= idleWindowMs;
  const cooledDown = stoppedAtMs === null || now - stoppedAtMs >= cooldownMs;
  return idleEnough && cooledDown ? 'start' : 'none';
}
