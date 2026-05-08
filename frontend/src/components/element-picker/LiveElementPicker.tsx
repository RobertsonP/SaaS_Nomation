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

// Mirror of backend UrlNormalizationService.normalizeUrl. Used to compare a
// captured iframe URL against the project's URL list so we can warn the user
// when they're picking from a page outside the project.
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'msclkid', 'twclid',
  'mc_cid', 'mc_eid', '_ga', '_gl',
  'trk', 'trkid', 'tracking', 'click_id', 'clickid',
  'sessionid', 'session', 'sid',
];

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    let host = parsed.host;
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'host.docker.internal') {
      const port = parsed.port || '';
      host = `localhost${port ? ':' + port : ''}`;
    }
    host = host.replace(/^www\./, '');
    let path = parsed.pathname.replace(/\/+$/, '') || '/';
    path = path.replace(/\/(index|default)\.(html?|php|aspx?|jsp)$/i, '') || '/';
    TRACKING_PARAMS.forEach(p => parsed.searchParams.delete(p));
    const sorted = new URLSearchParams(
      [...parsed.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    );
    const qs = sorted.toString();
    return `${parsed.protocol.toLowerCase()}//${host.toLowerCase()}${path}${qs ? '?' + qs : ''}`;
  } catch {
    return url;
  }
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

  // Normalized project URL set used to detect when the user has navigated the
  // captured browser to a page that's NOT in the project URL list. When a pick
  // is saved from such a page it lands in the "Unattributed" bucket, so we
  // surface the situation up front with an inline hint + "Add to project".
  const [projectUrlNorms, setProjectUrlNorms] = useState<Set<string> | null>(null);
  const [isAddingUrl, setIsAddingUrl] = useState(false);

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

  // Load the project's URL list (normalized) once when the picker opens.
  // Drives the "this URL isn't in your project" hint so users understand why
  // some saves land in the Unattributed bucket.
  const refreshProjectUrls = async () => {
    try {
      const res = await projectsAPI.getById(projectId);
      const urls: Array<{ url: string }> = res?.data?.urls || [];
      const set = new Set<string>();
      for (const u of urls) {
        if (u?.url) set.add(normalizeUrl(u.url));
      }
      setProjectUrlNorms(set);
    } catch (err) {
      logger.warn('Failed to load project URLs for picker hint:', err);
      setProjectUrlNorms(new Set());
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshProjectUrls();
  }, [isOpen, projectId]);

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

  // Saved picks from a URL not present in the project's URL list will land
  // in the Unattributed bucket — surface this to the user before they save.
  const capturedNorm = capturedUrl ? normalizeUrl(capturedUrl) : '';
  const isCapturedUrlUnattributed = !!hasCaptured
    && !!capturedNorm
    && projectUrlNorms !== null
    && !projectUrlNorms.has(capturedNorm);

  const handleAddCapturedUrl = async () => {
    if (!capturedUrl || isAddingUrl) return;
    setIsAddingUrl(true);
    try {
      const res = await projectsAPI.getById(projectId);
      const existing: Array<{ url: string; title?: string; description?: string }> =
        (res?.data?.urls || []).map((u: any) => ({ url: u.url, title: u.title, description: u.description }));
      const next = [
        ...existing,
        { url: capturedUrl, title: 'Picker capture', description: 'Added from Live Picker' },
      ];
      await projectsAPI.update(projectId, { urls: next });
      // Refresh the local set so the hint disappears after save.
      await refreshProjectUrls();
      // Tell any element library panels to refetch the page index.
      window.dispatchEvent(new CustomEvent('nomation:elements-changed', {
        detail: { projectId, source: 'live-picker-add-url' },
      }));
    } catch (err: any) {
      logger.error('Failed to add captured URL to project:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to add URL to project');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsAddingUrl(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bone)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          background: 'var(--paper)',
          borderBottom: '1px solid var(--hair)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div className="row" style={{ gap: 8 }}>
          <div className="brand-mark" style={{ width: 16, height: 16 }} />
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.005em',
            }}
          >
            Live Element Picker
          </h3>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasCaptured && capturedUrl ? (
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                color: 'var(--slate)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
              title={capturedUrl}
            >
              {capturedUrl}
            </span>
          ) : (
            <span className="dim" style={{ fontSize: 11.5 }}>
              Navigate in the browser window, then capture
            </span>
          )}
        </div>
        {savedCount > 0 && (
          <span className="pill pill-ok">
            <span className="dot" />
            Saved this session: {savedCount}
          </span>
        )}
        <button onClick={handleClose} className="btn btn-outline btn-sm">
          {savedCount > 0 ? 'Done' : 'Close'}
        </button>
      </div>

      {error && (
        <div
          style={{
            flexShrink: 0,
            background: 'var(--clay-soft)',
            borderBottom: '1px solid var(--clay-edge)',
            color: 'var(--clay)',
            padding: '8px 16px',
            fontSize: 12,
            textAlign: 'center',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {isCapturedUrlUnattributed && (
        <div
          style={{
            flexShrink: 0,
            background: 'var(--amber-soft)',
            borderBottom: '1px solid var(--amber-edge)',
            color: 'var(--amber)',
            padding: '8px 16px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            <strong>This page isn't in your project URLs.</strong> Picks saved from here will appear under{' '}
            <span style={{ fontWeight: 600 }}>"Unattributed elements"</span> until you add the URL.
          </span>
          <button
            onClick={handleAddCapturedUrl}
            disabled={isAddingUrl}
            className="btn btn-sm"
            style={{
              flexShrink: 0,
              background: 'var(--amber)',
              color: 'var(--bone)',
              borderColor: 'var(--amber)',
              opacity: isAddingUrl ? 0.5 : 1,
            }}
          >
            {isAddingUrl ? 'Adding…' : '+ Add this URL'}
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {isLoading && !hasCaptured && (
          <div className="row" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <div className="col" style={{ alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--moss-soft)',
                  border: '1px solid var(--moss-edge)',
                  color: 'var(--moss)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'Inter Tight',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    marginBottom: 4,
                  }}
                >
                  Starting browser session…
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  A browser window will open. This may take a moment.
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !hasCaptured && sessionToken && (
          <div
            className="col"
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              textAlign: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'var(--moss-soft)',
                border: '1px solid var(--moss-edge)',
                color: 'var(--moss)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <circle cx="6" cy="6" r="0.5" fill="currentColor" />
                <circle cx="8.5" cy="6" r="0.5" fill="currentColor" />
                <circle cx="11" cy="6" r="0.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'Inter Tight',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                  marginBottom: 6,
                }}
              >
                Browser is open
              </div>
              <p
                className="dim"
                style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}
              >
                Navigate to the page you want to inspect in the browser window, then click{' '}
                <strong style={{ color: 'var(--ink)' }}>Capture page</strong> to load it here for picking.
              </p>
            </div>
            <button
              onClick={handleCapturePage}
              disabled={isCapturing}
              className="btn btn-primary btn-lg"
              style={{
                marginTop: 6,
                opacity: isCapturing ? 0.6 : 1,
                cursor: isCapturing ? 'not-allowed' : 'pointer',
              }}
            >
              {isCapturing ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Capturing…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Capture page</span>
                </>
              )}
            </button>
          </div>
        )}

        {hasCaptured && capturedHtml && (
          <>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 12,
                background: 'var(--bone)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="row"
                style={{
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  gap: 12,
                }}
              >
                <span
                  className="mono"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={capturedUrl ?? ''}
                >
                  {capturedUrl} — Click any element to select it
                </span>
                <button
                  onClick={handleCapturePage}
                  disabled={isCapturing}
                  className="btn btn-outline btn-sm"
                  style={{ flexShrink: 0, opacity: isCapturing ? 0.5 : 1 }}
                >
                  {isCapturing ? 'Capturing…' : 'Recapture'}
                </button>
              </div>
              <iframe
                ref={iframeRef}
                title="Captured page"
                srcDoc={capturedHtml}
                sandbox="allow-same-origin"
                onLoad={handleIframeLoad}
                style={{
                  flex: 1,
                  width: '100%',
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid var(--hair-2)',
                  boxShadow: 'var(--shadow-md)',
                  minHeight: 500,
                }}
              />
              {hoverSelector && (
                <div
                  className="mono dim"
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={hoverSelector}
                >
                  Hover: {hoverSelector}
                </div>
              )}
            </div>

            <aside
              style={{
                flexShrink: 0,
                width: 320,
                borderLeft: '1px solid var(--hair)',
                background: 'var(--paper)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: 14, flex: 1 }}>
                {picked ? (
                  <div>
                    <h4
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        margin: '0 0 8px',
                      }}
                    >
                      Selected Element
                    </h4>
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--hair)',
                        borderRadius: 6,
                        padding: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
                        {picked.description}
                      </div>
                      <code
                        className="mono"
                        style={{
                          fontSize: 11,
                          background: 'var(--surface)',
                          border: '1px solid var(--hair)',
                          padding: '4px 6px',
                          borderRadius: 4,
                          display: 'block',
                          marginBottom: 8,
                          color: 'var(--moss)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {picked.selector}
                      </code>
                      <div
                        className="col"
                        style={{ gap: 2, fontSize: 11, color: 'var(--ink-3)' }}
                      >
                        <span>
                          Tag: <span style={{ color: 'var(--ink-2)' }}>&lt;{picked.tagName}&gt;</span>
                        </span>
                        <span>
                          Type: <span style={{ color: 'var(--ink-2)' }}>{picked.elementType}</span>
                        </span>
                        {picked.textPreview && (
                          <span>
                            Text:{' '}
                            <span style={{ color: 'var(--ink-2)' }}>{picked.textPreview}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleSaveElement}
                      disabled={isSaving}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      {isSaving ? 'Saving…' : 'Save to library'}
                    </button>
                  </div>
                ) : (
                  <div className="empty" style={{ padding: '24px 8px' }}>
                    <div className="empty-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 9h6v8a3 3 0 0 1-6 0z" />
                        <path d="M9 9V5a3 3 0 0 1 6 0v4" />
                        <path d="M12 2v3" />
                      </svg>
                    </div>
                    <h3>No element picked</h3>
                    <p>Click any element in the captured page on the left to select it.</p>
                  </div>
                )}
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: 12,
                  borderTop: '1px solid var(--hair)',
                }}
              >
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 11,
                    color: 'var(--ink-3)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--moss)', marginBottom: 4 }}>
                    Tips
                  </div>
                  <ul style={{ paddingLeft: 16, margin: 0, lineHeight: 1.6 }}>
                    <li>Click any element in the snapshot to select it.</li>
                    <li>The captured page is a static DOM — no hover/dynamic states.</li>
                    <li>External CSS/images may not load due to CORS; selector is still valid.</li>
                    <li>Recapture after navigating in the browser window.</li>
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
