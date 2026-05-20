export enum SystemNotificationSourceType {
  Tool = 'tool',
  Extension = 'extension',
  Harness = 'harness',
  Adapter = 'adapter',
  PeerMessage = 'peer',
}

export enum SystemNotificationDelivery {
  Steer = 'steer',
  FollowUp = 'followUp',
  NextTurn = 'nextTurn',
}

export interface SystemNotificationAttributes {
  readonly sourceType: SystemNotificationSourceType;
  readonly sourceId: string;
  readonly deliverAs?: SystemNotificationDelivery;
  readonly triggerTurn?: boolean;
}

export interface SystemNotificationInstructions {
  readonly instructions: string;
  readonly data?: Record<string, unknown>;
}

export interface SystemNotificationData {
  readonly instructions?: string;
  readonly data: Record<string, unknown>;
}

export type SystemNotificationWithInstructions = SystemNotificationAttributes & SystemNotificationInstructions;
export type SystemNotificationWithData = SystemNotificationAttributes & SystemNotificationData;

export type SandpiperSystemNotification = SystemNotificationWithInstructions | SystemNotificationWithData;

export const SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE = 'sandpiper:system-notification';

export interface SystemNotificationDetails {
  readonly sourceType: SystemNotificationSourceType;
  readonly sourceId: string;
  readonly instructions?: string;
  readonly data?: Record<string, unknown>;
}

export interface SystemNotificationMessage {
  readonly customType: typeof SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE;
  readonly content: string;
  readonly display: false;
  readonly details: SystemNotificationDetails;
}

type SystemNotificationDeliveryWireValue = 'steer' | 'followUp' | 'nextTurn';

export interface SystemNotificationSender {
  sendMessage(
    message: SystemNotificationMessage,
    options: { readonly deliverAs: SystemNotificationDeliveryWireValue; readonly triggerTurn?: boolean },
  ): unknown;
}

function deliveryWireValue(delivery: SystemNotificationDelivery): SystemNotificationDeliveryWireValue {
  switch (delivery) {
    case SystemNotificationDelivery.Steer:
      return 'steer';
    case SystemNotificationDelivery.FollowUp:
      return 'followUp';
    case SystemNotificationDelivery.NextTurn:
      return 'nextTurn';
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function primitiveToString(value: string | number | boolean | null): string {
  return value === null ? 'null' : String(value);
}

function isXmlName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value);
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function formatTagName(key: string): { readonly tagName: string; readonly nameAttribute: string } {
  if (isXmlName(key)) {
    return { tagName: key, nameAttribute: '' };
  }

  return { tagName: 'field', nameAttribute: ` name="${escapeXml(key)}"` };
}

function formatPrimitiveAttribute(name: string, value: string | number | boolean | null): string {
  return ` ${name}="${escapeXml(primitiveToString(value))}"`;
}

function isPrimitiveAttributeRecord(
  value: Record<string, unknown>,
): value is Record<string, string | number | boolean | null> {
  return Object.entries(value).every(([key, entry]) => isXmlName(key) && isPrimitive(entry));
}

function formatDataEntry(key: string, value: unknown, level: number): string {
  const { tagName, nameAttribute } = formatTagName(key);
  const prefix = indent(level);

  if (isPrimitive(value)) {
    return `${prefix}<${tagName}${nameAttribute}${formatPrimitiveAttribute('value', value)}/>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix}<${tagName}${nameAttribute}/>`;

    const items = value.map((item) => formatDataEntry('item', item, level + 1));
    return [`${prefix}<${tagName}${nameAttribute}>`, ...items, `${prefix}</${tagName}>`].join('\n');
  }

  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${prefix}<${tagName}${nameAttribute}/>`;

    if (isPrimitiveAttributeRecord(value)) {
      const attributes = entries
        .map(([name, entry]) => formatPrimitiveAttribute(name, entry as string | number | boolean | null))
        .join('');
      return `${prefix}<${tagName}${nameAttribute}${attributes}/>`;
    }

    const children = entries.map(([childKey, childValue]) => formatDataEntry(childKey, childValue, level + 1));
    return [`${prefix}<${tagName}${nameAttribute}>`, ...children, `${prefix}</${tagName}>`].join('\n');
  }

  return `${prefix}<${tagName}${nameAttribute}${formatPrimitiveAttribute('value', String(value))}/>`;
}

function notificationInstructions(notification: SandpiperSystemNotification): string | undefined {
  if (typeof notification.instructions !== 'string') return;
  const instructions = notification.instructions.trim();
  return instructions.length > 0 ? instructions : undefined;
}

function notificationData(notification: SandpiperSystemNotification): Record<string, unknown> | undefined {
  if (notification.data === undefined) return;
  return Object.keys(notification.data).length > 0 ? notification.data : undefined;
}

function validateNotification(notification: SandpiperSystemNotification): void {
  if (notification.sourceId.trim().length === 0) {
    throw new Error('System notification sourceId must not be empty');
  }

  if (!notificationInstructions(notification) && !notificationData(notification)) {
    throw new Error('System notification requires instructions, data, or both');
  }
}

export function formatSystemNotification(notification: SandpiperSystemNotification): string {
  validateNotification(notification);

  const attributes = [
    formatPrimitiveAttribute('source_type', notification.sourceType),
    formatPrimitiveAttribute('source_id', notification.sourceId),
  ].join('');
  const lines = [`<sandpiper_system_notification${attributes}>`];
  const instructions = notificationInstructions(notification);
  const data = notificationData(notification);

  if (instructions) {
    lines.push(`${indent(1)}<instructions>${escapeXml(instructions)}</instructions>`);
  }

  if (data) {
    lines.push(...Object.entries(data).map(([key, value]) => formatDataEntry(key, value, 1)));
  }

  lines.push('</sandpiper_system_notification>');
  return lines.join('\n');
}

export function createSystemNotificationMessage(notification: SandpiperSystemNotification): SystemNotificationMessage {
  validateNotification(notification);

  const instructions = notificationInstructions(notification);
  const data = notificationData(notification);

  return {
    customType: SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE,
    content: formatSystemNotification(notification),
    display: false,
    details: {
      sourceType: notification.sourceType,
      sourceId: notification.sourceId,
      ...(instructions === undefined ? {} : { instructions }),
      ...(data === undefined ? {} : { data }),
    },
  };
}

export function sendSystemNotification(
  sender: SystemNotificationSender,
  notification: SandpiperSystemNotification,
): unknown {
  return sender.sendMessage(createSystemNotificationMessage(notification), {
    deliverAs: deliveryWireValue(notification.deliverAs ?? SystemNotificationDelivery.Steer),
    triggerTurn: notification.triggerTurn,
  });
}
