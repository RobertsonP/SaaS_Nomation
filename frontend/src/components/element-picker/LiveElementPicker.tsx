import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface DetectedElement {
  selector: string;
  tagName: string;
  textContent: string;
  attributes: Record<string, string>;
  boundingRect: { x: number; y: number; width: number; height: number };
  distance?: number;
  confidence?: number;
}

interface SelectedElement {
  selector: string;
  description: string;
  attributes: Record<string, string>;
  tagName: string;
  action?: 'click' | 'select'; // Action that was performed on the element
}

// Action modes for the element picker
type ActionMode = 'select' | 'click';

export function LiveElementPicker({
  isOpen = true,
  projectId,
  onClose,
  onElementsSelected,
  onSelectElement,
  initialUrl = 'https://example.com'
}: LiveElementPickerProps) {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>([]);
  const [showElementList, setShowElementList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>('select');
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  const screenshotRef = useRef<HTMLImageElement>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);

  // Initialize browser session
  useEffect(() => {
    if (!isOpen) return;

    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        logger.info('Creating browser session for element picker');
        const session = await browserAPI.createSession(projectId);
        setSessionToken(session.sessionToken);
        logger.info('Session created:', session.sessionToken);

        // Navigate to initial URL
        if (initialUrl) {
          await browserAPI.navigateSession(session.sessionToken, initialUrl);
          setCurrentUrl(initialUrl);
        }

        // Start screenshot polling
        startScreenshotPolling(session.sessionToken);

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
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (sessionToken) {
        browserAPI.closeSession(sessionToken).catch(err =>
          logger.error('Failed to close session:', err)
        );
      }
    };
  }, [isOpen, projectId, initialUrl]);

  // Screenshot polling
  const startScreenshotPolling = useCallback((token: string) => {
    const captureScreenshot = async () => {
      try {
        const response = await browserAPI.getSessionScreenshot(token);
        setScreenshot(response.screenshot);
      } catch (err) {
        logger.warn('Screenshot capture failed:', err);
      }
    };

    // Initial capture
    captureScreenshot();

    // Task 1.10: Poll every 500ms for faster updates
    screenshotIntervalRef.current = setInterval(captureScreenshot, 500);
  }, []);

  // Handle URL navigation
  const handleGo = async () => {
    if (!inputUrl || inputUrl === currentUrl || !sessionToken) return;

    setIsNavigating(true);
    setError(null);
    setDetectedElements([]);
    setSelectedElement(null);

    try {
      logger.info('Navigating to:', inputUrl);
      await browserAPI.navigateSession(sessionToken, inputUrl);
      setCurrentUrl(inputUrl);
    } catch (err: any) {
      logger.error('Navigation failed:', err);
      setError(err.message || 'Failed to navigate to URL');
    } finally {
      setIsNavigating(false);
    }
  };

  // Handle click on screenshot to detect elements
  const handleScreenshotClick = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (!sessionToken || !screenshotRef.current) return;

    // Task 1.10: Debounce rapid clicks (min 300ms between clicks)
    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) {
      logger.debug('Click debounced - too fast');
      return;
    }
    lastClickTimeRef.current = now;

    const img = screenshotRef.current;
    const rect = img.getBoundingClientRect();

    // Calculate click position relative to the displayed image
    const displayX = event.clientX - rect.left;
    const displayY = event.clientY - rect.top;

    // Calculate scale factor (image might be scaled to fit container)
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    // Convert to actual page coordinates
    const pageX = Math.round(displayX * scaleX);
    const pageY = Math.round(displayY * scaleY);

    logger.info(`Click at display (${displayX}, ${displayY}) → page (${pageX}, ${pageY}) | Mode: ${actionMode}`);

    // Task 1.10: Show IMMEDIATE visual feedback before API call (optimistic UI)
    setClickPosition({ x: displayX, y: displayY });
    setPendingClick({ x: displayX, y: displayY });
    setDetectedElements([]);
    setShowElementList(false);

    // Task 1.10: Defer loading state by 100ms to avoid flash for fast responses
    const loadingTimeout = setTimeout(() => setIsLoading(true), 100);

    try {
      // Use cross-origin detection to find elements at click position
      const result = await browserAPI.crossOriginElementDetection({
        url: currentUrl,
        clickX: pageX,
        clickY: pageY,
        viewport: {
          width: img.naturalWidth || 1920,
          height: img.naturalHeight || 1080
        }
      });

      if (result.success && result.elements && result.elements.length > 0) {
        logger.info(`Found ${result.elements.length} elements near click`);
        setDetectedElements(result.elements);
        setShowElementList(true);

        // Auto-select the closest element
        const closest = result.elements[0];
        const elementSelector = closest.selector || closest.selectors?.[0] || `${closest.tagName}`;

        // If in click mode, execute click action on the element
        if (actionMode === 'click') {
          setIsExecutingAction(true);
          try {
            logger.info(`Executing click action on: ${elementSelector}`);
            await browserAPI.executeAction(sessionToken, {
              type: 'click',
              selector: elementSelector
            });
            logger.info('Click action completed successfully');

            // Wait for page to settle and capture new screenshot
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (clickErr: any) {
            logger.warn('Click action failed:', clickErr);
            // Continue anyway - element was still detected
          } finally {
            setIsExecutingAction(false);
          }
        }

        setSelectedElement({
          selector: elementSelector,
          description: closest.textContent || closest.innerText || `${closest.tagName} element`,
          attributes: closest.attributes || {},
          tagName: closest.tagName,
          action: actionMode === 'click' ? 'click' : undefined
        });
      } else {
        setError('No interactive elements found at that location. Try clicking on a button, link, or input field.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err: any) {
      logger.error('Element detection failed:', err);
      setError(err.message || 'Failed to detect elements');
    } finally {
      // Task 1.10: Clear loading timeout and states
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      setIsExecutingAction(false);
      setPendingClick(null);
      setTimeout(() => setClickPosition(null), 300); // Faster feedback clear
    }
  };

  // Handle element selection from list
  const handleSelectFromList = (element: DetectedElement) => {
    setSelectedElement({
      selector: element.selector || `${element.tagName}`,
      description: element.textContent || `${element.tagName} element`,
      attributes: element.attributes || {},
      tagName: element.tagName
    });
    setShowElementList(false);
  };

  // Handle adding selected element to test
  const handleAddSelectedElement = () => {
    if (selectedElement) {
      logger.info('Adding element to test:', selectedElement.selector);
      onSelectElement?.(selectedElement.selector, selectedElement.description);
      onClose();
    }
  };

  // Handle close and cleanup
  const handleClose = async () => {
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
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
      <div className="flex-shrink-0 bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-3">
        <h3 className="text-lg font-semibold text-blue-400">⚡ Live Element Picker</h3>
        <div className="flex-grow flex gap-2">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleGo()}
            className="flex-grow px-3 py-1.5 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter URL to pick elements from"
            disabled={isLoading || isNavigating}
          />
          <button
            onClick={handleGo}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
            disabled={isLoading || isNavigating || !sessionToken}
          >
            {isNavigating ? 'Loading...' : 'Go'}
          </button>
        </div>
        <button
          onClick={handleClose}
          className="px-4 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Action Mode Toolbar */}
      <div className="flex-shrink-0 bg-gray-800 px-3 py-2 border-b border-gray-700 flex items-center gap-4">
        <span className="text-sm text-gray-400 font-medium">Mode:</span>
        <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActionMode('select')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              actionMode === 'select'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
            title="Select element without interaction"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              Select Only
            </span>
          </button>
          <button
            onClick={() => setActionMode('click')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              actionMode === 'click'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
            title="Click element, then capture"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
              Click & Capture
            </span>
          </button>
        </div>
        <span className="text-xs text-gray-500 ml-2">
          {actionMode === 'select' && 'Click to identify element without interaction'}
          {actionMode === 'click' && 'Click to interact with element, then capture selector'}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex overflow-hidden">
        {/* Browser Frame */}
        <div className="flex-grow bg-gray-900 relative overflow-hidden flex items-center justify-center">
          {/* Loading State */}
          {(isLoading && !screenshot) && (
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Starting browser session...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-20">
              {error}
            </div>
          )}

          {/* Screenshot Display */}
          {screenshot && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Picking Mode Indicator */}
              <div className={`absolute top-4 left-4 ${
                actionMode === 'click' ? 'bg-purple-600' : 'bg-green-600'
              } text-white px-3 py-2 rounded-lg shadow-lg z-20 flex items-center space-x-2`}>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  {actionMode === 'select' && '🎯 Click any element to select'}
                  {actionMode === 'click' && '👆 Click to interact & capture'}
                </span>
              </div>

              {/* Current URL Badge */}
              <div className="absolute top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-xs font-mono z-20 max-w-xs truncate">
                {currentUrl}
              </div>

              {/* Interactive Screenshot - Task 1.10: Added smooth transitions */}
              <img
                ref={screenshotRef}
                src={screenshot}
                alt="Live browser session"
                className="max-w-full max-h-full object-contain cursor-crosshair border-2 border-gray-600 rounded-lg shadow-2xl hover:border-blue-500 transition-all duration-150"
                style={{
                  minHeight: '400px',
                  backgroundColor: 'white',
                  opacity: pendingClick ? 0.95 : 1, // Subtle feedback during detection
                }}
                onClick={handleScreenshotClick}
              />

              {/* Click Indicator - Task 1.10: Instant feedback with crosshair + ripple */}
              {(clickPosition || pendingClick) && (
                <>
                  {/* Crosshair - shows immediately */}
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{
                      left: `calc(50% + ${(clickPosition || pendingClick)!.x - 300}px)`,
                      top: `calc(50% + ${(clickPosition || pendingClick)!.y - 200}px)`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="w-8 h-8 border-2 border-blue-400 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  {/* Ripple animation */}
                  <div
                    className="absolute w-6 h-6 bg-blue-500 rounded-full opacity-75 animate-ping pointer-events-none"
                    style={{
                      left: `calc(50% + ${(clickPosition || pendingClick)!.x - 300}px)`,
                      top: `calc(50% + ${(clickPosition || pendingClick)!.y - 200}px)`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                </>
              )}

              {/* Loading Overlay - Task 1.10: Only show for actual loading, not pending */}
              {(isLoading || isExecutingAction) && screenshot && !pendingClick && (
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-10 transition-opacity duration-150">
                  <div className="text-center text-white">
                    <div className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 mx-auto mb-2 ${
                      isExecutingAction ? 'border-purple-400' : 'border-white'
                    }`}></div>
                    <p className="text-sm">
                      {isExecutingAction ? 'Executing click action...' : 'Detecting elements...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inspector Panel */}
        <aside className="flex-shrink-0 w-80 bg-gray-800 border-l border-gray-700 p-4 flex flex-col overflow-y-auto">
          <h4 className="text-lg font-semibold text-white mb-4">Selected Element</h4>

          {selectedElement ? (
            <div className="bg-gray-900 p-4 rounded-lg flex-grow flex flex-col">
              <div className="mb-3">
                <p className="font-medium text-gray-300 text-sm uppercase tracking-wide mb-1">Description</p>
                <p className="text-white">{selectedElement.description}</p>
              </div>

              <div className="mb-3">
                <p className="font-medium text-gray-300 text-sm uppercase tracking-wide mb-1">Selector</p>
                <code className="text-sm text-green-400 break-all font-mono bg-gray-800 p-2 rounded block">
                  {selectedElement.selector}
                </code>
              </div>

              <div className="text-gray-400 text-sm mb-4">
                <p>Tag: <span className="text-white">{selectedElement.tagName}</span></p>
                {selectedElement.attributes.id && (
                  <p>ID: <span className="text-white">#{selectedElement.attributes.id}</span></p>
                )}
                {selectedElement.attributes.class && (
                  <p className="truncate">Class: <span className="text-white">.{selectedElement.attributes.class.split(' ')[0]}</span></p>
                )}
                {selectedElement.action && (
                  <p className="mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-600 text-white text-xs">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                      </svg>
                      Click action performed
                    </span>
                  </p>
                )}
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
              <div className="text-4xl mb-3">🎯</div>
              <p className="mb-2">Click on an element in the browser to select it.</p>
              <p className="text-sm text-gray-500">Elements near your click will be detected automatically.</p>
            </div>
          )}

          {/* Detected Elements List */}
          {showElementList && detectedElements.length > 1 && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <h5 className="text-sm font-semibold text-gray-300 mb-2">
                Other elements found ({detectedElements.length}):
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detectedElements.slice(1).map((el, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectFromList(el)}
                    className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    <div className="text-white truncate">{el.textContent || el.tagName}</div>
                    <div className="text-gray-400 text-xs truncate font-mono">{el.selector}</div>
                    {el.distance !== undefined && (
                      <div className="text-gray-500 text-xs">{el.distance}px away</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm text-gray-300">
            <p className="font-medium text-blue-400 mb-2">💡 Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• Click directly on buttons, links, or inputs</li>
              <li>• Multiple nearby elements will be detected</li>
              <li>• Choose the most specific selector</li>
              <li>• Press ESC or click Close to cancel</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
