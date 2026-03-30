export interface SystemRuntimeState {
  startupContextPending: boolean;
  coldStartGuidancePending: boolean;
}

export function createSystemRuntimeState(): SystemRuntimeState {
  return {
    startupContextPending: true,
    coldStartGuidancePending: false,
  };
}
