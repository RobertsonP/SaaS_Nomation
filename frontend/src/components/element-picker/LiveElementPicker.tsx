import { useState, useEffect, useRef } from 'react';
import { browserAPI, projectsAPI } from '../../lib/api';
import { ProjectElement } from '../../types/element.types';
import { createLogger } from '../../lib/logger';
import { SelectorGenerator } from './SelectorGenerator';

const logger = createLogger('LiveElementPicker');

interface LiveElementPickerProps {
  isOpen?: boolean;
  projectId: string;
  onClose: () => void;
  onElementsSelected: (elements: ProjectElement[]) => void;
  onSelectElement?: (selector: string, description: string) => void;
  initialUrl?: string;
}

interface PickedElement {
  selector: string;
  fallbackSelectors: string[];
  description: string;
  elementType: string;
  tagName: string;
  textPreview: string;
  // Rich attributes captured from the iframe DOM so the element library card
  // renders the saved pick identically to analyzer-detected elements.
  role: string | null;
  ariaLabel: string | null;
  region: string | null;
  boundingRect: { x: number; y: number; width: number; height: number };
  cssInfo: Record<string, string>;
  resolvedColors: { backgroundColor: string; color: string };
}

const selectorGenerator = new SelectorGenerator();

function isMeaningfulId(id: string): boolean {
  if (!id || id.length < 3) return false;
  if (/^[0-9]+$/.test(id)) return false;
  if (/^[a-z0-9]{8,}$/.test(id)) return false;
  if (id.includes('reactid') || id.includes('uniqueid')) return false;
  return true;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildStructuralPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 6) {
    const tag = current.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') break;

    let segment = tag;
    const id = current.getAttribute('id');
    if (id && isMeaningfulId(id)) {
      segment = `${tag}#${id}`;
      parts.unshift(segment);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(segment);
    current = current.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

// Map an HTML tag (and optional input type) to its implicit ARIA role.
// Used to build Playwright `getByRole(...)` locators on iframe-clicked elements.
function inferAriaRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'a':
      return el.getAttribute('href') ? 'link' : null;
    case 'button':
      return 'button';
    case 'input': {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      switch (type) {
        case 'submit':
        case 'button':
        case 'reset':
          return 'button';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'range':
          return 'slider';
        case 'search':
          return 'searchbox';
        default:
          return 'textbox';
      }
    }
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    case 'nav':
      return 'navigation';
    case 'main':
      return 'main';
    case 'header':
      return 'banner';
    case 'footer':
      return 'contentinfo';
    case 'aside':
      return 'complementary';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'img':
      return el.getAttribute('alt') ? 'img' : null;
    case 'ul':
    case 'ol':
      return 'list';
    case 'li':
      return 'listitem';
    default:
      return null;
  }
}

// Best accessible-name proxy for the picker. Order: aria-label →
// associated <label for=id> → title → trimmed innerText/textContent.
function accessibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();

  const id = el.getAttribute('id');
  if (id) {
    try {
      const lbl = el.ownerDocument?.querySelector(`label[for="${CSS.escape(id)}"]`);
      const txt = (lbl?.textContent || '').trim();
      if (txt) return txt;
    } catch {
      // ignore CSS.escape failures (older sandboxed iframe)
    }
  }

  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();

  const innerText = (el as HTMLElement).innerText || '';
  const textContent = el.textContent || '';
  return (innerText || textContent).trim();
}

