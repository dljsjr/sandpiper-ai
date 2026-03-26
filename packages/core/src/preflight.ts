/**
 * Preflight check registration system.
 *
 * Extensions call registerPreflightCheck() during their factory body to register
 * synchronous health checks. The system extension collects results at session_start
 * by emitting the preflight event on the shared pi.events bus.
 *
 * Uses pi.events (the inter-extension event bus) as the communication channel.
 * This works across jiti module instances because pi.events lives on the shared
 * runtime, not in any module.
 *
 * Callbacks MUST be synchronous — pi.events.emit() is synchronous, so async
 * checks would not be awaited.
 */

// Structural types for the pi event bus — keeps core free of pi framework imports.
interface EventBus {
  on(event: string, handler: (data: unknown) => void): void;
  emit(event: string, data: unknown): void;
}

interface HasEvents {
  events: EventBus;
}

export interface PreflightDiagnostic {
  /** Unique key identifying the check (e.g. 'shell-relay:integration'). */
  readonly key: string;
  /** Whether the check passed. */
  readonly healthy: boolean;
  /** Short one-liner describing the check or the problem. */
  readonly message: string;
  /** Actionable steps shown in the diagnostic banner when unhealthy. */
  readonly instructions?: readonly string[];
}

export type PreflightCheck = () => PreflightDiagnostic;
export type PreflightCollector = (diagnostic: PreflightDiagnostic) => void;

/** Event name used on pi.events bus for preflight diagnostic collection. */
export const PREFLIGHT_EVENT = 'sandpiper:collect-diagnostics';

/**
 * Register a preflight check.
 *
 * Call this during your extension's factory body (not inside an event handler).
 * When system.ts emits PREFLIGHT_EVENT at session_start, this listener runs the
 * check and passes the result to the collector.
 *
 * @param pi    The pi ExtensionAPI (or any object with a compatible .events bus).
 * @param key   Unique identifier for this check (e.g. 'shell-relay:integration').
 * @param check Synchronous function returning a PreflightDiagnostic.
 */
export function registerPreflightCheck(pi: HasEvents, key: string, check: PreflightCheck): void {
  pi.events.on(PREFLIGHT_EVENT, (collect) => {
    const collector = collect as PreflightCollector;
    try {
      collector(check());
    } catch (err) {
      collector({
        key,
        healthy: false,
        message: `Preflight check threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

/**
 * Collect diagnostics from all registered preflight checks.
 * Call this in system.ts session_start — emits synchronously, all results
 * are populated by the time the function returns.
 *
 * @param pi The pi ExtensionAPI (or any object with a compatible .events bus).
 */
export function collectPreflightDiagnostics(pi: HasEvents): PreflightDiagnostic[] {
  const diagnostics: PreflightDiagnostic[] = [];
  pi.events.emit(PREFLIGHT_EVENT, (d: PreflightDiagnostic) => diagnostics.push(d));
  return diagnostics;
}
