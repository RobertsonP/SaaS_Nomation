import { useState } from 'react';
import { SelectedElementsList } from './SelectedElementsList';
import { SmartElementAnalyzer } from './SmartElementAnalyzer';

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
  automationMetadata?: any;
}

interface ElementPickerSidebarProps {
  elements: SelectedElement[];
  onRemoveElement: (elementId: string) => void;
  onSaveElements: () => void;
  onElementSelected: (element: any) => void;
  currentUrl: string;
}

export function ElementPickerSidebar({
  elements,
  onRemoveElement,
  onSaveElements,
  onElementSelected,
  currentUrl
}: ElementPickerSidebarProps) {
  const [activeTab, setActiveTab] = useState<'selected' | 'analyze'>('selected');

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
      {/* 📑 TAB NAVIGATION */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('selected')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium text-center transition-colors
              ${activeTab === 'selected'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <span>Selected</span>
              {elements.length > 0 && (
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-medium">
                  {elements.length}
                </span>
              )}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('analyze')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium text-center transition-colors
              ${activeTab === 'analyze'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Analyze</span>
            </div>
          </button>
        </nav>
      </div>

      {/* 📋 TAB CONTENT */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'selected' ? (
          <SelectedElementsList
            elements={elements}
            onRemoveElement={onRemoveElement}
            onSaveElements={onSaveElements}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <SmartElementAnalyzer
              url={currentUrl}
              onElementSelected={onElementSelected}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}