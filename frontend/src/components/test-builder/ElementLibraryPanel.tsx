import { useState, useMemo, useEffect, useCallback } from 'react';
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

  // Fetch paginated elements from backend
  const fetchElements = useCallback(async (skip: number, append: boolean) => {
    if (!projectId) return;
    const isInitial = !append;
    if (isInitial) setPaginationLoading(true);
    else setLoadMoreLoading(true);

    try {
      const params: { skip: number; take: number } = {
        skip,
        take: PAGE_SIZE,
      };

      const result = await projectsAPI.getElementsPaginated(projectId, params);
      setPaginatedElements(prev => append ? [...prev, ...result.elements] : result.elements);
      setTotalCount(result.total);
    } catch (error) {
      console.error('Failed to load elements:', error);
    } finally {
      if (isInitial) setPaginationLoading(false);
      else setLoadMoreLoading(false);
    }
  }, [projectId]);

  // Load first page when projectId or type filter changes
  useEffect(() => {
    if (usePagination) {
      setPaginatedElements([]);
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

  const handleLoadMore = () => {
    fetchElements(paginatedElements.length, true);
  };

  const hasMore = usePagination && paginatedElements.length < totalCount;

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
  // Plus a synthetic "Shared elements" bucket for chrome (footer/nav/header/sidebar)
  // so the same footer link doesn't duplicate under every page.
  const pageList = useMemo(() => {
    let list: Array<{ url: string; title: string; count: number }>;
    if (pageIndex && pageIndex.length > 0) {
      list = pageIndex
        .map(entry => {
          const url = entry.url || UNATTRIBUTED_KEY;
          const title = url === UNATTRIBUTED_KEY
            ? 'Unattributed elements'
            : (entry.title || getPathFromUrl(url));
          return { url, title, count: entry.elementCount };
        })
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
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

    // Prepend the Shared bucket when any chrome elements have been loaded.
    if (sharedSelectors.size > 0) {
      list = [
        { url: SHARED_KEY, title: 'Shared elements', count: sharedSelectors.size },
        ...list,
      ];
    }
    return list;
  }, [pageIndex, filteredElements, sharedSelectors]);

  // Auto-select first page when data loads or selection becomes invalid
  useEffect(() => {
    if (pageList.length > 0 && (!selectedPageUrl || !pageList.some(p => p.url === selectedPageUrl))) {
      setSelectedPageUrl(pageList[0].url);
    }
  }, [pageList, selectedPageUrl]);

  // Elements for selected page, grouped by type.
  // - SHARED_KEY: chrome elements deduped by selector across all pages.
  // - Real page: elements for that sourceUrl, EXCLUDING shared-region duplicates
  //   (they live under the Shared bucket).
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
    } else {
      els = filteredElements.filter(el => {
        if (isSharedRegion(el.description)) return false;
        const url = el.sourceUrl?.url || UNATTRIBUTED_KEY;
        return url === selectedPageUrl;
      });
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

  if (isLoading || paginationLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading elements...</p>
        </div>
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium mb-2">No elements found</p>
          <p className="text-sm mb-4">Analyze pages to discover elements, or use the Live Picker</p>
          <div className="flex gap-2 justify-center">
            {(onAnalyzePages || onAnalyzeSelected) && (
              <button
                onClick={handleAnalyzeClick}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Analyze Pages
              </button>
            )}
            <button
              onClick={() => setShowLivePicker(true)}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Live Picker
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Elements
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              {usePagination
                ? (searchQuery.trim()
                    ? `${filteredElements.length} matching of ${paginatedElements.length} loaded (${totalCount} total)`
                    : `${paginatedElements.length} of ${totalCount}`)
                : `${filteredElements.length}${filteredElements.length !== elements.length ? ` of ${elements.length}` : ''}`
              }
            </span>
          </h3>
          <div className="flex gap-2">
            {(onAnalyzePages || onAnalyzeSelected) && (
              <button
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  isAnalyzing
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            )}
            <button
              onClick={() => setShowLivePicker(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              Live Picker
            </button>
            {onClearElements && elements.length > 0 && (
              <button
                onClick={onClearElements}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium"
                title="Clear all elements"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search elements..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Page list */}
        <div className="w-[30%] border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-2">
            {pageList.map(page => {
              const isPseudo = page.url === UNATTRIBUTED_KEY || page.url === SHARED_KEY;
              return (
                <button
                  key={page.url}
                  onClick={() => setSelectedPageUrl(page.url)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                    selectedPageUrl === page.url
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="truncate font-medium">{page.title}</div>
                  {!isPseudo && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getPathFromUrl(page.url)}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400">{page.count} elements</div>
                </button>
              );
            })}
            {pageList.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 p-3">No pages analyzed yet</p>
            )}
          </div>
        </div>

        {/* Right panel: Elements grouped by type */}
        <div className="w-[70%] overflow-y-auto">
          <div className="p-3">
            {selectedPageUrl && elementsByType.length > 0 ? (
              elementsByType.map(([type, typeElements]) => (
                <div key={type} className="mb-3">
                  {/* Type section header */}
                  <button
                    onClick={() => toggleTypeCollapse(type)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {(TYPE_LABELS[type] ?? type)} ({typeElements.length})
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">
                      {collapsedTypes.has(type) ? '\u25B8' : '\u25BE'}
                    </span>
                  </button>

                  {/* Element cards */}
                  {!collapsedTypes.has(type) && (
                    <div className="mt-2 space-y-2">
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
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {selectedPageUrl ? 'No elements found for this page' : 'Select a page to view elements'}
              </p>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="py-4 text-center border-t border-gray-100 dark:border-gray-700 mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Showing {paginatedElements.length} of {totalCount} elements
                </p>
                <button
                  onClick={handleLoadMore}
                  disabled={loadMoreLoading}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    loadMoreLoading
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loadMoreLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Loading...
                    </span>
                  ) : (
                    `Load More (${Math.min(PAGE_SIZE, totalCount - paginatedElements.length)} more)`
                  )}
                </button>
              </div>
            )}

            {/* No Results */}
            {filteredElements.length === 0 && elements.length > 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-2">No elements match your search</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
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
