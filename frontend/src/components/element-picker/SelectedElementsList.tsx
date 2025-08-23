import { useState, useCallback } from 'react';

interface SelectedElement {
  id: string;
  tagName: string;
  selector: string;
  text: string;
  attributes: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
  description: string;
  elementType: string;
  confidence: number;
}

interface SelectedElementsListProps {
  elements: SelectedElement[];
  onRemoveElement: (elementId: string) => void;
  onSaveElements: () => void;
}

export function SelectedElementsList({
  elements,
  onRemoveElement,
  onSaveElements
}: SelectedElementsListProps) {
  const [expandedElement, setExpandedElement] = useState<string | null>(null);

  const getElementIcon = useCallback((elementType: string) => {
    switch (elementType.toLowerCase()) {
      case 'button': return '🔘';
      case 'input': return '📝';
      case 'link': 
      case 'a': return '🔗';
      case 'form': return '📋';
      case 'navigation': 
      case 'nav': return '🧭';
      case 'text':
      case 'span':
      case 'p':
      case 'div': return '📄';
      case 'img':
      case 'image': return '🖼️';
      case 'select':
      case 'dropdown': return '📋';
      case 'checkbox': return '☐';
      case 'radio': return '◯';
      default: return '⚪';
    }
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    if (confidence >= 0.4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  }, []);

  const getElementTypeColor = useCallback((elementType: string) => {
    switch (elementType.toLowerCase()) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'input': return 'bg-green-100 text-green-800 border-green-200';
      case 'link': 
      case 'a': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': 
      case 'nav': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const toggleElementExpansion = useCallback((elementId: string) => {
    setExpandedElement(prev => prev === elementId ? null : elementId);
  }, []);

  const handleCopySelector = useCallback((selector: string) => {
    navigator.clipboard.writeText(selector).then(() => {
      // Could show a toast notification here
      console.log('Selector copied to clipboard');
    });
  }, []);

  const clearAllElements = useCallback(() => {
    elements.forEach(element => onRemoveElement(element.id));
  }, [elements, onRemoveElement]);

  if (elements.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Selected Elements</h3>
          <p className="text-sm text-gray-600 mt-1">Elements will appear here as you select them</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h4 className="font-medium text-gray-900 mb-2">No Elements Selected</h4>
            <p className="text-sm text-gray-600 mb-4">
              Enable picking mode and click on elements in the preview to select them.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-800">
                <div className="font-medium mb-1">💡 Quick Tips:</div>
                <ul className="text-left space-y-1">
                  <li>• Hover over elements to see them highlighted</li>
                  <li>• Click to select important UI elements</li>
                  <li>• Selected elements become part of your test library</li>
                  <li>• You can refine selectors after selection</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Selected Elements</h3>
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
            {elements.length}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onSaveElements}
            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors font-medium"
          >
            💾 Save All
          </button>
          <button
            onClick={clearAllElements}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
            title="Clear all selected elements"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Elements List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          {elements.map((element) => {
            const isExpanded = expandedElement === element.id;
            
            return (
              <div
                key={element.id}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                {/* Element Summary */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getElementIcon(element.elementType)}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded border font-medium ${getElementTypeColor(element.elementType)}`}>
                          {element.elementType}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${getConfidenceColor(element.confidence)}`}>
                          {Math.round(element.confidence * 100)}%
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-sm text-gray-900 truncate mb-1">
                        {element.description}
                      </h4>
                      
                      {element.text && (
                        <p className="text-xs text-gray-600 truncate">
                          "{element.text}"
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => toggleElementExpansion(element.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 text-xs"
                      title={isExpanded ? "Collapse" : "Expand details"}
                    >
                      {isExpanded ? '▼' : '▶️'}
                    </button>
                    <button
                      onClick={() => onRemoveElement(element.id)}
                      className="p-1 text-gray-400 hover:text-red-500 text-xs"
                      title="Remove element"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Selector Preview */}
                <div className="mt-2">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">Selector</span>
                      <button
                        onClick={() => handleCopySelector(element.selector)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        title="Copy selector"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <code className="text-xs text-gray-700 bg-white px-2 py-1 rounded border block truncate">
                      {element.selector}
                    </code>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                    {/* Position Information */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Position & Size</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="text-gray-600">Position:</span>
                          <div className="font-mono">
                            x: {Math.round(element.position.x)}, y: {Math.round(element.position.y)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded">
                          <span className="text-gray-600">Size:</span>
                          <div className="font-mono">
                            {Math.round(element.position.width)} × {Math.round(element.position.height)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Attributes */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 mb-1">Attributes</h5>
                      <div className="bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                        {Object.keys(element.attributes).length > 0 ? (
                          <div className="space-y-1">
                            {Object.entries(element.attributes).slice(0, 10).map(([key, value]) => (
                              <div key={key} className="flex items-start space-x-2 text-xs">
                                <span className="text-gray-600 font-mono font-medium min-w-0 flex-shrink-0">
                                  {key}:
                                </span>
                                <span className="text-gray-700 font-mono truncate flex-1">
                                  {String(value).substring(0, 50)}
                                  {String(value).length > 50 && '...'}
                                </span>
                              </div>
                            ))}
                            {Object.keys(element.attributes).length > 10 && (
                              <div className="text-xs text-gray-500 italic">
                                ... and {Object.keys(element.attributes).length - 10} more attributes
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic">No attributes</div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCopySelector(element.selector)}
                        className="flex-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                      >
                        📋 Copy Selector
                      </button>
                      <button
                        onClick={() => {/* TODO: Add validate functionality */}}
                        className="flex-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
                      >
                        🔍 Validate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600 text-center mb-2">
          {elements.length} element{elements.length !== 1 ? 's' : ''} ready to add to your test library
        </div>
        <button
          onClick={onSaveElements}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ✨ Add to Test Library
        </button>
      </div>
    </div>
  );
}