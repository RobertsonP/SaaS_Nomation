import React, { useState, useEffect, useRef } from 'react';
import { browserAPI } from '../../lib/api';
import { ProjectElement } from '../../types/element.types';
import { createLogger } from '../../lib/logger';

const logger = createLogger('LiveElementPicker');

interface LiveElementPickerProps {
  isOpen?: boolean;
  projectId: string;
  onClose: () => void;
  onElementsSelected: (elements: ProjectElement[]) => void;
  onSelectElement?: (selector: string, description: string) => void;
  initialUrl?: string;
}

interface CapturedElement {
  selector: string;
  elementType: string;
  description: string;
  confidence?: number;
  selectorType?: string;
  fallbackSelectors?: string[];
  attributes?: Record<string, any>;
  boundingRect?: { x: number; y: number; width: number; height: number };
}

export function LiveElementPicker({
  isOpen = true,
  projectId,
  onClose,
  onElementsSelected,
  onSelectElement,
  initialUrl = 'https://example.com'
}: LiveElementPickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Capture state
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const [capturedElements, setCapturedElements] = useState<CapturedElement[]>([]);
  const [capturedUrl, setCapturedUrl] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCaptured, setHasCaptured] = useState(false);

  // Element selection
  const [selectedElement, setSelectedElement] = useState<CapturedElement | null>(null);

  const sessionTokenRef = useRef<string | null>(null);
  const screenshotImgRef = useRef<HTMLImageElement>(null);

  // Initialize browser session
  useEffect(() => {
    if (!isOpen) return;

    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        logger.info('Creating browser session for element picker');
        const session = await browserAPI.createSession(projectId, undefined, initialUrl);
        setSessionToken(session.sessionToken);
        sessionTokenRef.current = session.sessionToken;
        logger.info('Session created:', session.sessionToken);

        // Navigate to initial URL
        if (initialUrl) {
          await browserAPI.navigateSession(session.sessionToken, initialUrl);
        }
      } catch (err: any) {
        logger.error('Failed to create browser session:', err);
        setError(err.message || 'Failed to start browser session');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // Cleanup on unmount
    return () => {
      if (sessionTokenRef.current) {
        browserAPI.closeSession(sessionTokenRef.current).catch(err =>
          logger.error('Failed to close session:', err)
        );
        sessionTokenRef.current = null;
      }
    };
  }, [isOpen, projectId, initialUrl]);

  // Capture page state: screenshot + elements in one call
  const handleCapturePage = async () => {
    if (!sessionToken) return;
    setIsCapturing(true);
    setError(null);
    setSelectedElement(null);

    try {
      logger.info('Capturing page state');
      const result = await browserAPI.capturePageState(sessionToken);
      setCapturedScreenshot(result.data.screenshot);
      setCapturedElements(result.data.elements || []);
      setCapturedUrl(result.data.url);
      setHasCaptured(true);
      logger.info(`Captured ${result.data.elements?.length || 0} elements from ${result.data.url}`);
    } catch (err: any) {
      logger.error('Capture failed:', err);
      setError(err.message || 'Could not capture page state. Make sure the browser window is still open.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsCapturing(false);
    }
  };

  // Find element at click coordinates on the screenshot
  const handleScreenshotClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!capturedElements.length) return;

    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    // Scale displayed coordinates to actual viewport coordinates (1280x720)
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Find the smallest element whose bounding rect contains the click point
    let closest: CapturedElement | null = null;
    let closestDist = Infinity;

    for (const el of capturedElements) {
      const br = el.boundingRect || el.attributes?.boundingRect;
      if (!br) continue;

      // Check if click is inside element bounds
      if (x >= br.x && x <= br.x + br.width && y >= br.y && y <= br.y + br.height) {
        const centerX = br.x + br.width / 2;
        const centerY = br.y + br.height / 2;
        const dist = Math.hypot(x - centerX, y - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = el;
        }
      }
    }

    if (closest) {
      setSelectedElement(closest);
      logger.info('Selected element:', closest.selector);
    }
  };

  // Save selected element and close
  const handleSaveElement = () => {
    if (!selectedElement) return;
    logger.info('Saving element to library:', selectedElement.selector);
    onSelectElement?.(selectedElement.selector, selectedElement.description);
    onClose();
  };

  // Handle close and cleanup
  const handleClose = async () => {
    if (sessionToken) {
      try {
        await browserAPI.closeSession(sessionToken);
      } catch (err) {
        logger.warn('Failed to close session:', err);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 dark:bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-3">
        <h3 className="text-lg font-semibold text-blue-400">Live Element Picker</h3>
        <div className="flex-grow">
          {hasCaptured && capturedUrl && (
            <span className="text-sm text-gray-400 dark:text-gray-500 font-mono truncate block">
              {capturedUrl}
            </span>
          )}
          {!hasCaptured && (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Navigate in the browser window, then capture
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
        >
          Close
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-600 dark:bg-red-700 text-white px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-grow flex overflow-hidden">
        {/* Loading state — session starting */}
        {isLoading && !hasCaptured && (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-lg">Starting browser session...</p>
              <p className="text-sm text-gray-400 mt-2">A browser window will open. This may take a moment.</p>
            </div>
          </div>
        )}

        {/* Before capture: instruction panel */}
        {!isLoading && !hasCaptured && sessionToken && (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-600 dark:bg-blue-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">
              Browser is Open
            </h3>
            <p className="text-gray-400 mb-6 max-w-md">
              Navigate to the page you want in the browser window, then click Capture to detect all interactive elements.
            </p>
            <button
              onClick={handleCapturePage}
              disabled={isCapturing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 font-medium text-lg transition-colors"
            >
              {isCapturing ? 'Capturing...' : 'Capture Page'}
            </button>
            {isCapturing && (
              <div className="mt-4 flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                <span className="text-sm">Taking screenshot and detecting elements...</span>
              </div>
            )}
          </div>
        )}

        {/* After capture: screenshot + elements */}
        {hasCaptured && capturedScreenshot && (
          <>
            {/* Left: Screenshot with click overlay */}
            <div className="flex-1 overflow-auto p-3 bg-gray-900 dark:bg-gray-950">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                <span className="truncate mr-4">{capturedUrl} -- Click on an element to select it</span>
                <span className="text-gray-600 dark:text-gray-500 flex-shrink-0">
                  {capturedElements.length} elements detected
                </span>
              </div>
              <img
                ref={screenshotImgRef}
                src={capturedScreenshot}
                alt="Captured page"
                className="max-w-full cursor-crosshair rounded border border-gray-600 dark:border-gray-700 shadow-lg"
                style={{ minHeight: '400px', backgroundColor: 'white' }}
                onClick={handleScreenshotClick}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleCapturePage}
                  disabled={isCapturing}
                  className="px-4 py-2 bg-gray-700 dark:bg-gray-800 text-gray-200 rounded hover:bg-gray-600 dark:hover:bg-gray-700 text-sm transition-colors disabled:opacity-50"
                >
                  {isCapturing ? 'Capturing...' : 'Capture Again'}
                </button>
              </div>
            </div>

            {/* Right: Selected element details + element list */}
            <aside className="flex-shrink-0 w-80 border-l border-gray-700 dark:border-gray-800 overflow-y-auto bg-gray-800 dark:bg-gray-900 flex flex-col">
              <div className="p-3 flex-grow">
                {selectedElement ? (
                  <div>
                    <h4 className="font-medium text-gray-100 mb-2">Selected Element</h4>
                    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 mb-3">
                      <div className="text-sm text-gray-300 mb-2">{selectedElement.description}</div>
                      <code className="text-xs bg-gray-700 dark:bg-gray-800 px-2 py-1 rounded block mb-2 break-all text-green-400 dark:text-green-300 font-mono">
                        {selectedElement.selector}
                      </code>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>Type: <span className="text-gray-300">{selectedElement.elementType}</span></p>
                        {selectedElement.selectorType && (
                          <p>Selector: <span className="text-gray-300">{selectedElement.selectorType}</span></p>
                        )}
                        {selectedElement.confidence !== undefined && (
                          <p>Confidence: <span className="text-gray-300">{Math.round(selectedElement.confidence * 100)}%</span></p>
                        )}
                        {selectedElement.attributes?.id && (
                          <p>ID: <span className="text-gray-300">#{selectedElement.attributes.id}</span></p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleSaveElement}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-sm font-medium transition-colors"
                    >
                      Save to Library
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Click on an element in the screenshot to select it
                    </p>
                  </div>
                )}

                <h4 className="font-medium text-gray-100 mt-4 mb-2 text-sm">
                  Detected Elements ({capturedElements.length})
                </h4>
                <div className="space-y-1">
                  {capturedElements.slice(0, 50).map((el, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedElement(el)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        selectedElement === el
                          ? 'bg-blue-600 dark:bg-blue-700 text-white'
                          : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-medium text-gray-400">[{el.elementType}]</span>{' '}
                      {el.description?.substring(0, 40)}
                    </button>
                  ))}
                  {capturedElements.length > 50 && (
                    <p className="text-xs text-gray-500 dark:text-gray-600 px-2 py-1">
                      ...and {capturedElements.length - 50} more
                    </p>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="flex-shrink-0 p-3 border-t border-gray-700 dark:border-gray-800">
                <div className="p-3 bg-gray-700 dark:bg-gray-800 rounded-lg text-xs text-gray-300">
                  <p className="font-medium text-blue-400 dark:text-blue-300 mb-1">Tips:</p>
                  <ul className="space-y-0.5 text-gray-400 dark:text-gray-500">
                    <li>- Click on the screenshot to select an element</li>
                    <li>- Or pick from the element list on the right</li>
                    <li>- Use Capture Again after navigating</li>
                  </ul>
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