function escapeForLocatorString(value: string): string {
  // Single-quoted string literal in the emitted Playwright call.
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function generateSelectorCandidates(el: Element): string[] {
  const candidates: string[] = [];
  const tag = el.tagName.toLowerCase();

  // ── 1. Native Playwright locators (preferred). These match the format
  // the executor's resolveLocator parses directly into getBy*() calls.
  const role = inferAriaRole(el);
  const rawName = accessibleName(el);
  // Accessible names that are too long are usually noisy paragraph text.
  const name = rawName && rawName.length > 0 && rawName.length <= 80 ? rawName : '';

  for (const attr of ['data-testid', 'data-test', 'data-cy']) {
    const v = el.getAttribute(attr);
    if (v) candidates.push(`getByTestId('${escapeForLocatorString(v)}')`);
  }
  if (role && name) {
    candidates.push(`getByRole('${role}', { name: '${escapeForLocatorString(name)}' })`);
  }
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) {
    candidates.push(`getByPlaceholder('${escapeForLocatorString(placeholder.trim())}')`);
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim() && !role) {
    // Role + name already covered the aria-label case; only add getByLabel
    // when role inference failed.
    candidates.push(`getByLabel('${escapeForLocatorString(ariaLabel.trim())}')`);
  }
  const titleAttr = el.getAttribute('title');
  if (titleAttr && titleAttr.trim() && !role && !ariaLabel) {
    candidates.push(`getByTitle('${escapeForLocatorString(titleAttr.trim())}')`);
  }
  if (!role && name && name.length <= 60) {
    candidates.push(`getByText('${escapeForLocatorString(name)}')`);
  }

  // ── 2. CSS fallbacks (used when no native locator could be built and as
  // additional fallbackSelectors during execution).
  for (const attr of ['data-testid', 'data-test', 'data-cy']) {
    const v = el.getAttribute(attr);
    if (v) candidates.push(`[${attr}="${escapeAttr(v)}"]`);
  }

  const id = el.getAttribute('id');
  if (id && isMeaningfulId(id)) candidates.push(`#${id}`);

  if (ariaLabel) candidates.push(`${tag}[aria-label="${escapeAttr(ariaLabel)}"]`);
  const explicitRole = el.getAttribute('role');
  if (explicitRole) candidates.push(`${tag}[role="${escapeAttr(explicitRole)}"]`);

  const formName = el.getAttribute('name');
  if (formName && ['input', 'textarea', 'select', 'button'].includes(tag)) {
    candidates.push(`${tag}[name="${escapeAttr(formName)}"]`);
  }

  if (placeholder) candidates.push(`${tag}[placeholder="${escapeAttr(placeholder)}"]`);

  const path = buildStructuralPath(el);
  if (path) candidates.push(path);

  return candidates.length > 0 ? candidates : [tag];
}

function isNativeLocator(s: string): boolean {
  return /^(getByRole|getByText|getByLabel|getByTestId|getByPlaceholder|getByTitle)\(/.test(s);
}

const REGION_TAGS: Record<string, string> = {
  nav: 'top navigation',
  header: 'header',
  footer: 'footer',
  aside: 'sidebar',
  main: 'main content',
};

function detectRegion(el: Element): string | null {
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 12) {
    const tag = cur.tagName.toLowerCase();
    if (REGION_TAGS[tag]) return REGION_TAGS[tag];
    if (tag === 'form') return 'form';
    cur = cur.parentElement;
    depth++;
  }
  return null;
}

function captureCssInfo(el: Element): Record<string, string> {
  try {
    const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el as HTMLElement);
    return {
      backgroundColor: cs.backgroundColor || 'transparent',
      color: cs.color || '#000000',
      fontSize: cs.fontSize || '14px',
      fontWeight: cs.fontWeight || 'normal',
      fontFamily: cs.fontFamily || 'system-ui',
      padding: cs.padding || '0px',
      margin: cs.margin || '0px',
      border: cs.border || 'none',
      borderRadius: cs.borderRadius || '0px',
      boxShadow: cs.boxShadow || 'none',
      textAlign: cs.textAlign || 'left',
      lineHeight: cs.lineHeight || 'normal',
      textDecoration: cs.textDecoration || 'none',
      opacity: cs.opacity || '1',
      transform: cs.transform || 'none',
    };
  } catch {
    return {};
  }
}

