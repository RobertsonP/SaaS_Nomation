import { useState, useCallback } from 'react';
import { ReliableElementCard } from './ReliableElementCard';

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
  fallbackSelectors?: string[];
  automationMetadata?: {
    priority: number;
    reliability: number;
    browserCompatibility: number;
    uniqueness: number;
    stability: number;
    xpath: string;
    validatedSelectors: any[];
  };
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
  
  const clearAllElements = useCallback(() => {
    if (window.confirm(`Remove all ${elements.length} selected elements?`)) {
      elements.forEach(element => onRemoveElement(element.id));
    }
  }, [elements, onRemoveElement]);

  // Empty state
  if (elements.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 text-sm">Selected Elements</h3>
          <p className="text-xs text-gray-600 mt-0.5">Elements will appear here as you select them</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-medium text-gray-900 mb-1 text-sm">No Elements Selected</h4>
            <p className="text-xs text-gray-600">
              Enable picking mode and click on elements to select them.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - COMPRESSED */}
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-gray-900 text-sm">Selected Elements</h3>
          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-medium">
            {elements.length}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onSaveElements}
            className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors font-medium"
          >
            💾 Save All Elements
          </button>
          <button
            onClick={clearAllElements}
            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
            title="Clear all selected elements"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Elements List - Enhanced with Reliable Element Cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-1.5 space-y-1.5">
          {elements.map((element) => (
            <ReliableElementCard
              key={element.id}
              element={element}
              onRemove={onRemoveElement}
              className="shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}