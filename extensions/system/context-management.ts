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
</warning>
`.trim();
      warned = true;
    }

    if (!alerted && ctxUsage?.percent && ctxUsage.percent >= CONTEXT_USAGE_ALERT_THRESHOLD) {
      contextNotificationInstructions = `
<alert>
Context usage is above 80%. Stop current work and capture continuity now — compaction is imminent.

  1. Call memory_write for every decision, preference, pattern, or fact from this session not yet in YAAMS. Do this first.
  2. Checkpoint active work (standup / CHECKPOINT.md).
  3. Update project docs and tasks if shared truth changed.

Resume your original work once you've finished.
</alert>
`.trim();
      alerted = true;
    }

    const notification = {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'system',
      instructions: contextNotificationInstructions,
      data: contextNotificationData,
      deliverAs: 'nextTurn',
      triggerTurn: false,
    };

    if (notification.instructions) {
      sendSystemNotification(pi, notification as SandpiperSystemNotification);
    } else if (notification.data) {
      sendSystemNotification(pi, notification as SandpiperSystemNotification);
    }
  });
}