function captureResolvedColors(el: Element): { backgroundColor: string; color: string } {
  // Walk up to 8 ancestors finding the first non-transparent background.
  let bg = '';
  let fg = '';
  let cur: Element | null = el;
  let depth = 0;
  const view = el.ownerDocument?.defaultView || window;
  while (cur && depth < 8) {
    try {
      const cs = view.getComputedStyle(cur as HTMLElement);
      if (!fg) fg = cs.color || '';
      const c = cs.backgroundColor || '';
      if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && c !== 'rgba(0,0,0,0)') {
        bg = c;
        break;
      }
    } catch {
      // ignore
    }
    cur = cur.parentElement;
    depth++;
  }
  return {
    backgroundColor: bg || 'rgb(255, 255, 255)',
    color: fg || 'rgb(0, 0, 0)',
  };
}

function pickElementFromTarget(el: Element): PickedElement {
  const candidates = generateSelectorCandidates(el);
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attributes[attr.name] = attr.value;
  }
  const innerText = (el as HTMLElement).innerText || '';
  const textContent = el.textContent || '';

  const elementData = {
    tagName: el.tagName,
    selectors: candidates,
    attributes,
    textContent: textContent.trim().substring(0, 100),
    innerText: innerText.substring(0, 200),
    boundingRect: { x: 0, y: 0, width: 0, height: 0 },
    href: el.getAttribute('href'),
    src: el.getAttribute('src'),
    value: (el as HTMLInputElement).value || null,
    placeholder: el.getAttribute('placeholder'),
    title: el.getAttribute('title'),
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
  };

  // Prefer the first native Playwright locator emitted by
  // generateSelectorCandidates over whatever the CSS scorer picks. Native
  // locators (getByRole/getByText/...) are what the executor's resolveLocator
  // parses directly; CSS path fallbacks remain available via fallbackSelectors.
  const firstNative = candidates.find(isNativeLocator);
  const selector = firstNative ?? selectorGenerator.generateOptimalSelector(elementData);
  const fallbackSelectors = candidates.filter(s => s !== selector);

  const elementType = selectorGenerator.inferElementType(elementData);
  let description = selectorGenerator.generateDescription(elementData);
  const region = detectRegion(el);
  if (region && !/ in (top navigation|navigation|header|footer|left sidebar|right sidebar|sidebar|login form|search form|signup form|form|main content)$/i.test(description)) {
    description = `${description} in ${region}`;
  }
  const textPreview = (innerText || textContent).trim().substring(0, 80);

  const rect = (el as HTMLElement).getBoundingClientRect();
  const boundingRect = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };

  return {
    selector,
    fallbackSelectors,
    description,
    elementType,
    tagName: el.tagName.toLowerCase(),
    textPreview,
    role: inferAriaRole(el),
    ariaLabel: el.getAttribute('aria-label'),
    region,
    boundingRect,
    cssInfo: captureCssInfo(el),
    resolvedColors: captureResolvedColors(el),
  };
}

