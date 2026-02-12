import { useState, useMemo } from 'react';
import { ProjectElement } from '../../types/element.types';
import { ElementPreviewCard } from '../elements/ElementPreviewCard';
import { TablePreviewCard } from '../elements/TablePreviewCard';
import { AnalyzeUrlsModal } from '../analysis/AnalyzeUrlsModal';

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  analyzed: boolean;
}

interface ElementLibraryPanelProps {
  elements: ProjectElement[];
  onSelectElement: (element: ProjectElement) => void;
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

// Type filter chip definitions
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'button', label: 'Buttons' },
  { value: 'input', label: 'Inputs' },
  { value: 'link', label: 'Links' },
  { value: 'table', label: 'Tables' },
  { value: 'form', label: 'Forms' },
  { value: 'navigation', label: 'Nav' },
] as const;

const QUALITY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High', min: 0.8 },
  { value: 'medium', label: 'Medium', min: 0.5, max: 0.8 },
  { value: 'low', label: 'Low', max: 0.5 },
] as const;

function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

export function ElementLibraryPanel({
  elements,
  onSelectElement,
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  // Filter elements
  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      // Type filter
      if (typeFilter !== 'all' && el.elementType !== typeFilter) return false;

      // Quality filter
      if (qualityFilter !== 'all') {
        const q = el.overallQuality ?? el.confidence ?? 0.5;
        const filter = QUALITY_FILTERS.find(f => f.value === qualityFilter);
        if (filter && 'min' in filter && q < (filter.min ?? 0)) return false;
        if (filter && 'max' in filter && q >= (filter.max ?? 1)) return false;
      }

      // Search filter
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
  }, [elements, typeFilter, qualityFilter, searchQuery]);

  // Group by source URL
  const groupedElements = useMemo(() => {
    const groups = new Map<string, { url: string; title: string; elements: ProjectElement[] }>();

    for (const el of filteredElements) {
      const urlKey = el.sourceUrl?.url || 'unknown';
      const title = el.sourceUrl?.title || getPathFromUrl(urlKey);

      if (!groups.has(urlKey)) {
        groups.set(urlKey, { url: urlKey, title, elements: [] });
      }
      groups.get(urlKey)!.elements.push(el);
    }

    // Sort groups by element count (descending)
    return Array.from(groups.values()).sort((a, b) => b.elements.length - a.elements.length);
  }, [filteredElements]);

  const toggleGroup = (url: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  if (isLoading) {
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
              {filteredElements.length}{filteredElements.length !== elements.length ? ` of ${elements.length}` : ''}
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
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium"
                title="Clear all elements"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
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

        {/* Type Filter Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {TYPE_FILTERS.map(f => {
            const count = f.value === 'all'
              ? elements.length
              : elements.filter(e => e.elementType === f.value).length;
            if (count === 0 && f.value !== 'all') return null;
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  typeFilter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Quality Filter Chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUALITY_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setQualityFilter(f.value)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                qualityFilter === f.value
                  ? f.value === 'high' ? 'bg-green-600 text-white' :
                    f.value === 'medium' ? 'bg-yellow-500 text-white' :
                    f.value === 'low' ? 'bg-red-500 text-white' :
                    'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content — Grouped by URL */}
      <div className="flex-1 overflow-y-auto">
        {groupedElements.map(group => {
          const isCollapsed = collapsedGroups.has(group.url);
          const path = getPathFromUrl(group.url);

          return (
            <div key={group.url} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.url)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={group.url}>
                    {group.title || path}
                  </span>
                  {group.title && group.title !== path && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:inline">
                      {path}
                    </span>
                  )}
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full ml-2">
                  {group.elements.length}
                </span>
              </button>

              {/* Group Elements */}
              {!isCollapsed && (
                <div className="px-4 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {group.elements.map(element => (
                    element.elementType === 'table' && (element.tableData || (element.attributes as any)?.tableData) ? (
                      <div key={element.id} className="lg:col-span-2">
                        <TablePreviewCard
                          element={element}
                          onSelectElement={onSelectElement}
                        />
                      </div>
                    ) : (
                      <ElementPreviewCard
                        key={element.id}
                        element={element}
                        onSelectElement={onSelectElement}
                        showQuality
                      />
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* No Results */}
        {filteredElements.length === 0 && elements.length > 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-2">No elements match your filters</p>
            <button
              onClick={() => {
                setTypeFilter('all');
                setQualityFilter('all');
                setSearchQuery('');
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
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
