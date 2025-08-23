import { useState, useCallback, useEffect } from 'react';
import { ProjectElement } from '../../types/element.types';
import { BrowserPreview } from './BrowserPreview';
import { SelectedElementsList } from './SelectedElementsList';
import { SelectorGenerator } from './SelectorGenerator';

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
  const maxRetries = 3;

  // URL validation and normalization
  const normalizeUrl = useCallback((url: string): string => {
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
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
      
      // Check for localhost/development URLs
      if (urlObj.hostname === 'localhost' || urlObj.hostname.startsWith('127.0.0.1') || urlObj.hostname.startsWith('192.168.')) {
        return { isValid: false, error: 'Local development URLs cannot be accessed from the browser for security reasons' };
      }
      
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

      const selectorGenerator = new SelectorGenerator();
      const optimizedSelector = selectorGenerator.generateOptimalSelector(elementData);
      
      // Validate required element data
      if (!optimizedSelector) {
        console.warn('Could not generate selector for element:', elementData);
        setError('Failed to generate selector for selected element. Please try selecting a different element.');
        return;
      }

      const newElement: SelectedElement = {
        id: `picked_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tagName: elementData.tagName?.toLowerCase() || 'unknown',
        selector: optimizedSelector,
        text: elementData.textContent || '',
        attributes: elementData.attributes || {},
        position: elementData.boundingRect || { x: 0, y: 0, width: 0, height: 0 },
        description: selectorGenerator.generateDescription(elementData),
        elementType: selectorGenerator.inferElementType(elementData),
        confidence: selectorGenerator.calculateConfidence(elementData),
      };

      setSelectedElements(prev => {
        // Avoid duplicates based on selector
        const exists = prev.some(el => el.selector === newElement.selector);
        if (exists) {
          console.log('Element already selected:', newElement.selector);
          return prev;
        }
        return [...prev, newElement];
      });

      // Element successfully added to selection

      // Clear any existing errors
      setError(null);
      console.log('Element selected successfully:', newElement);
      
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
          pickedLive: true,
          pickedAt: new Date().toISOString(),
          sourceUrl: previewUrl,
          position: el.position
        },
        sourceUrl: {
          id: `url-${Date.now()}`,
          url: previewUrl,
          title: `Live picked from ${new URL(previewUrl).hostname}`
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        screenshot: null // Will be captured later if needed
      }));

      console.log(`Successfully processed ${projectElements.length} elements for saving`);
      onElementsSelected(projectElements);
      setError(null); // Clear any existing errors
      
      // Clean up modal state and close after successful save
      setSelectedElements([]);
      setIsPickingMode(false);
      setPreviewUrl('');
      
      // Close modal after brief delay to show success
      setTimeout(() => {
        onClose();
      }, 500);

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
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">🎯 Live Element Picker</h2>
              <p className="text-sm opacity-90">Select elements directly from any website</p>
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

        {/* URL Input */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleUrlSubmit} className="flex space-x-3">
            <div className="flex-1">
              <input
                type="url"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !currentUrl.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
          
          {error && (
            <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-red-500 text-xl flex-shrink-0">⚠️</div>
                <div className="flex-1">
                  <div className="text-red-800 font-medium text-sm mb-2">Error</div>
                  <div className="text-red-700 text-sm mb-3">{error}</div>
                  
                  <div className="flex items-center space-x-3">
                    {retryCount < maxRetries && (
                      <button
                        onClick={handleRetry}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                      >
                        🔄 Retry ({maxRetries - retryCount} attempts left)
                      </button>
                    )}
                    <button
                      onClick={() => setError(null)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                  
                  <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-600">
                    <div className="font-medium mb-1">💡 Troubleshooting tips:</div>
                    <ul className="space-y-1">
                      <li>• Make sure the URL is correct and accessible</li>
                      <li>• Try adding 'https://' to the beginning if missing</li>
                      <li>• Some websites may block iframe embedding</li>
                      <li>• Check your internet connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Browser Preview */}
          <div className="flex-1 flex flex-col">
            {previewUrl ? (
              <>
                {/* Preview Controls */}
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      Previewing: <span className="font-medium">{new URL(previewUrl).hostname}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={togglePickingMode}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        isPickingMode
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {isPickingMode ? '✨ Picking Mode ON' : '🎯 Start Picking'}
                    </button>
                    
                    {selectedElements.length > 0 && (
                      <button
                        onClick={handleSaveSelectedElements}
                        className="px-4 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
                      >
                        💾 Save {selectedElements.length} Elements
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Browser Preview Component */}
                <div className="flex-1 border-b border-gray-200">
                  <BrowserPreview
                    url={previewUrl}
                    isPickingMode={isPickingMode}
                    onElementSelected={handleElementSelected}
                    className="w-full h-full"
                  />
                </div>
              </>
            ) : (
              /* Empty State */
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">🌐</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Enter a Website URL
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Load any website to start selecting elements for your test library. 
                    Navigate to the page with the elements you want to test.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">💡 Pro Tips:</div>
                      <ul className="text-left space-y-1">
                        <li>• Use staging or test environments when possible</li>
                        <li>• Make sure the site allows iframe embedding</li>
                        <li>• Log in to the site first if authentication is needed</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Elements Sidebar */}
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            <SelectedElementsList
              elements={selectedElements}
              onRemoveElement={handleRemoveElement}
              onSaveElements={handleSaveSelectedElements}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            🚀 Revolutionary: World's first live element picker for test automation
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Selected: <span className="font-medium">{selectedElements.length}</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            {selectedElements.length > 0 && (
              <button
                onClick={handleSaveSelectedElements}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Save & Use Elements
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}