function injectBaseHref(html: string, baseHref: string): string {
  if (!baseHref) return html;
  const baseTag = `<base href="${escapeAttr(baseHref)}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  }
  return `<head>${baseTag}</head>${html}`;
}

export function LiveElementPicker({
  isOpen = true,
  projectId,
  onClose,
  onSelectElement,
  initialUrl = 'https://example.com',
}: LiveElementPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [capturedHtml, setCapturedHtml] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCaptured, setHasCaptured] = useState(false);

  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [hoverSelector, setHoverSelector] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const sessionTokenRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeListenersRef = useRef<{
    doc: Document;
    onClick: (e: MouseEvent) => void;
    onMouseOver: (e: MouseEvent) => void;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const initSession = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await browserAPI.createSession(projectId, undefined, initialUrl);
        setSessionToken(session.sessionToken);
        sessionTokenRef.current = session.sessionToken;
        if (initialUrl) {
          await browserAPI.navigateSession(session.sessionToken, initialUrl);
        }
      } catch (err: any) {
        logger.error('Failed to create browser session:', err);
        setError(err.message || 'Failed to start browser session');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    return () => {
      if (sessionTokenRef.current) {
        browserAPI.closeSession(sessionTokenRef.current).catch(err =>
          logger.error('Failed to close session:', err),
        );
        sessionTokenRef.current = null;
      }
    };
  }, [isOpen, projectId, initialUrl]);

  const handleCapturePage = async () => {
    if (!sessionToken) return;
    setIsCapturing(true);
    setError(null);
    setPicked(null);

    try {
      const result = await browserAPI.capturePageState(sessionToken);
      const { html, baseHref, url } = result.data;
      setCapturedHtml(injectBaseHref(html, baseHref));
      setCapturedUrl(url);
      setHasCaptured(true);
    } catch (err: any) {
      logger.error('Capture failed:', err);
      setError(err.message || 'Could not capture page state.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsCapturing(false);
    }
  };

  const detachIframeListeners = () => {
    const prev = iframeListenersRef.current;
    if (!prev) return;
    try {
      prev.doc.removeEventListener('click', prev.onClick, true);
      prev.doc.removeEventListener('mouseover', prev.onMouseOver, true);
    } catch {
      // Document may already be torn down; ignore.
    }
    iframeListenersRef.current = null;
  };

  const handleIframeLoad = () => {
    detachIframeListeners();

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as Element | null;
      if (!target || target.nodeType !== 1) return;
      const result = pickElementFromTarget(target);
      setPicked(result);
    };

    const onMouseOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || target.nodeType !== 1) return;
      try {
        const candidates = generateSelectorCandidates(target);
        setHoverSelector(candidates[0] || target.tagName.toLowerCase());
      } catch {
        setHoverSelector(null);
      }
    };

    doc.addEventListener('click', onClick, true);
    doc.addEventListener('mouseover', onMouseOver, true);
    iframeListenersRef.current = { doc, onClick, onMouseOver };
  };

  useEffect(() => {
    return () => detachIframeListeners();
  }, []);

  const handleSaveElement = async () => {
    if (!picked || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await projectsAPI.createElements(projectId, [
        {
          selector: picked.selector,
          elementType: picked.elementType,
          description: picked.description,
          attributes: {
            tagName: picked.tagName,
            text: picked.textPreview,
            capturedAtUrl: capturedUrl,
            // Match the analyzer's attribute shape so the element library card
            // renders the saved pick with the same colored preview, dimensions,
            // and locator-type badge as analyzer-detected elements.
            role: picked.role,
            'aria-label': picked.ariaLabel,
            region: picked.region,
            boundingRect: picked.boundingRect,
            cssInfo: picked.cssInfo,
            resolvedColors: picked.resolvedColors,
            fallbackSelectors: picked.fallbackSelectors,
          },
          source: 'live-picker',
        },
      ]);
      // Notify any listening element library panels to refresh their per-page
      // index + currently-loaded elements so the saved pick appears instantly.
      window.dispatchEvent(new CustomEvent('nomation:elements-changed', {
        detail: { projectId, source: 'live-picker' },
      }));
      onSelectElement?.(picked.selector, picked.description);
      setPicked(null);
      setSavedCount(c => c + 1);
    } catch (err: any) {
      logger.error('Failed to save element:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save element');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    if (sessionToken) {
      try {
        await browserAPI.closeSession(sessionToken);
      } catch (err) {
        logger.warn('Failed to close session:', err);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col">
      <div className="flex-shrink-0 bg-gray-800 dark:bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-3">
        <h3 className="text-lg font-semibold text-blue-400">Live Element Picker</h3>
        <div className="flex-grow">
          {hasCaptured && capturedUrl ? (
            <span className="text-sm text-gray-400 dark:text-gray-500 font-mono truncate block">
              {capturedUrl}
            </span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Navigate in the browser window, then capture
            </span>
          )}
        </div>
        {savedCount > 0 && (
          <span className="px-3 py-1 text-xs font-medium bg-green-700 text-green-100 rounded-full">
            Saved this session: {savedCount}
          </span>
        )}
        <button
          onClick={handleClose}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
        >
          {savedCount > 0 ? 'Done' : 'Close'}
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 bg-red-600 dark:bg-red-700 text-white px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex-grow flex overflow-hidden">
        {isLoading && !hasCaptured && (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg">Starting browser session...</p>
              <p className="text-sm text-gray-400 mt-2">A browser window will open. This may take a moment.</p>
            </div>
          </div>
        )}

        {!isLoading && !hasCaptured && sessionToken && (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-600 dark:bg-blue-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">Browser is Open</h3>
            <p className="text-gray-400 mb-6 max-w-md">
              Navigate to the page you want in the browser window, then click Capture to load it here.
            </p>
            <button
              onClick={handleCapturePage}
              disabled={isCapturing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 font-medium text-lg transition-colors"
            >
              {isCapturing ? 'Capturing...' : 'Capture Page'}
            </button>
          </div>
        )}

        {hasCaptured && capturedHtml && (
          <>
            <div className="flex-1 overflow-auto p-3 bg-gray-900 dark:bg-gray-950 flex flex-col">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                <span className="truncate mr-4">{capturedUrl} -- Click any element to select it</span>
                <button
                  onClick={handleCapturePage}
                  disabled={isCapturing}
                  className="px-3 py-1 bg-gray-700 dark:bg-gray-800 text-gray-200 rounded hover:bg-gray-600 dark:hover:bg-gray-700 text-xs transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isCapturing ? 'Capturing...' : 'Recapture'}
                </button>
              </div>
              <iframe
                ref={iframeRef}
                title="Captured page"
                srcDoc={capturedHtml}
                sandbox="allow-same-origin"
                onLoad={handleIframeLoad}
                className="flex-1 w-full bg-white rounded border border-gray-600 dark:border-gray-700 shadow-lg"
                style={{ minHeight: '500px' }}
              />
              {hoverSelector && (
                <div className="mt-2 text-xs text-gray-400 font-mono truncate">
                  Hover: {hoverSelector}
                </div>
              )}
            </div>

            <aside className="flex-shrink-0 w-80 border-l border-gray-700 dark:border-gray-800 overflow-y-auto bg-gray-800 dark:bg-gray-900 flex flex-col">
              <div className="p-3 flex-grow">
                {picked ? (
                  <div>
                    <h4 className="font-medium text-gray-100 mb-2">Selected Element</h4>
                    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 mb-3">
                      <div className="text-sm text-gray-300 mb-2">{picked.description}</div>
                      <code className="text-xs bg-gray-700 dark:bg-gray-800 px-2 py-1 rounded block mb-2 break-all text-green-400 dark:text-green-300 font-mono">
                        {picked.selector}
                      </code>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>Tag: <span className="text-gray-300">&lt;{picked.tagName}&gt;</span></p>
                        <p>Type: <span className="text-gray-300">{picked.elementType}</span></p>
                        {picked.textPreview && (
                          <p>Text: <span className="text-gray-300">{picked.textPreview}</span></p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleSaveElement}
                      disabled={isSaving}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save to Library'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Click any element in the page on the left to select it.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 p-3 border-t border-gray-700 dark:border-gray-800">
                <div className="p-3 bg-gray-700 dark:bg-gray-800 rounded-lg text-xs text-gray-300">
                  <p className="font-medium text-blue-400 dark:text-blue-300 mb-1">Tips:</p>
                  <ul className="space-y-0.5 text-gray-400 dark:text-gray-500">
                    <li>- Click any element in the page snapshot to select it</li>
                    <li>- The captured page is a static DOM snapshot — no hover/dynamic states</li>
                    <li>- External CSS/images may not load due to CORS — selector is still valid</li>
                    <li>- Recapture after navigating in the browser window</li>
                  </ul>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
