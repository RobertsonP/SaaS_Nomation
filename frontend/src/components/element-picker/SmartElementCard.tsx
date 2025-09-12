import { useState } from 'react';
import { ElementVisualRecreation } from './ElementVisualRecreation';

interface SmartElementCardProps {
  element: {
    id: string;
    tagName: string;
    selector: string;
    description: string;
    textContent: string;
    attributes: Record<string, any>;
    cssProperties: any;
    isInteractive: boolean;
    isVerification: boolean;
    boundingRect: { x: number; y: number; width: number; height: number };
  };
  onRemove?: (id: string) => void;
  onSelect?: (element: any) => void;
  className?: string;
  showRemoveButton?: boolean;
}

export function SmartElementCard({ 
  element, 
  onRemove, 
  onSelect, 
  className = '',
  showRemoveButton = true 
}: SmartElementCardProps) {
  const [showFullSelector, setShowFullSelector] = useState(false);
  
  const { id, selector, description, isInteractive, isVerification } = element;
  
  // 📏 SELECTOR DISPLAY LOGIC
  const displaySelector = selector.length > 60 && !showFullSelector 
    ? selector.substring(0, 60) + '...' 
    : selector;
  
  const hasLongSelector = selector.length > 60;
  
  // 🎯 ELEMENT TYPE STYLING
  const getCardBorder = () => {
    if (isInteractive) {
      return 'border-blue-200 hover:border-blue-300';
    } else if (isVerification) {
      return 'border-green-200 hover:border-green-300';
    }
    return 'border-gray-200 hover:border-gray-300';
  };
  
  const getCardBackground = () => {
    if (isInteractive) {
      return 'bg-blue-50/30';
    } else if (isVerification) {
      return 'bg-green-50/30';
    }
    return 'bg-white';
  };
  
  return (
    <div 
      className={`
        ${getCardBackground()} 
        ${getCardBorder()}
        border rounded-lg p-4 transition-all duration-200 hover:shadow-sm
        ${className}
      `}
    >
      {/* 📋 ELEMENT HEADER */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">
            {description}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {isInteractive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Interactive
              </span>
            )}
            {isVerification && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Verification Text
              </span>
            )}
          </div>
        </div>
        
        {/* 🗑️ REMOVE BUTTON */}
        {showRemoveButton && onRemove && (
          <button
            onClick={() => onRemove(id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-2"
            title="Remove element"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* 🎨 VISUAL RECREATION */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-700 mb-2">Visual Preview:</div>
        <div className="bg-white border border-gray-100 rounded p-3 min-h-[50px] flex items-center">
          <ElementVisualRecreation 
            element={element}
            maxWidth="280px"
            maxHeight="60px"
          />
        </div>
      </div>
      
      {/* 🎯 SELECTOR */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700">Selector:</div>
        <div className="relative">
          <code className={`
            block text-xs bg-gray-50 border rounded p-2 font-mono
            ${hasLongSelector ? 'cursor-pointer hover:bg-gray-100' : ''}
          `}
          onClick={hasLongSelector ? () => setShowFullSelector(!showFullSelector) : undefined}
          >
            {displaySelector}
          </code>
          
          {hasLongSelector && (
            <button
              onClick={() => setShowFullSelector(!showFullSelector)}
              className="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-600 rounded"
              title={showFullSelector ? "Show less" : "Show full selector"}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showFullSelector ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* 🎯 SELECT BUTTON (if onSelect provided) */}
      {onSelect && (
        <div className="mt-4">
          <button
            onClick={() => onSelect(element)}
            className={`
              w-full py-2 px-3 rounded text-sm font-medium transition-colors
              ${isInteractive 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
            `}
          >
            Select Element
          </button>
        </div>
      )}
    </div>
  );
}