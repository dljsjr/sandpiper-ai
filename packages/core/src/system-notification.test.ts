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
  it('preserves the background process, peer inbox, and context data shapes', () => {
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Tool,
        sourceId: 'background_process',
        instructions: 'Process completed.',
        data: { process: { id: 'build', exitCode: 0, exitSignal: null } },
      }),
    ).toBe(
      '<sandpiper_system_notification source_type="tool" source_id="background_process">\n' +
        '  <instructions>Process completed.</instructions>\n' +
        '  <process id="build" exitCode="0" exitSignal="null"/>\n' +
        '</sandpiper_system_notification>',
    );
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.PeerMessage,
        sourceId: 'tattler-pending-inbox',
        instructions: 'Pending messages arrived.',
        data: { pendingMessageCount: 2 },
      }),
    ).toBe(
      '<sandpiper_system_notification source_type="peer" source_id="tattler-pending-inbox">\n' +
        '  <instructions>Pending messages arrived.</instructions>\n' +
        '  <pendingMessageCount value="2"/>\n' +
        '</sandpiper_system_notification>',
    );
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Harness,
        sourceId: 'system',
        data: { contextUsage: { contextWindow: 1000, percentUsed: 50, tokensUsed: undefined } },
      }),
    ).toBe(
      '<sandpiper_system_notification source_type="harness" source_id="system">\n' +
        '  <contextUsage>\n' +
        '    <contextWindow value="1000"/>\n' +
        '    <percentUsed value="50"/>\n' +
        '    <tokensUsed value="undefined"/>\n' +
        '  </contextUsage>\n' +
        '</sandpiper_system_notification>',
    );
  });

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
        sourceType: SystemNotificationSourceType.Tool,
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
        sourceType: SystemNotificationSourceType.Tool,
        sourceId: 'demo',
        data: {
          'not xml': 'value',
        },
      }),
    ).toContain('<field name="not xml" value="value"/>');
    expect(
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Tool,
        sourceId: 'demo',
        data: { parent: { 'not xml': 'value' } },
      }),
    ).toContain('  <parent>\n    <field name="not xml" value="value"/>\n  </parent>');
  });

  it('rejects empty notifications', () => {
    expect(() =>
      formatSystemNotification({
        sourceType: SystemNotificationSourceType.Tool,
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
      deliverAs: SystemNotificationDelivery.NextTurn,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'nextTurn' });
  });

  it('sends message without triggerTurn by default', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.NextTurn,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), {
      deliverAs: 'nextTurn',
    });
  });

  it('supports explicit requests to wake agent with triggerTurn', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.NextTurn,
      triggerTurn: true,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'nextTurn', triggerTurn: true });
  });

  it('supports explicit requests to suppress waking the agent with triggerTurn', () => {
    const sender = { sendMessage: vi.fn() };

    sendSystemNotification(sender, {
      sourceType: SystemNotificationSourceType.Harness,
      sourceId: 'background_process',
      instructions: 'Process completed.',
      deliverAs: SystemNotificationDelivery.NextTurn,
      triggerTurn: false,
    });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.anything(), { deliverAs: 'nextTurn', triggerTurn: false });
  });
});
