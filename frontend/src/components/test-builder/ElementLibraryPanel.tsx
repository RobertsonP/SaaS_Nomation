import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileX,
  Loader2,
  MousePointerClick,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ProjectElement } from '../../types/element.types';
import { ElementPreviewCard } from '../elements/ElementPreviewCard';
import { TablePreviewCard } from '../elements/TablePreviewCard';
import { DropdownPreviewCard } from '../elements/DropdownPreviewCard';
import { CellStepData } from '../elements/CellSelectorPopover';
import { AnalyzeUrlsModal } from '../analysis/AnalyzeUrlsModal';
import { projectsAPI } from '../../lib/api';

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  analyzed: boolean;
}

const PAGE_SIZE = 50;

interface ElementLibraryPanelProps {
  elements?: ProjectElement[];
  projectId?: string;
  onSelectElement: (element: ProjectElement) => void;
  onAddStep?: (step: CellStepData) => void;
  isLoading: boolean;
  selectedElementType?: string;
  selectedUrl?: string;
  onElementTypeChange?: (type: string) => void;
  onUrlChange?: (url: string) => void;
  previewMode?: 'auto' | 'css' | 'screenshot';
  showQuality?: boolean;
  compact?: boolean;
  setShowLivePicker: (show: boolean) => void;
  onAnalyzePages?: () => void;
  onAnalyzeSelected?: (urlIds: string[]) => void;
  onClearElements?: () => void;
  projectUrls?: ProjectUrl[];
  isAnalyzing?: boolean;
}

const UNATTRIBUTED_KEY = '__unattributed__';
const SHARED_KEY = '__shared__';

// Region suffixes appended to descriptions by element-detection.service.ts
// `getVisualLocation()` (lines 929-1003). Only chrome regions go into the
// Shared bucket — page-specific regions like form/main content do NOT.
const SHARED_REGIONS = new Set([
  'top navigation',
  'navigation',
  'header',
  'footer',
  'left sidebar',
  'right sidebar',
  'sidebar',
]);

const REGION_REGEX = / in (top navigation|navigation|header|footer|left sidebar|right sidebar|sidebar|login form|search form|signup form|form|main content)$/i;

