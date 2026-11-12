import {
  type AgentToolResult,
  keyHint,
  type Theme,
  type ToolRenderResultOptions,
} from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import type { WebFetchToolDetails, WebFetchToolInput } from './tool-operation.js';

type WebFetchRenderColor = 'accent' | 'error' | 'muted' | 'success' | 'toolOutput' | 'toolTitle';

export interface WebFetchRenderTheme {
  fg(color: WebFetchRenderColor, text: string): string;
  bold(text: string): string;
}

type WebFetchRenderedToolResult = Pick<AgentToolResult<WebFetchToolDetails>, 'content' | 'details'>;

function textOutput(result: WebFetchRenderedToolResult): string {
  return result.content
    .filter((content) => content.type === 'text')
    .map((content) => content.text)
    .join('\n')
    .trimEnd();
}

function lineCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function pluralizeLines(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`;
}

function colorMultiline(theme: WebFetchRenderTheme, color: WebFetchRenderColor, text: string): string {
  return text
    .split('\n')
    .map((line) => theme.fg(color, line))
    .join('\n');
}

export function formatWebFetchRenderCall(args: WebFetchToolInput, theme: WebFetchRenderTheme): string {
  const url = args.url ? theme.fg('accent', args.url) : theme.fg('toolOutput', '...');
  const followLinks = args.followLinks ? theme.fg('muted', ' (follow links)') : '';
  const renderedLabel = args.renderer ? ` (rendered with ${args.renderer})` : args.render ? ' (rendered)' : '';
  const rendered = renderedLabel ? theme.fg('muted', renderedLabel) : '';
  return `${theme.fg('toolTitle', theme.bold('web_fetch'))} ${url}${followLinks}${rendered}`;
}

export function formatWebFetchRenderResult(
  result: WebFetchRenderedToolResult,
  options: ToolRenderResultOptions,
  theme: WebFetchRenderTheme,
  expandHint: string,
): string {
  const output = textOutput(result);

  if (result.details.error) {
    return `\n${theme.fg('error', output || result.details.error)}`;
  }

  if (options.isPartial) {
    return `\n${theme.fg('muted', 'Fetching...')}`;
  }

  if (options.expanded) {
    return output ? `\n${colorMultiline(theme, 'toolOutput', output)}` : '';
  }

  const title = result.details.title?.trim();
  const label = title ? theme.fg('accent', title) : theme.fg('accent', result.details.url);
  const lines = lineCount(output);
  const suffix = lines > 0 ? ` (${pluralizeLines(lines)}, ${expandHint})` : ' (no text output)';

  return `\n${theme.fg('success', 'Fetched')} ${label}${theme.fg('muted', suffix)}`;
}

export function renderWebFetchCall(args: WebFetchToolInput, theme: Theme): Text {
  return new Text(formatWebFetchRenderCall(args, theme), 0, 0);
}

export function renderWebFetchResult(
  result: WebFetchRenderedToolResult,
  options: ToolRenderResultOptions,
  theme: Theme,
): Text {
  return new Text(formatWebFetchRenderResult(result, options, theme, keyHint('app.tools.expand', 'to expand')), 0, 0);
}
