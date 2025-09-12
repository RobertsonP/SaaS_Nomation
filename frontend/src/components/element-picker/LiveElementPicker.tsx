import { useState, useCallback, useEffect } from 'react';
import { ProjectElement } from '../../types/element.types';
import { BrowserPreview } from './BrowserPreview';
import { IframeBrowserPreview } from './IframeBrowserPreview';
import { InteractiveBrowserPreview } from './InteractiveBrowserPreview';
import { ElementPickerSidebar } from './ElementPickerSidebar';
import { SelectorGenerator } from './SelectorGenerator';
import { ReliableSelectorGenerator } from './ReliableSelectorGenerator';

interface LiveElementPickerProps {
  projectId: string;
  onElementsSelected: (elements: ProjectElement[]) => void;
  onClose: () => void;
  initialUrl?: string;
}

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
  cssInfo?: any; // CSS styling information captured from browser
  screenshot?: string | null; // Element screenshot data
  fallbackSelectors?: string[]; // Additional selectors for reliability in browser automation
  // 🎯 REMOVED: screenshot field - using CSS data for visual previews instead
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

export function LiveElementPicker({ 
  projectId, 
  onElementsSelected, 
  onClose, 
  initialUrl = ''
}: LiveElementPickerProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [isPickingMode, setIsPickingMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isCrossOrigin, setIsCrossOrigin] = useState(false);
  const [useInteractiveMode, setUseInteractiveMode] = useState(true); // Start with new interactive mode for full functionality
  const maxRetries = 3;

  // URL validation and normalization - FIXED: Support both HTTP and HTTPS
  const normalizeUrl = useCallback((url: string): string => {
    if (!url) return '';
    // Don't force HTTPS - let user specify HTTP if they want
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Default to HTTPS for security, but user can override with http://
      return `https://${url}`;
    }
    return url;
  }, []);

  // Enhanced URL validation
  const validateUrl = useCallback((url: string): { isValid: boolean; error?: string } => {
    if (!url.trim()) {
      return { isValid: false, error: 'URL is required' };
    }

    try {
      const normalizedUrl = normalizeUrl(url.trim());
      const urlObj = new URL(normalizedUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'Only HTTP and HTTPS URLs are supported' };
      }
      
      // Allow localhost/development URLs for testing
      // Note: Backend Playwright can access any URL including localhost
      
      // Check for common problematic domains
      const blockedDomains = ['file:', 'ftp:', 'chrome:', 'about:'];
      if (blockedDomains.some(blocked => normalizedUrl.startsWith(blocked))) {
        return { isValid: false, error: 'This type of URL is not supported' };
      }
      
      return { isValid: true };
    } catch (e) {
      return { isValid: false, error: 'Invalid URL format. Please enter a valid website URL' };
    }
  }, [normalizeUrl]);

  const handleUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUrl.trim()) return;

    // Enhanced validation
    const validation = validateUrl(currentUrl);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid URL');
      return;
    }

    const normalizedUrl = normalizeUrl(currentUrl.trim());
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    
    try {
      // Reset cross-origin state for new URL
      setIsCrossOrigin(false);
      // Set preview URL and let BrowserPreview handle loading
      setPreviewUrl(normalizedUrl);
      console.log('Live element picker URL loaded:', normalizedUrl);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load the website: ${errorMessage}`);
      console.error('URL loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUrl, normalizeUrl, validateUrl]);

  // Retry function for failed loads
  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setError(null);
      handleUrlSubmit(new Event('submit') as any);
    } else {
      setError('Maximum retry attempts reached. Please try a different URL or check your internet connection.');
    }
  }, [retryCount, maxRetries, handleUrlSubmit]);

  const handleElementSelected = useCallback((elementData: any) => {
    try {
      if (!elementData) {
        console.warn('No element data provided');
        return;
      }

      // 🎯 USE NEW ROBUST SELECTOR SYSTEM WITH COMPLETE CSS ARSENAL
      const reliableSelectorGenerator = new ReliableSelectorGenerator();
      const robustSelectorResult = reliableSelectorGenerator.generateRobustSelector(elementData as any);
      
      const optimizedSelector = robustSelectorResult.selector;
      
      // Validate required element data
      if (!optimizedSelector) {
        console.warn('Could not generate selector for element:', elementData);
        setError('Failed to generate selector for selected element. Please try selecting a different element.');
        return;
      }

      // Use original SelectorGenerator for UI features (descriptions, types, etc.)
      const selectorGenerator = new SelectorGenerator();
      
      const newElement: SelectedElement = {
        id: `picked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tagName: elementData.tagName?.toLowerCase() || 'unknown',
        selector: optimizedSelector,
        text: elementData.textContent || elementData.innerText || '',
        attributes: {
          ...elementData.attributes,
          cssInfo: elementData.cssInfo // Include CSS info in attributes for preview components
        },
        position: elementData.boundingRect || { x: 0, y: 0, width: 0, height: 0 },
        description: selectorGenerator.generateDescription(elementData),
        elementType: selectorGenerator.inferElementType(elementData),
        confidence: Math.max(
          robustSelectorResult.automationMetadata.reliability || 0.5,
          selectorGenerator.calculateConfidence(elementData)
        ),
        cssInfo: elementData.cssInfo, // Also store at top level for backward compatibility
        // 🎯 ENHANCED: Store robust fallback chain with complete CSS arsenal
        fallbackSelectors: [
          ...robustSelectorResult.fallbackSelectors,
          robustSelectorResult.automationMetadata.xpath,
          ...(Array.isArray(elementData.selectors) ? elementData.selectors.filter((s: string) => s !== optimizedSelector) : [])
        ].filter((selector: string, index: number, arr: string[]) => selector && arr.indexOf(selector) === index), // Remove duplicates
        // 🎯 ENHANCED: Complete automation metadata with CSS analysis
        automationMetadata: {
          priority: robustSelectorResult.automationMetadata.priority || 50,
          reliability: robustSelectorResult.automationMetadata.reliability || 0.5,
          browserCompatibility: robustSelectorResult.automationMetadata.browserCompatibility || 0.8,
          uniqueness: robustSelectorResult.automationMetadata.uniqueness || 0.5,
          stability: robustSelectorResult.automationMetadata.stability || 0.5,
          xpath: robustSelectorResult.automationMetadata.xpath,
          validatedSelectors: [] // Will be populated with old system for compatibility
        }
      };

      // 🎯 REMOVED: Automatic screenshot capture - using CSS data for visual previews instead

      setSelectedElements(prev => {
        // Avoid duplicates based on selector
        const exists = prev.some(el => el.selector === newElement.selector);
        if (exists) {
          console.log('Element already selected:', newElement.selector);
          return prev;
        }
        return [...prev, newElement];
      });

      // 🎯 REMOVED: Screenshot capture call - using CSS data for visual previews instead

      // Element successfully added to selection

      // Clear any existing errors
      setError(null);
      console.log('Element selected successfully with auto-preview:', newElement);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Element selection failed:', err);
      setError(`Failed to process selected element: ${errorMessage}`);
    }
  }, []);

  const handleRemoveElement = useCallback((elementId: string) => {
    setSelectedElements(prev => prev.filter(el => el.id !== elementId));
  }, []);

  const handleSaveSelectedElements = useCallback(() => {
    try {
      if (selectedElements.length === 0) {
        setError('No elements selected. Please select at least one element before saving.');
        return;
      }

      if (!previewUrl) {
        setError('No URL loaded. Please load a website first.');
        return;
      }

      // Normalize element type to match ProjectElement constraints
      const normalizeElementType = (elementType: string): 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text' => {
        const validTypes: ('button' | 'input' | 'link' | 'form' | 'navigation' | 'text')[] = 
          ['button', 'input', 'link', 'form', 'navigation', 'text'];
        
        if (validTypes.includes(elementType as any)) {
          return elementType as 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
        }
        
        // Map common types to valid ones
        switch (elementType.toLowerCase()) {
          case 'checkbox':
          case 'radio':
          case 'select':
          case 'textarea':
            return 'input';
          case 'a':
            return 'link';
          case 'img':
          case 'image':
            return 'text';
          case 'nav':
            return 'navigation';
          default:
            return 'text';
        }
      };

      // Validate each element before saving
      const validElements = selectedElements.filter(el => {
        if (!el.selector) {
          console.warn('Element missing selector:', el);
          return false;
        }
        if (!el.description) {
          console.warn('Element missing description:', el);
          return false;
        }
        return true;
      });

      if (validElements.length === 0) {
        setError('All selected elements are invalid. Please try selecting elements again.');
        return;
      }

      if (validElements.length < selectedElements.length) {
        console.warn(`${selectedElements.length - validElements.length} invalid elements filtered out`);
      }

      // Convert selected elements to ProjectElement format
      const projectElements: ProjectElement[] = validElements.map(el => ({
        id: el.id,
        projectId: projectId,
        selector: el.selector,
        elementType: normalizeElementType(el.elementType),
        description: el.description,
        confidence: Math.max(0.1, Math.min(1.0, el.confidence)), // Ensure confidence is between 0.1 and 1.0
        overallQuality: Math.max(0.1, Math.min(1.0, el.confidence)),
        isValidated: false,
        attributes: {
          text: el.text,
          tagName: el.tagName,
          ...el.attributes,
          // CRITICAL FIX: Include CSS information for proper previews
          cssInfo: (el as any).cssInfo, // CSS data captured from browser
          pickedLive: true,
          pickedAt: new Date().toISOString(),
          sourceUrl: previewUrl,
          position: el.position
        },
        sourceUrl: {
          id: `url-${Date.now()}`,
          url: previewUrl,
          title: `Live picked from ${new URL(previewUrl).hostname}${new URL(previewUrl).pathname}` // 🎯 SHOW DOMAIN.COM/PATH FORMAT
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        screenshot: el.screenshot || null // 🎯 AUTOMATIC ELEMENT PREVIEW
      }));

      console.log(`Successfully processed ${projectElements.length} elements for saving`);
      onElementsSelected(projectElements);
      setError(null); // Clear any existing errors
      
      // Clear saved elements but keep session active for more picking
      setSelectedElements([]);
      // Keep pick mode active and preview URL active for continued element picking
      // User can continue selecting more elements or manually close

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Failed to save selected elements:', err);
      setError(`Failed to save elements: ${errorMessage}. Please try again.`);
    }
  }, [selectedElements, previewUrl, projectId, onElementsSelected]);

  const togglePickingMode = useCallback(() => {
    setIsPickingMode(prev => !prev);
  }, []);

  // Handle ESC key and prevent background scrolling
  useEffect(() => {
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
    // Handle ESC key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col">
        {/* Header - COMPRESSED */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">🎯 Interactive Element Picker</h2>
              <p className="text-xs opacity-90">Full browser control: scroll, click & select elements from any website</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-xs">
                {selectedElements.length} elements selected
              </span>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl font-bold"
                aria-label="Close element picker"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* URL Input - COMPRESSED */}
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleUrlSubmit} className="flex space-x-2">
            <div className="flex-1">
              <input
                type="url"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !currentUrl.trim()}
              className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 text-sm"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading...</span>
                </div>
              ) : (
                <span>🌐 Load Website</span>
              )}
            </button>
          </form>
          
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Browser Preview */}
          <div className="flex-1 flex flex-col">
            {previewUrl ? (
              <>
                {/* Preview Controls - COMPRESSED */}
                <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      Previewing: <span className="font-medium">{new URL(previewUrl).hostname}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={togglePickingMode}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        isPickingMode
                          ? 'bg-green-600 text-white animate-pulse'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isPickingMode ? '🎯 Element Picking ON' : '▶️ Start Element Picking'}
                    </button>
                    
                    {selectedElements.length > 0 && (
                      <button
                        onClick={handleSaveSelectedElements}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 font-medium"
                      >
                        ✅ Add {selectedElements.length} to Test
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 🚀 NEW: FULLY INTERACTIVE BROWSER PREVIEW */}
                <div className="flex-1 relative">
                  <InteractiveBrowserPreview
                    url={previewUrl}
                    isPickingMode={isPickingMode}
                    onElementSelected={handleElementSelected}
                    className="w-full h-full"
                  />
                </div>
              </>
            ) : (
              /* Empty State */
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center max-w-lg">
                  <div className="text-6xl mb-4">🚀</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Interactive Browser Ready
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Enter any website URL to launch a fully interactive browser.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Element Picker Sidebar */}
          <ElementPickerSidebar
            elements={selectedElements}
            onRemoveElement={handleRemoveElement}
            onSaveElements={handleSaveSelectedElements}
            onElementSelected={handleElementSelected}
            currentUrl={previewUrl}
          />
        </div>

      </div>
    </div>
  );
}