function extractRegion(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(REGION_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function isSharedRegion(description: string | undefined): boolean {
  const region = extractRegion(description);
  return region !== null && SHARED_REGIONS.has(region);
}

const TYPE_LABELS: Record<string, string> = {
  button: 'Buttons',
  input: 'Inputs',
  link: 'Links',
  form: 'Forms',
  navigation: 'Navigation',
  heading: 'Headings',
  text: 'Text',
  image: 'Images',
  table: 'Tables',
  dropdown: 'Dropdowns',
  'dropdown-option': 'Dropdown Options',
  toggle: 'Toggles',
  tab: 'Tabs',
  accordion: 'Accordions',
  modal: 'Modals',
  'modal-trigger': 'Modal Triggers',
  element: 'Generic Elements',
  other: 'Other',
};

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

function elementSortKey(el: ProjectElement): string {
  return (el.description || el.selector || '').toLowerCase();
}

export function ElementLibraryPanel({
  elements: elementsProp,
  projectId,
  onSelectElement,
  onAddStep,
  isLoading,
  selectedElementType,
  setShowLivePicker,
  onAnalyzePages,
  onAnalyzeSelected,
  onClearElements,
  projectUrls = [],
  isAnalyzing = false,
}: ElementLibraryPanelProps) {
  const [showUrlPicker, setShowUrlPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

  // Pagination state (only used when projectId is provided)
  const [paginatedElements, setPaginatedElements] = useState<ProjectElement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  // Per-page summary fetched once at mount — drives the sidebar regardless of
  // which elements are currently loaded into memory.
  const [pageIndex, setPageIndex] = useState<Array<{
    sourceUrlId: string | null;
    url: string | null;
    title: string | null;
    elementCount: number;
  }> | null>(null);

  const usePagination = !!projectId;
  const elements = usePagination ? paginatedElements : (elementsProp || []);

  // Map the currently-selected page URL to the matching sourceUrlId from the
  // server page index. Null when no real page is selected (Shared bucket,
  // Unattributed bucket, or no selection yet).
  const selectedSourceUrlId = useMemo<string | null>(() => {
    if (!selectedPageUrl || !pageIndex) return null;
    if (selectedPageUrl === SHARED_KEY || selectedPageUrl === UNATTRIBUTED_KEY) return null;
    const entry = pageIndex.find(p => p.url === selectedPageUrl);
    return entry?.sourceUrlId ?? null;
  }, [selectedPageUrl, pageIndex]);

  // Fetch paginated elements from backend, scoped to the selected page when one
  // is chosen. Without scoping, clicking a page in the sidebar showed nothing
  // until the user clicked Load More enough times to bring that page's elements
  // into the global subset — broken UX. Now: pick page → fetch JUST that page.
  const fetchElements = useCallback(async (skip: number, append: boolean) => {
    if (!projectId) return;
    const isInitial = !append;
    if (isInitial) setPaginationLoading(true);
    else setLoadMoreLoading(true);

    try {
      // Shared and Unattributed are client-derived buckets — to populate them
      // accurately we need ALL project elements in memory, not a 50-element
      // window. Use a high take when those buckets are selected and skip the
      // server-side sourceUrlId filter (it's null for those views anyway).
      const isPseudoBucketFetch =
        selectedPageUrl === SHARED_KEY || selectedPageUrl === UNATTRIBUTED_KEY;
      const params: { skip: number; take: number; sourceUrlId?: string; type?: string } = {
        skip,
        take: isPseudoBucketFetch ? 5000 : PAGE_SIZE,
      };
      if (selectedSourceUrlId) params.sourceUrlId = selectedSourceUrlId;
      if (selectedElementType && selectedElementType !== 'all') params.type = selectedElementType;

      const result = await projectsAPI.getElementsPaginated(projectId, params);
      setPaginatedElements(prev => append ? [...prev, ...result.elements] : result.elements);
      setTotalCount(result.total);
    } catch (error) {
      console.error('Failed to load elements:', error);
    } finally {
      if (isInitial) setPaginationLoading(false);
      else setLoadMoreLoading(false);
    }
  }, [projectId, selectedSourceUrlId, selectedElementType, selectedPageUrl]);

  // Load (or re-load) elements when the selected page or type filter changes.
  // Don't pre-clear paginatedElements — let the new fetch atomically replace
  // it on response. Pre-clearing makes the right panel blank for ~200-500ms,
  // which feels like a full page reload on every sidebar click.
  useEffect(() => {
    if (usePagination) {
      fetchElements(0, false);
    }
  }, [usePagination, fetchElements]);

  // Fetch the per-page summary once when projectId is known.
  const refreshPageIndex = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await projectsAPI.getElementPages(projectId);
      setPageIndex(result.pages);
    } catch (error) {
      console.error('Failed to load element page index:', error);
      // Graceful fallback: leave pageIndex as null and the sidebar will derive
      // pages from the loaded subset (legacy behaviour).
    }
  }, [projectId]);

  useEffect(() => {
    refreshPageIndex();
  }, [refreshPageIndex]);

  // Live Picker save (and any other elements-added flow) dispatches the
  // 'nomation:elements-changed' window event. Refresh both the per-page index
  // and the element list when it fires so the user sees their picks instantly.
  useEffect(() => {
    if (!projectId) return;
    const onChange = () => {
      refreshPageIndex();
      fetchElements(0, false);
    };
    window.addEventListener('nomation:elements-changed', onChange);
    return () => window.removeEventListener('nomation:elements-changed', onChange);
  }, [projectId, refreshPageIndex, fetchElements]);

  const handleLoadMore = () => {
    fetchElements(paginatedElements.length, true);
  };

  // Pagination only makes sense for real-page filters (server-scoped via
  // sourceUrlId). The Shared and Unattributed pseudo-buckets are derived
  // client-side from the loaded subset — pagination doesn't apply.
  const isPseudoBucket =
    selectedPageUrl === SHARED_KEY || selectedPageUrl === UNATTRIBUTED_KEY;
  const hasMore =
    usePagination && !isPseudoBucket && paginatedElements.length < totalCount;

  // Handle analyze button
  const handleAnalyzeClick = () => {
    if (projectUrls.length > 0 && onAnalyzeSelected) {
      setShowUrlPicker(true);
    } else if (onAnalyzePages) {
      onAnalyzePages();
    }
  };

  const handleAnalyzeFromPicker = (urlIds: string[]) => {
    if (onAnalyzeSelected) {
      onAnalyzeSelected(urlIds);
      setShowUrlPicker(false);
    }
  };

  // Filter elements by search query
  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          (el.description || '').toLowerCase().includes(query) ||
          (el.selector || '').toLowerCase().includes(query) ||
          (el.elementType || '').toLowerCase().includes(query) ||
          (el.attributes?.text || '').toLowerCase().includes(query) ||
          (el.sourceUrl?.url || '').toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [elements, searchQuery]);

  // Unique selectors of currently-loaded shared-region elements.
  // The Shared bucket count and contents are derived from loaded elements only
  // (pageIndex doesn't carry region info today). When all elements are loaded
  // this is exact; otherwise it grows as the user paginates.
  const sharedSelectors = useMemo(() => {
    const set = new Set<string>();
    for (const el of filteredElements) {
      if (isSharedRegion(el.description)) set.add(el.selector);
    }
    return set;
  }, [filteredElements]);

  // Build page list for left panel.
  // Primary source: server-side page index (real DB element counts, all pages
  // visible from t=0 regardless of which elements are paginated into memory).
  // Pages with the same URL are merged here — the database may contain
  // multiple ProjectUrl rows for the same URL when discovery ran before the
  // case-preservation fix and the same path was stored under both /Foo and
  // /foo. Without this dedup the sidebar shows the same page twice.
  const pageList = useMemo(() => {
    let list: Array<{ url: string; title: string; count: number }>;
    if (pageIndex && pageIndex.length > 0) {
      const merged = new Map<string, { url: string; title: string; count: number }>();
      for (const entry of pageIndex) {
        const url = entry.url || UNATTRIBUTED_KEY;
        const title = url === UNATTRIBUTED_KEY
          ? 'Unattributed elements'
          : (entry.title || getPathFromUrl(url));
        const existing = merged.get(url);
        if (existing) {
          existing.count += entry.elementCount;
          // Prefer a non-empty / non-fallback title when one entry has a real one.
          if ((!existing.title || existing.title === getPathFromUrl(url)) && entry.title) {
            existing.title = entry.title;
          }
        } else {
          merged.set(url, { url, title, count: entry.elementCount });
        }
      }
      list = Array.from(merged.values()).sort(
        (a, b) => b.count - a.count || a.title.localeCompare(b.title),
      );
    } else {
      // Fallback: derive from loaded elements (pre-server-index behaviour).
      const pages = new Map<string, { url: string; title: string; count: number }>();
      for (const el of filteredElements) {
        const url = el.sourceUrl?.url || UNATTRIBUTED_KEY;
        const title = url === UNATTRIBUTED_KEY
          ? 'Unattributed elements'
          : (el.sourceUrl?.title || getPathFromUrl(url));
        if (!pages.has(url)) pages.set(url, { url, title, count: 0 });
        pages.get(url)!.count++;
      }
      list = Array.from(pages.values()).sort(
        (a, b) => b.count - a.count || a.title.localeCompare(b.title),
      );
    }

    // Always prepend the Shared bucket when the project has any pages (so the
    // user can find chrome regardless of which page they're on). Count is
    // approximate — derived from currently-loaded elements only — until the
    // backend gains a proper region field. We label this in the UI so the
    // approximation isn't misleading.
    if (list.length > 0) {
      list = [
        { url: SHARED_KEY, title: 'Shared elements', count: sharedSelectors.size },
        ...list,
      ];
    }
    return list;
  }, [pageIndex, filteredElements, sharedSelectors]);

  // Auto-select first REAL page when data loads or selection becomes invalid.
  // Don't auto-select the Shared bucket — that's a frontend filter that's only
  // useful once a user explicitly opts into it.
  useEffect(() => {
    if (pageList.length === 0) return;
    if (selectedPageUrl && pageList.some(p => p.url === selectedPageUrl)) return;
    const firstReal = pageList.find(p => p.url !== SHARED_KEY) ?? pageList[0];
    setSelectedPageUrl(firstReal.url);
  }, [pageList, selectedPageUrl]);

  // Elements for the selected page, grouped by type.
  // - SHARED_KEY: chrome elements deduped by selector across all pages.
  // - Real page: paginatedElements is already scoped to this page on the
  //   server — we just hide chrome (it lives under the Shared bucket).
  // - Unattributed: filter by missing sourceUrl on the loaded subset.
  // - Null/missing elementType lands in a distinct 'other' bucket.
  // Within each type group, elements are sorted alphabetically.
  const elementsByType = useMemo(() => {
    let els: ProjectElement[];
    if (selectedPageUrl === SHARED_KEY) {
      const seen = new Set<string>();
      els = [];
      for (const el of filteredElements) {
        if (!isSharedRegion(el.description)) continue;
        if (seen.has(el.selector)) continue;
        seen.add(el.selector);
        els.push(el);
      }
    } else if (selectedPageUrl === UNATTRIBUTED_KEY) {
      els = filteredElements.filter(el => !el.sourceUrl);
    } else {
      // Real page: server has already scoped via sourceUrlId; hide chrome.
      els = filteredElements.filter(el => !isSharedRegion(el.description));
    }

    const groups = new Map<string, ProjectElement[]>();
    for (const el of els) {
      const type = el.elementType || 'other';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(el);
    }

    groups.forEach(arr =>
      arr.sort((a, b) => elementSortKey(a).localeCompare(elementSortKey(b))),
    );

    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [filteredElements, selectedPageUrl]);

  const toggleTypeCollapse = (type: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Show the spinner only on the first mount (when there's literally nothing
  // to display). On subsequent page-clicks keep the previous page's elements
  // visible until the new fetch resolves — a brief flash of stale data is
  // far less jarring than a blank panel that feels like a full reload.
  if (isLoading || (paginationLoading && elements.length === 0)) {
    return (
      <div className="empty" style={{ padding: '40px 20px' }}>
        <div className="empty-icon">
          <Loader2 size={20} className="animate-spin" />
        </div>
        <h3>Loading elements…</h3>
        <p>Pulling element library from the server.</p>
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="empty" style={{ padding: '40px 20px' }}>
        <div className="empty-icon">
          <FileX size={20} />
        </div>
        <h3>No elements found</h3>
        <p>Analyze pages to discover elements, or use the Live Picker.</p>
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {(onAnalyzePages || onAnalyzeSelected) && (
            <button
              type="button"
              onClick={handleAnalyzeClick}
              className="btn btn-success btn-sm"
            >
              <Sparkles size={12} />
              <span>Analyze pages</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLivePicker(true)}
            className="btn btn-primary btn-sm"
          >
            <MousePointerClick size={12} />
            <span>Live picker</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col" style={{ height: '100%', background: 'var(--paper)' }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: 12,
          borderBottom: '1px solid var(--hair)',
          background: 'var(--surface)',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'Inter Tight',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
              }}
            >
              Elements
            </span>
            <span
              className="tabular dim"
              style={{
                fontSize: 11,
                background: 'var(--surface-2)',
                border: '1px solid var(--hair)',
                padding: '1px 7px',
                borderRadius: 999,
              }}
            >
              {usePagination
                ? (searchQuery.trim()
                    ? `${filteredElements.length} of ${paginatedElements.length} loaded · ${totalCount} total`
                    : `${paginatedElements.length} of ${totalCount}`)
                : `${filteredElements.length}${filteredElements.length !== elements.length ? ` of ${elements.length}` : ''}`}
            </span>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {(onAnalyzePages || onAnalyzeSelected) && (
              <button
                type="button"
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing}
                className="btn btn-success btn-sm"
                style={isAnalyzing ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{isAnalyzing ? 'Analyzing…' : 'Analyze'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLivePicker(true)}
              className="btn btn-primary btn-sm"
            >
              <MousePointerClick size={12} />
              <span>Live picker</span>
            </button>
            {onClearElements && elements.length > 0 && (
              <button
                type="button"
                onClick={onClearElements}
                className="icon-btn"
                title="Clear all elements"
                style={{ color: 'var(--clay)' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search elements…"
            style={{ paddingLeft: 30, paddingRight: searchQuery ? 30 : 12 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="icon-btn"
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 22,
                height: 22,
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="row" style={{ flex: 1, overflow: 'hidden', gap: 0, alignItems: 'stretch' }}>
        {/* Left panel: Page list */}
        <div
          style={{
            width: '30%',
            borderRight: '1px solid var(--hair)',
            overflowY: 'auto',
            background: 'var(--bone)',
          }}
        >
          <div style={{ padding: 8 }}>
            {pageList.map(page => {
              const isPseudo = page.url === UNATTRIBUTED_KEY || page.url === SHARED_KEY;
              const active = selectedPageUrl === page.url;
              return (
                <button
                  key={page.url}
                  type="button"
                  onClick={() => setSelectedPageUrl(page.url)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    marginBottom: 3,
                    border: `1px solid ${active ? 'var(--moss-edge)' : 'transparent'}`,
                    background: active ? 'var(--moss-soft)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    cursor: 'pointer',
                    transition: 'background .12s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {active && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 2,
                        background: 'var(--moss)',
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontWeight: active ? 600 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {page.title}
                  </div>
                  {!isPseudo && (
                    <div
                      className="dim mono"
                      style={{
                        fontSize: 10.5,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getPathFromUrl(page.url)}
                    </div>
                  )}
                  <div className="dim tabular" style={{ fontSize: 10.5, marginTop: 1 }}>
                    {page.count} element{page.count === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
            {pageList.length === 0 && (
              <p className="dim" style={{ fontSize: 12, padding: 12, textAlign: 'center' }}>
                No pages analyzed yet
              </p>
            )}
          </div>
        </div>

        {/* Right panel: Elements grouped by type */}
        <div style={{ width: '70%', overflowY: 'auto', background: 'var(--paper)' }}>
          <div style={{ padding: 12 }}>
            {selectedPageUrl && elementsByType.length > 0 ? (
              elementsByType.map(([type, typeElements]) => {
                const collapsed = collapsedTypes.has(type);
                return (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => toggleTypeCollapse(type)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--hair)',
                        cursor: 'pointer',
                        transition: 'background .12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface-2)';
                      }}
                    >
                      <span className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                          {TYPE_LABELS[type] ?? type}
                        </span>
                        <span
                          className="tabular dim"
                          style={{
                            fontSize: 10.5,
                            background: 'var(--surface)',
                            border: '1px solid var(--hair)',
                            padding: '1px 6px',
                            borderRadius: 999,
                          }}
                        >
                          {typeElements.length}
                        </span>
                      </span>
                    </button>

                    {!collapsed && (
                      <div className="col" style={{ gap: 6, marginTop: 6 }}>
                        {typeElements.map(element => {
                          const hasTableData = element.elementType === 'table' && (element.tableData || (element.attributes as any)?.tableData);
                          const hasDropdownData = element.elementType === 'dropdown' && (element.dropdownData || (element.attributes as any)?.dropdownData);

                          if (hasTableData) {
                            return (
                              <div key={element.id}>
                                <TablePreviewCard element={element} onSelectElement={onSelectElement} onAddStep={onAddStep} />
                              </div>
                            );
                          }
                          if (hasDropdownData) {
                            return (
                              <div key={element.id}>
                                <DropdownPreviewCard element={element} onSelectElement={onSelectElement} onAddStep={onAddStep} />
                              </div>
                            );
                          }
                          return (
                            <ElementPreviewCard
                              key={element.id}
                              element={element}
                              onSelectElement={onSelectElement}
                              showQuality
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="dim" style={{ fontSize: 12.5, textAlign: 'center', padding: '32px 12px' }}>
                {selectedPageUrl ? 'No elements found for this page' : 'Select a page to view elements'}
              </p>
            )}

            {/* Load More */}
            {hasMore && (
              <div
                style={{
                  padding: '14px 0',
                  textAlign: 'center',
                  borderTop: '1px solid var(--hair)',
                  marginTop: 12,
                }}
              >
                <p className="dim" style={{ fontSize: 11, marginBottom: 8 }}>
                  Showing {paginatedElements.length} of {totalCount} elements
                </p>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadMoreLoading}
                  className="btn btn-outline btn-sm"
                  style={loadMoreLoading ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {loadMoreLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Loading…</span>
                    </>
                  ) : (
                    <span>Load more ({Math.min(PAGE_SIZE, totalCount - paginatedElements.length)} more)</span>
                  )}
                </button>
              </div>
            )}

            {/* No Results */}
            {filteredElements.length === 0 && elements.length > 0 && (
              <div style={{ textAlign: 'center', padding: '40px 12px' }}>
                <p className="dim" style={{ marginBottom: 8, fontSize: 12.5 }}>
                  No elements match your search
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn btn-ghost btn-sm"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* URL Picker Modal */}
      <AnalyzeUrlsModal
        isOpen={showUrlPicker}
        onClose={() => setShowUrlPicker(false)}
        projectUrls={projectUrls}
        onAnalyze={handleAnalyzeFromPicker}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
}
