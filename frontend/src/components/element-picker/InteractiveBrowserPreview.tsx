import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../../lib/api';

interface InteractiveBrowserPreviewProps {
  url: string;
  isPickingMode: boolean;
  onElementSelected: (elementData: any) => void;
  className?: string;
}

interface BrowserSession {
  sessionToken: string;
  currentUrl: string | null;
}

export function InteractiveBrowserPreview({
  url,
  isPickingMode,
  onElementSelected,
  className = ''
}: InteractiveBrowserPreviewProps) {
  const [browserSession, setBrowserSession] = useState<BrowserSession | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [highlightPosition, setHighlightPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const screenshotRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Screenshot refresh interval and performance optimization
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hoverDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverTime = useRef<number>(0);

  // 🚀 CREATE BROWSER SESSION
  const createBrowserSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 Creating browser session...');
      const response = await api.post('/api/public/browser/sessions', {
        projectId: 'live-picker-session'
      });
      
      const session = response.data;
      setBrowserSession(session);
      console.log('✅ Browser session created:', session.sessionToken);
      
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create browser session';
      console.error('❌ Failed to create browser session:', err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 🌐 NAVIGATE TO URL
  const navigateToUrl = useCallback(async (targetUrl: string) => {
    if (!browserSession) return;
    
    try {
      setIsNavigating(true);
      setError(null);
      
      console.log('🌐 Navigating to:', targetUrl);
      await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/navigate`, {
        url: targetUrl
      });
      
      // Wait a moment for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Navigation completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Navigation failed';
      console.error('❌ Navigation failed:', err);
      setError(`Navigation failed: ${errorMessage}`);
    } finally {
      setIsNavigating(false);
    }
  }, [browserSession]);

  // 📸 CAPTURE SCREENSHOT
  const captureScreenshot = useCallback(async () => {
    if (!browserSession) return;
    
    try {
      const response = await api.get(`/api/public/browser/sessions/${browserSession.sessionToken}/screenshot`);
      setScreenshot(response.data.screenshot);
    } catch (err) {
      console.warn('⚠️ Screenshot capture failed:', err);
      // Don't show error for screenshot failures - they're expected during navigation
    }
  }, [browserSession]);

  // ⏰ START SCREENSHOT POLLING
  const startScreenshotPolling = useCallback(() => {
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
    
    // Capture screenshot immediately
    captureScreenshot();
    
    // SMART POLLING: Pause when not picking, faster when active
    screenshotIntervalRef.current = setInterval(() => {
      if (isPickingMode || hoveredElement) {
        captureScreenshot(); // Active mode - full polling
      } else {
        // Inactive mode - reduce polling to save performance
        if (Math.random() < 0.3) captureScreenshot(); // 30% chance when inactive
      }
    }, isPickingMode ? 1000 : 8000); // 🎯 CRITICAL FIX: 1s active (was 3s), 8s inactive
  }, [captureScreenshot]);

  // 🛑 STOP SCREENSHOT POLLING
  const stopScreenshotPolling = useCallback(() => {
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
      screenshotIntervalRef.current = null;
    }
  }, []);

  // 🖱️ HANDLE MOUSE EVENTS ON SCREENSHOT (DEBOUNCED FOR PERFORMANCE)
  const handleMouseMove = useCallback(async (e: React.MouseEvent) => {
    if (!browserSession || !screenshotRef.current || !isPickingMode) return;
    
    // Performance optimization: debounce mouse events
    const now = Date.now();
    if (now - lastHoverTime.current < 150) return; // 🎯 CRITICAL FIX: 150ms (was 300ms) for more responsiveness
    lastHoverTime.current = now;
    
    // Clear previous debounce
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
    }
    
    // Debounce the API call
    hoverDebounceRef.current = setTimeout(async () => {
      const rect = screenshotRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // 🎯 SURGICAL FIX: Enhanced coordinate transformation with boundary validation
      const relativeX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); // Clamp to 0-1
      const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); // Clamp to 0-1
      
      const x = Math.round(relativeX * 1920); // Scale to browser viewport (1920px) with rounding
      const y = Math.round(relativeY * 1080); // Scale to browser viewport (1080px) with rounding
      
      // Additional boundary validation to ensure coordinates are within viewport
      const clampedX = Math.max(0, Math.min(1920, x));
      const clampedY = Math.max(0, Math.min(1080, y));
      
      try {
        const response = await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/hover`, {
          x: clampedX, // 🎯 USE CLAMPED COORDINATES
          y: clampedY  // 🎯 USE CLAMPED COORDINATES
        });
      
      if (response.data.element && screenshotRef.current) {
        setHoveredElement(response.data.element);
        
        // Calculate highlight position relative to screenshot
        const rect = screenshotRef.current.getBoundingClientRect();
        const element = response.data.element;
        
        if (element.position) {
          const highlightX = (element.position.x / 1920) * rect.width;
          const highlightY = (element.position.y / 1080) * rect.height;
          const highlightWidth = (element.position.width / 1920) * rect.width;
          const highlightHeight = (element.position.height / 1080) * rect.height;
          
          setHighlightPosition({
            x: highlightX,
            y: highlightY,
            width: Math.max(highlightWidth, 2),
            height: Math.max(highlightHeight, 2)
          });
        }
        } else {
          setHoveredElement(null);
          setHighlightPosition(null);
        }
      } catch (err) {
        // Silent fail for hover - don't spam console
      }
    }, 150); // 🎯 CRITICAL FIX: 150ms debounce (was 300ms) for faster response
  }, [browserSession, isPickingMode]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (!browserSession || !screenshotRef.current) return;
    
    const rect = screenshotRef.current.getBoundingClientRect();
    
    // 🎯 SURGICAL FIX: Enhanced coordinate transformation with boundary validation (same as hover)
    const relativeX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); // Clamp to 0-1
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); // Clamp to 0-1
    
    const x = Math.round(relativeX * 1920); // Scale to browser viewport (1920px) with rounding
    const y = Math.round(relativeY * 1080); // Scale to browser viewport (1080px) with rounding
    
    // Additional boundary validation to ensure coordinates are within viewport
    const clampedX = Math.max(0, Math.min(1920, x));
    const clampedY = Math.max(0, Math.min(1080, y));
    
    try {
      const response = await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/click`, {
        x: clampedX, // 🎯 USE CLAMPED COORDINATES  
        y: clampedY  // 🎯 USE CLAMPED COORDINATES
      });
      
      if (isPickingMode && response.data.element && response.data.element.tagName) {
        // Process element selection with our robust selector generator
        setSelectedElement(response.data.element);
        onElementSelected(response.data.element);
        console.log('🎯 Element selected:', response.data.element);
        
        // 🎯 CRITICAL FIX: Immediate screenshot update after element selection
        setTimeout(() => {
          captureScreenshot();
        }, 100);
        
        // Visual feedback: briefly highlight the selected element
        setTimeout(() => {
          setSelectedElement(null);
        }, 2000);
      } else {
        // Regular click - refresh screenshot after a short delay
        setTimeout(() => {
          captureScreenshot();
        }, 500);
      }
    } catch (err) {
      console.error('❌ Click failed:', err);
      setError('Click interaction failed');
    }
  }, [browserSession, isPickingMode, onElementSelected, captureScreenshot]);

  // 📜 HANDLE SCROLL - FIXED: Remove preventDefault to avoid passive listener conflict
  const handleWheel = useCallback(async (e: React.WheelEvent) => {
    if (!browserSession) return;
    
    try {
      await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/scroll`, {
        deltaY: e.deltaY,
        deltaX: e.deltaX
      });
      
      // Refresh screenshot after scroll
      setTimeout(() => {
        captureScreenshot();
      }, 100);
    } catch (err) {
      console.warn('⚠️ Scroll failed:', err);
    }
  }, [browserSession, captureScreenshot]);

  // 🎮 BROWSER NAVIGATION CONTROLS
  const handleRefresh = useCallback(async () => {
    if (!browserSession) return;
    
    try {
      setIsNavigating(true);
      await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/refresh`);
      
      setTimeout(() => {
        captureScreenshot();
        setIsNavigating(false);
      }, 2000);
    } catch (err) {
      console.error('❌ Refresh failed:', err);
      setIsNavigating(false);
    }
  }, [browserSession, captureScreenshot]);

  const handleGoBack = useCallback(async () => {
    if (!browserSession) return;
    
    try {
      await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/back`);
      setTimeout(() => captureScreenshot(), 1000);
    } catch (err) {
      console.warn('⚠️ Go back failed:', err);
    }
  }, [browserSession, captureScreenshot]);

  const handleGoForward = useCallback(async () => {
    if (!browserSession) return;
    
    try {
      await api.post(`/api/public/browser/sessions/${browserSession.sessionToken}/forward`);
      setTimeout(() => captureScreenshot(), 1000);
    } catch (err) {
      console.warn('⚠️ Go forward failed:', err);
    }
  }, [browserSession, captureScreenshot]);

  // 🔄 INITIALIZE WHEN URL CHANGES
  useEffect(() => {
    if (url && !browserSession) {
      createBrowserSession().then(session => {
        if (session) {
          navigateToUrl(url);
        }
      });
    } else if (url && browserSession && browserSession.currentUrl !== url) {
      navigateToUrl(url);
    }
  }, [url, browserSession, createBrowserSession, navigateToUrl]);

  // 📸 START/STOP SCREENSHOT POLLING (OPTIMIZED)
  useEffect(() => {
    if (browserSession && !isNavigating) {
      startScreenshotPolling();
    } else {
      stopScreenshotPolling();
    }
    
    return () => {
      stopScreenshotPolling();
      // Cleanup debounce timeout
      if (hoverDebounceRef.current) {
        clearTimeout(hoverDebounceRef.current);
      }
    };
  }, [browserSession, isNavigating, startScreenshotPolling, stopScreenshotPolling]);

  // 🧹 CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      stopScreenshotPolling();
      // Cleanup debounce timeout
      if (hoverDebounceRef.current) {
        clearTimeout(hoverDebounceRef.current);
      }
      if (browserSession) {
        // Clean up browser session
        api.delete(`/api/public/browser/sessions/${browserSession.sessionToken}`).catch(console.warn);
      }
    };
  }, [browserSession, stopScreenshotPolling]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🌐</div>
          <p>Enter a URL to start browsing</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-white overflow-hidden ${className}`} ref={containerRef} style={{ contain: 'layout style' }}>
      {/* 🎮 BROWSER NAVIGATION CONTROLS */}
      <div className="absolute top-0 left-0 right-0 bg-gray-800 text-white px-3 py-2 z-20 flex items-center space-x-2">
        <button
          onClick={handleGoBack}
          disabled={isNavigating}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
          title="Go Back"
        >
          ←
        </button>
        
        <button
          onClick={handleGoForward}
          disabled={isNavigating}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
          title="Go Forward"
        >
          →
        </button>
        
        <button
          onClick={handleRefresh}
          disabled={isNavigating}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
          title="Refresh"
        >
          ⟳
        </button>
        
        <div className="flex-1 bg-gray-700 rounded px-3 py-1 text-sm">
          {url}
        </div>
        
        <div className="text-xs text-gray-300">
          1920×1080
        </div>
      </div>

      {/* 📱 STATUS INDICATORS */}
      <div className="absolute top-12 left-2 z-20 space-y-1">
        {isLoading && (
          <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
            <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"></div>
            <span>Creating Session...</span>
          </div>
        )}
        
        {isNavigating && (
          <div className="bg-orange-600 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
            <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
            <span>Loading...</span>
          </div>
        )}
        
        
        {isPickingMode && (
          <div className="bg-purple-600 text-white px-2 py-1 rounded text-xs flex items-center space-x-1">
            <span>🎯</span>
            <span>Click to Select Elements</span>
          </div>
        )}
      </div>

      {/* ⚠️ ERROR DISPLAY */}
      {error && (
        <div className="absolute top-12 right-2 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded z-20 max-w-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 🖼️ LIVE BROWSER SCREENSHOT */}
      <div className="pt-10 relative overflow-hidden">
        {screenshot ? (
          <div className="relative overflow-hidden" style={{ contain: 'layout' }}>
            <img
              ref={screenshotRef}
              src={screenshot}
              alt="Live Browser View"
              className="w-full cursor-pointer"
              style={{ 
                minHeight: '600px',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              onWheel={handleWheel}
            />
            
            {/* 🎯 ELEMENT HIGHLIGHT OVERLAY */}
            {isPickingMode && highlightPosition && hoveredElement && (
              <div
                className="absolute border-2 border-blue-400 bg-blue-400 bg-opacity-10 animate-pulse pointer-events-none"
                style={{
                  left: `${highlightPosition.x}px`,
                  top: `${highlightPosition.y}px`,
                  width: `${highlightPosition.width}px`,
                  height: `${highlightPosition.height}px`,
                  zIndex: 10
                }}
              />
            )}
            
            {/* ✨ SELECTED ELEMENT CONFIRMATION */}
          </div>
        ) : (
          <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <p className="text-gray-600">Initializing browser...</p>
            </div>
          </div>
        )}


        {/* 📏 SCROLLABLE OVERLAY INDICATOR */}
        <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          Scroll & Click Interactive ✨
        </div>
      </div>
    </div>
  );
}