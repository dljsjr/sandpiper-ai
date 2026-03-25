/**
 * Preflight check registration system.
 *
 * Extensions call registerPreflightCheck() during their factory body to register
 * synchronous health checks. The system extension reads the registry at session_start,
 * runs all checks, and displays a single aggregated diagnostic banner.
 *
 * Callbacks MUST be synchronous — they are called during the extension factory body
 * which cannot await. Use existsSync, env var reads, and other sync operations only.
 */

// No pi imports — this module is framework-independent.

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

interface RegisteredCheck {
  readonly key: string;
  readonly check: PreflightCheck;
}

/** Module-level registry — populated at extension factory time, read at session_start. */
const registry: RegisteredCheck[] = [];

/**
 * Register a preflight check.
 *
 * Call this during your extension's factory body (not inside an event handler).
 * The check callback will be invoked by the system extension at session_start.
 *
 * @param key    Unique identifier for this check (e.g. 'shell-relay:integration').
 *               Used to deduplicate checks across reloads.
 * @param check  Synchronous function returning a PreflightDiagnostic.
 */
export function registerPreflightCheck(key: string, check: PreflightCheck): void {
  // Deduplicate by key — on reload, the factory runs again and would double-register.
  const existing = registry.findIndex((r) => r.key === key);
  if (existing !== -1) {
    registry[existing] = { key, check };
  } else {
    registry.push({ key, check });
  }
}

/**
 * Run all registered preflight checks and return the results.
 * Called by the system extension at session_start.
 */
export function runPreflightChecks(): PreflightDiagnostic[] {
  return registry.map(({ check }) => {
    try {
      return check();
    } catch (err) {
      // A throwing check is itself a diagnostic failure.
      return {
        key: 'preflight:error',
        healthy: false,
        message: `Preflight check threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}
