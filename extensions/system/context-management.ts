import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  type SandpiperSystemNotification,
  SystemNotificationSourceType,
  sendSystemNotification,
} from 'sandpiper-ai-core';

const CONTEXT_USAGE_WARNING_THRESHOLD = 50;
const CONTEXT_USAGE_ALERT_THRESHOLD = 80;
const CONTEXT_USAGE_NOTIFICATION_STEP_SIZE = 10;

export function registerContextManagementHooks(pi: ExtensionAPI) {
  let nextContextMessageThreshold = CONTEXT_USAGE_NOTIFICATION_STEP_SIZE;
  let warned = false;
  let alerted = false;
  let currentModel: Model<Api> | undefined;

  pi.on('turn_end', async (_evt, ctx) => {
    const ctxUsage = ctx.getContextUsage();
    const model = ctx.model;

    let contextNotificationData: Record<string, unknown> | undefined;
    let contextNotificationInstructions: string | undefined;

    if (model && currentModel !== model) {
      contextNotificationData = contextNotificationData ?? {};
      contextNotificationData.modelInfo = { provider: model.provider, modelId: model.id, modelName: model.name };
    }
    currentModel = model;

    if (ctxUsage?.percent && ctxUsage.percent >= nextContextMessageThreshold) {
      nextContextMessageThreshold =
        Math.ceil(ctxUsage.percent / CONTEXT_USAGE_NOTIFICATION_STEP_SIZE) * CONTEXT_USAGE_NOTIFICATION_STEP_SIZE;
      contextNotificationData = contextNotificationData ?? {};
      contextNotificationData.contextUsage = ctxUsage
        ? {
            contextWindow: ctxUsage.contextWindow,
            percentUsed: ctxUsage.percent ?? undefined,
            tokensUsed: ctxUsage.tokens ?? undefined,
          }
        : undefined;
    }

    if (alerted && ctxUsage?.percent && ctxUsage.percent < CONTEXT_USAGE_ALERT_THRESHOLD) {
      alerted = false;
    }

    if (warned && ctxUsage?.percent && ctxUsage.percent < CONTEXT_USAGE_WARNING_THRESHOLD) {
      warned = false;
    }

    if (!warned && ctxUsage?.percent && ctxUsage.percent >= CONTEXT_USAGE_WARNING_THRESHOLD) {
      contextNotificationInstructions = `
<warning>
Context usage is above 50%. Start thinking about taking a break to capture any information/memory you want to preserve before compaction hits.
If you switch away from work to capture context, resume your original work afterwords. Do not worry about the compaction boundary once you have continuity captured.
  - checkpoint active work,
  - write durable facts/decisions/patterns to memory,
  - update project docs/tasks if shared truth changed.
  - consider other key files (SELF, AGENTS, etc) as well
</warning>
`.trim();
      warned = true;
    }

    if (!alerted && ctxUsage?.percent && ctxUsage.percent >= CONTEXT_USAGE_ALERT_THRESHOLD) {
      contextNotificationInstructions = `
<alert>
Context usage is above 80%. Adjust your plan and do any checkpointing or continuity preserving work now before compaction or overflow.
If you switch away from work to capture context, resume your original work afterwords. Do not worry about the compaction boundary once you have continuity captured.
  - checkpoint active work,
  - write durable facts/decisions/patterns to memory,
  - update project docs/tasks if shared truth changed.
  - consider other key files (SELF, AGENTS, etc) as well
</alert>
`.trim();
      alerted = true;
    }

    const notification = {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'system',
      instructions: contextNotificationInstructions,
      data: contextNotificationData,
    };

    if (notification.instructions) {
      sendSystemNotification(pi, notification as SandpiperSystemNotification);
    } else if (notification.data) {
      sendSystemNotification(pi, notification as SandpiperSystemNotification);
    }
  });
}
