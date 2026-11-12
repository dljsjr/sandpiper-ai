import { Window } from 'happy-dom';
import { vi } from 'vitest';

/** A happy-dom window installed as the browser globals CodeMirror and the page script use. */
export function installBrowser(): Window {
  const browser = new Window({ url: 'file:///prompt-editor.html' });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', browser.document);
  vi.stubGlobal('navigator', browser.navigator);
  vi.stubGlobal('HTMLElement', browser.HTMLElement);
  vi.stubGlobal('MutationObserver', browser.MutationObserver);
  vi.stubGlobal('ResizeObserver', browser.ResizeObserver);
  vi.stubGlobal('requestAnimationFrame', browser.requestAnimationFrame.bind(browser));
  vi.stubGlobal('cancelAnimationFrame', browser.cancelAnimationFrame.bind(browser));
  vi.stubGlobal('getComputedStyle', browser.getComputedStyle.bind(browser));
  vi.stubGlobal('localStorage', browser.localStorage);
  return browser;
}
