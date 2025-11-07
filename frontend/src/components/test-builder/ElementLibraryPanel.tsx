import { ProjectElement } from '../../types/element.types';
import { ElementVisualPreview } from '../shared/ElementVisualPreview';

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
}

// Simple element type icons
const getElementTypeIcon = (elementType: string): string => {
  switch (elementType) {
    case 'button': return '🔘';
    case 'input': return '📝';
    case 'link': return '🔗';
    case 'form': return '📋';
    case 'navigation': return '🧭';
    case 'text': return '📄';
    case 'image': return '🖼️';
    default: return '⚙️';
  }
};

// Enhanced element card component with quality indicators and flexible preview modes
function EnhancedElementCard({
  element,
  onSelect,
  previewMode = 'auto',
  showQuality = false,
  compact = false
}: {
  element: ProjectElement;
  onSelect: (element: ProjectElement) => void;
  previewMode?: 'auto' | 'css' | 'screenshot';
  showQuality?: boolean;
  compact?: boolean;
}) {
  const getQualityColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getQualityLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div
      className={`border rounded-lg hover:shadow-md cursor-pointer transition-all bg-white ${
        compact ? 'p-2' : 'p-3'
      }`}
      onClick={() => onSelect(element)}
    >
      {/* Header: Icon + Description + Quality */}
      <div className="flex items-start space-x-2 mb-2">
        <span className={`flex-shrink-0 ${compact ? 'text-lg' : 'text-xl'}`}>
          {getElementTypeIcon(element.elementType)}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-gray-900 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {element.description}
          </p>
          <p className={`text-gray-500 capitalize ${compact ? 'text-xs' : 'text-xs'}`}>
            {element.elementType}
          </p>
        </div>
        {showQuality && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            getQualityColor(element.confidence || 0.5)
          }`}>
            {getQualityLabel(element.confidence || 0.5)}
          </span>
        )}
      </div>

      {/* Visual Preview */}
      {!compact && (
        <ElementVisualPreview element={element} className="mb-3" />
      )}

      {/* Selector */}
      <div className={`bg-gray-100 p-2 rounded font-mono text-gray-700 truncate ${
        compact ? 'text-xs' : 'text-xs'
      }`}>
        {element.selector}
      </div>

      {/* Compact mode quality indicator */}
      {compact && showQuality && (
        <div className="mt-1">
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
            getQualityColor(element.confidence || 0.5)
          }`}>
            {getQualityLabel(element.confidence || 0.5)}
          </span>
        </div>
      )}
    </div>
  );
}

// Simple element card component (kept for backward compatibility)
function SimpleElementCard({ element, onSelect }: { element: ProjectElement; onSelect: (element: ProjectElement) => void }) {
  return (
    <EnhancedElementCard
      element={element}
      onSelect={onSelect}
      previewMode="auto"
      showQuality={false}
      compact={false}
    />
  );
}

export function ElementLibraryPanel({
  elements,
  onSelectElement,
  isLoading,
  selectedElementType = 'all',
  selectedUrl = 'all',
  onElementTypeChange,
  onUrlChange,
  previewMode = 'auto',
  showQuality = false,
  compact = false
}: ElementLibraryPanelProps) {

  // Filter elements based on type and URL
  const filteredElements = elements.filter(element => {
    const matchesType = selectedElementType === 'all' || element.elementType === selectedElementType;
    const matchesUrl = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
    return matchesType && matchesUrl;
  });

  // Get unique element types and URLs for filter dropdowns
  const elementTypes = ['all', ...new Set(elements.map(e => e.elementType))];
  const sourceUrls = ['all', ...new Set(elements.map(e => e.sourceUrl?.id).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading elements...</p>
        </div>
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">🔍</div>
          <p>No elements found</p>
          <p className="text-sm">Use Live Element Picker to select website elements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Elements ({filteredElements.length})
        </h3>
        <p className="text-sm text-gray-600">
          Click any element to add it to your test
        </p>
      </div>

      {/* Compact Filters - Single Row */}
      {(onElementTypeChange || onUrlChange) && elements.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 flex gap-2">
          {onElementTypeChange && (
            <select
              value={selectedElementType}
              onChange={(e) => onElementTypeChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {elementTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`}
                </option>
              ))}
            </select>
          )}

          {onUrlChange && sourceUrls.length > 1 && (
            <select
              value={selectedUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sourceUrls.map((urlId) => (
                <option key={urlId} value={urlId}>
                  {urlId === 'all' ? 'All URLs' :
                    elements.find(e => e.sourceUrl?.id === urlId)?.sourceUrl?.url || 'Unknown URL'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Scrollable Element Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredElements.map((element) => (
            <EnhancedElementCard
              key={element.id}
              element={element}
              onSelect={onSelectElement}
              previewMode={previewMode}
              showQuality={showQuality}
              compact={compact}
            />
          ))}
        </div>

        {/* No Results Message */}
        {filteredElements.length === 0 && elements.length > 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-500">No elements match the current filters</p>
            <button
              onClick={() => {
                onElementTypeChange?.('all');
                onUrlChange?.('all');
              }}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}