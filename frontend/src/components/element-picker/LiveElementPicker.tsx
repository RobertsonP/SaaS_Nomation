import React, { useState, useEffect, useRef } from 'react';
import { ProjectElement } from '../../types/element.types';

interface LiveElementPickerProps {
  isOpen?: boolean; // Optional for backward compatibility
  projectId: string;
  onClose: () => void;
  onElementsSelected: (elements: ProjectElement[]) => void;
  onSelectElement?: (selector: string, description: string) => void; // Optional for backward compatibility
  initialUrl?: string;
}

export function LiveElementPicker({ isOpen = true, projectId, onClose, onElementsSelected, onSelectElement, initialUrl = 'https://example.com' }: LiveElementPickerProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ selector: string; description: string; attributes: Record<string, string> } | null>(null);
  const browserFrameRef = useRef<HTMLDivElement>(null); // Ref for the simulated browser frame

  if (!isOpen) return null;

  const handleGo = () => {
    if (inputUrl && inputUrl !== currentUrl) {
      setIsLoading(true);
      setCurrentUrl(inputUrl);
      // In a real implementation, you'd fetch/render the actual page content here.
      // For this prototype, we just simulate loading.
      setTimeout(() => setIsLoading(false), 1500);
    }
  };

  const handleSimulateElementHover = () => {
    // This is purely for demonstration/prototype purposes.
    // In a real app, this would come from Playwright/backend.
    setSelectedElement({
      selector: 'button:has-text("Shop Now")',
      description: 'Shop Now Button',
      attributes: {
        tagName: 'button',
        className: 'mock-btn',
        text: 'Shop Now'
      }
    });
  };

  const handleAddSelectedElement = () => {
    if (selectedElement) {
      onSelectElement?.(selectedElement.selector, selectedElement.description);
      onClose(); // Close picker after selecting
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col animate-fade-in">
      {/* Picker Header */}
      <div className="flex-shrink-0 bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-3">
        <h3 className="text-lg font-semibold text-blue-400">⚡ Live Element Picker</h3>
        <div className="flex-grow flex gap-2">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleGo()}
            className="flex-grow px-3 py-1.5 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter URL"
            disabled={isLoading}
          />
          <button
            onClick={handleGo}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
            disabled={isLoading}
          >
            Go
          </button>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex overflow-hidden">
        {/* Browser Frame */}
        <div ref={browserFrameRef} className="flex-grow bg-white relative overflow-hidden flex items-center justify-center">
          {isLoading ? (
            <div className="text-gray-700 text-lg">Loading {currentUrl}...</div>
          ) : (
            // Simulated Website Content (from design_prototype/test_builder.html)
            <div className="w-full h-full relative" style={{ backgroundColor: '#f0f0f0' }}>
                <div style={{ height: '60px', background: '#333', display: 'flex', alignItems: 'center', padding: '0 40px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>ShopLogo</span>
                </div>
                <div style={{ height: '300px', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <h1 style={{ color: '#333', marginBottom: '20px' }}>Summer Sale</h1>
                    <button 
                        className="mock-btn" 
                        style={{ padding: '12px 24px', background: '#007bff', color: 'white', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                        onClick={handleSimulateElementHover} // Simulate click to select element
                    >
                        Shop Now
                    </button>
                </div>

                {/* Visual Selection Highlight */}
                {selectedElement && (
                  <div 
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                    style={{ top: '180px', left: '50%', transform: 'translateX(-50%)', width: '120px', height: '44px' }}
                  >
                    <div 
                      className="absolute -top-7 -left-0 bg-blue-500 text-white px-2 py-1 text-xs font-semibold rounded-t-md"
                      style={{ fontFamily: 'Fira Code, monospace' }}
                    >
                      {selectedElement.selector}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Inspector Panel */}
        <aside className="flex-shrink-0 w-80 bg-gray-800 border-l border-gray-700 p-4 flex flex-col">
          <h4 className="text-lg font-semibold text-white mb-4">Selected Element</h4>
          {selectedElement ? (
            <div className="bg-gray-900 p-4 rounded-lg flex-grow flex flex-col">
              <div className="mb-3">
                <p className="font-medium text-gray-300">{selectedElement.description}</p>
                <code className="text-sm text-green-400 break-all font-mono">{selectedElement.selector}</code>
              </div>
              
              <div className="text-gray-400 text-sm mb-4">
                <p>Tag: <span className="text-white">{selectedElement.attributes.tagName}</span></p>
                <p>Text: <span className="text-white">{selectedElement.attributes.text}</span></p>
              </div>

              <button
                onClick={handleAddSelectedElement}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors mt-auto"
              >
                + Add to Test
              </button>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8 flex-grow">
              Click on an element in the browser to select it.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Simple fade-in animation
const style = document.createElement('style');
style.innerHTML = `
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
`;
document.head.appendChild(style);
