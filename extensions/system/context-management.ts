import type { ExtensionAPI, SessionEntry } from '@earendil-works/pi-coding-agent';
import {
  escapeXml,
  formatSystemNotification,
  SystemNotificationSourceType,
} from '../../packages/core/src/system-notification.js';

const CONTEXT_USAGE_CUSTOM_TYPE = 'sandpiper:context-usage';
const MODEL_CUSTOM_TYPE = 'sandpiper:model';
const CONTEXT_USAGE_STEP = 10;
const CONTEXT_USAGE_ALERT_PERCENT = 80;
const CONTEXT_USAGE_ALERT =
  "Context usage is above 80%. Make sure you've persisted anything you don't want to forget before continuing your current work.";

interface ContextUsageReportV1 {
  readonly version: 1;
  readonly percentUsed: number;
  readonly tokensUsed: number;
  readonly contextWindow: number;
}

interface ModelReportV1 {
  readonly version: 1;
  readonly provider: string;
  readonly id: string;
  readonly name: string;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(2))}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(Math.round(tokens));
}

function stepOf(percentUsed: number): number {
  return Math.floor(percentUsed / CONTEXT_USAGE_STEP) * CONTEXT_USAGE_STEP;
}

// A compaction's summary may drop earlier reports, so both reports start over after one.
function lastReport<T>(
  branch: readonly SessionEntry[],
  customType: string,
  parse: (details: unknown) => T | undefined,
): T | undefined {
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (entry?.type === 'compaction') return undefined;
    if (entry?.type === 'custom_message' && entry.customType === customType) {
      const report = parse(entry.details);
      if (report) return report;
    }
  }
  return undefined;
}

function parseUsageReport(details: unknown): ContextUsageReportV1 | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const { version, percentUsed } = details as Partial<ContextUsageReportV1>;
  return version === 1 && typeof percentUsed === 'number' ? (details as ContextUsageReportV1) : undefined;
}

function parseModelReport(details: unknown): ModelReportV1 | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const { version, provider, id } = details as Partial<ModelReportV1>;
  return version === 1 && typeof provider === 'string' && typeof id === 'string'
    ? (details as ModelReportV1)
    : undefined;
}

export function registerContextManagementHooks(pi: Pick<ExtensionAPI, 'on'>) {
  // Reports are read back from the session branch, so they survive reload and resume and follow
  // /tree, and only a compaction re-arms them: readings that dip after an abort do not.
  pi.on('turn_end', (event, ctx) => {
    if (event.outcome !== 'completed') return;
    const usage = ctx.getContextUsage();
    if (!usage || usage.percent === null || usage.tokens === null) return;

    const percentUsed = Math.floor(usage.percent);
    const step = stepOf(percentUsed);
    const previous = lastReport(ctx.sessionManager.getBranch(), CONTEXT_USAGE_CUSTOM_TYPE, parseUsageReport);
    const previousStep = previous ? stepOf(previous.percentUsed) : 0;
    if (step < CONTEXT_USAGE_STEP || step <= previousStep) return;

    const element = `<contextUsage percentUsed="${percentUsed}" tokensLeft="${formatTokenCount(Math.max(0, usage.contextWindow - usage.tokens))}" contextWindow="${formatTokenCount(usage.contextWindow)}"/>`;
    const alert =
      step >= CONTEXT_USAGE_ALERT_PERCENT && previousStep < CONTEXT_USAGE_ALERT_PERCENT
        ? `\n${formatSystemNotification({ sourceType: SystemNotificationSourceType.Harness, sourceId: 'system', instructions: CONTEXT_USAGE_ALERT })}`
        : '';
    const details: ContextUsageReportV1 = {
      version: 1,
      percentUsed,
      tokensUsed: usage.tokens,
      contextWindow: usage.contextWindow,
    };
    // A turn_end entry rides along with the run's next model request and, after the run's last
    // response, waits in history without starting another request.
    return {
      entries: [
        ...event.entries,
        {
          type: 'custom_message',
          customType: CONTEXT_USAGE_CUSTOM_TYPE,
          content: element + alert,
          display: false,
          details,
        },
      ],
    };
  });

  pi.on('before_agent_start', (_event, ctx) => {
    const model = ctx.model;
    if (!model) return;
    const previous = lastReport(ctx.sessionManager.getBranch(), MODEL_CUSTOM_TYPE, parseModelReport);
    if (previous?.provider === model.provider && previous.id === model.id) return;

    const details: ModelReportV1 = { version: 1, provider: model.provider, id: model.id, name: model.name };
    return {
      message: {
        customType: MODEL_CUSTOM_TYPE,
        content: `<model provider="${escapeXml(model.provider)}" id="${escapeXml(model.id)}" name="${escapeXml(model.name)}"/>`,
        display: false,
        details,
      },
    };
  });
}
