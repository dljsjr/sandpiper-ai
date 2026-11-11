import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  type SandpiperSystemNotification,
  SystemNotificationSourceType,
  sendSystemNotification,
} from '../../packages/core/src/system-notification.js';

const CONTEXT_USAGE_WARNING_THRESHOLD = 50;
const CONTEXT_USAGE_ALERT_THRESHOLD = 80;
const CONTEXT_USAGE_NOTIFICATION_STEP_SIZE = 10;

export function registerContextManagementHooks(pi: ExtensionAPI) {
  let nextContextMessageThreshold = CONTEXT_USAGE_NOTIFICATION_STEP_SIZE;
  let warned = false;
  let alerted = false;
  let currentModel: Model<Api> | undefined;

  pi.on('session_compact', () => {
    nextContextMessageThreshold = CONTEXT_USAGE_NOTIFICATION_STEP_SIZE;
  });

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
      contextNotificationInstructions = 'Context usage is above 50%.';
      warned = true;
    }

    if (!alerted && ctxUsage?.percent && ctxUsage.percent >= CONTEXT_USAGE_ALERT_THRESHOLD) {
      contextNotificationInstructions =
        "Context usage is above 80%. Make sure you've persisted anything you don't want to forget before continuing your current work.";
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
