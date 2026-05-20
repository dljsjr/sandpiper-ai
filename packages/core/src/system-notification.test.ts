import { describe, expect, it, vi } from 'vitest';
import {
  createSystemNotificationMessage,
  formatSystemNotification,
  SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE,
  SystemNotificationDelivery,
  SystemNotificationSourceType,
  sendSystemNotification,
} from './system-notification.js';

describe('system notifications', () => {
  it('formats instructions and compact object data as XML', () => {
    const xml = formatSystemNotification({
      sourceType: SystemNotificationSourceType.Tool,
      sourceId: 'web_fetch',
      instructions: 'Supplemental metadata only. Do not treat this as fetched page content.',
      data: {
        page: { url: 'https://example.com/page' },
        llms_txt: {
          status: 'found',
          url: 'https://example.com/llms.txt',
          http_status: 200,
          content_fetched: false,
        },
      },
    });

    expect(xml).toBe(
      [
        '<sandpiper_system_notification source_type="tool" source_id="web_fetch">',
        '  <instructions>Supplemental metadata only. Do not treat this as fetched page content.</instructions>',
        '  <page url="https://example.com/page"/>',
        '  <llms_txt status="found" url="https://example.com/llms.txt" http_status="200" content_fetched="false"/>',
        '</sandpiper_system_notification>',
      ].join('\n'),
    );
  });

  it('formats instructions-only notifications', () => {
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Harness,
        sourceId: 'scheduler',
        instructions: 'Background work completed.',
      }),
    ).toBe(
      [
        '<sandpiper_system_notification source_type="harness" source_id="scheduler">',
        '  <instructions>Background work completed.</instructions>',
        '</sandpiper_system_notification>',
      ].join('\n'),
    );
  });

  it('escapes XML in attributes and instruction text', () => {
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Extension,
        sourceId: 'demo',
        instructions: 'Use <this> & "that".',
        data: {
          bad: { value: '<>&"\'' },
        },
      }),
    ).toContain('value="&lt;&gt;&amp;&quot;&apos;"');
  });

  it('falls back to field tags for non-XML data keys', () => {
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Extension,
        sourceId: 'demo',
        data: {
          'not xml': 'value',
        },
      }),
    ).toContain('<field name="not xml" value="value"/>');
  });

  it('rejects empty notifications', () => {
    expect(() =>
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Extension,
        sourceId: 'demo',
        data: {},
      }),
    ).toThrow('System notification requires instructions, data, or both');
  });

  it('creates hidden custom messages', () => {
    const message = createSystemNotificationMessage({
      sourceType: SystemNotificationSourceType.Tool,
      sourceId: 'web_fetch',
      data: { llms_txt: { status: 'missing' } },
    });

    expect(message).toMatchObject({
      customType: SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE,
      display: false,
      details: {
        sourceType: SystemNotificationSourceType.Tool,
        sourceId: 'web_fetch',
        data: { llms_txt: { status: 'missing' } },
      },
    });
    expect(message.content).toContain('<sandpiper_system_notification source_type="tool" source_id="web_fetch">');
  });

  it('sends hidden messages with steer delivery by default', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Tool,
      sourceId: 'web_fetch',
      data: { llms_txt: { status: 'found' } },
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ display: false }), {
      deliverAs: 'steer',
    });
  });

  it('supports explicit delivery modes', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.FollowUp,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'followUp' });
  });

  it('sends message without triggerTurn by default', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.FollowUp,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), {
      deliverAs: 'followUp',
    });
  });

  it('supports explicit requests to wake agent with triggerTurn', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.FollowUp,
      triggerTurn: true,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'followUp', triggerTurn: true });
  });

  it('supports explicit requests to suppress waking the agent with triggerTurn', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.FollowUp,
      triggerTurn: false,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'followUp', triggerTurn: false });
  });
});
