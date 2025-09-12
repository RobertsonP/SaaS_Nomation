import { useState, useEffect, useRef, useCallback } from 'react';
import { browserAPI } from '../../lib/api';

interface BrowserPreviewProps {
  url: string;
  isPickingMode: boolean;
  onElementSelected: (elementData: any) => void;
  onCrossOriginDetected?: (isCrossOrigin: boolean) => void;
  className?: string;
}

export function BrowserPreview({ 
  url, 
  isPickingMode, 
  onElementSelected, 
  onCrossOriginDetected,
  className = '' 
}: BrowserPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotDimensions, setScreenshotDimensions] = useState({ width: 0, height: 0 });
  const [hoveredCoords, setHoveredCoords] = useState<{ x: number; y: number } | null>(null);

  // Clean up session on unmount
  useEffect(() => {
    return () => {
      if (sessionToken) {
        browserAPI.closeSession(sessionToken).catch(console.error);
      }
    };
  }, [sessionToken]);

  // Load page using backend Playwright browser
  const loadPage = useCallback(async (pageUrl: string) => {
    if (!pageUrl) return;
    
    setIsLoading(true);
    setLoadError(null);
    setScreenshot(null);
    
    // Backend Playwright has no cross-origin restrictions!
    onCrossOriginDetected?.(false);
    
    try {
      console.log('🚀 Creating backend Playwright session for:', pageUrl);
      
      // Create browser session with backend Playwright
      // Pass empty string to trigger backend's default project fallback
      const sessionResponse = await browserAPI.createSession('');
      const newSessionToken = sessionResponse.sessionToken;
      setSessionToken(newSessionToken);
      
      console.log('✅ Playwright session created:', newSessionToken);
      
      // Navigate to page (supports ANY URL - HTTP/HTTPS/localhost)
      console.log('🌐 Navigating to page:', pageUrl);
      await browserAPI.navigateSession(newSessionToken, pageUrl);
      
      console.log('✅ Navigation completed, capturing screenshot...');
      
      // Get screenshot from backend Playwright
      const screenshotResponse = await browserAPI.getSessionScreenshot(newSessionToken);
      
      if (screenshotResponse.screenshot) {
        // Backend returns base64 data, fix format if needed
        let screenshotData = screenshotResponse.screenshot;
        if (!screenshotData.startsWith('data:image/')) {
          screenshotData = `data:image/png;base64,${screenshotData}`;
        }
        
        setScreenshot(screenshotData);
        console.log('✅ Screenshot captured successfully from Playwright');
        
        // Create image to get dimensions
        const img = new Image();
        img.onload = () => {
          setScreenshotDimensions({ width: img.width, height: img.height });
        };
        img.src = screenshotData;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to load page in Playwright browser:', error);
      setLoadError(`Failed to load page: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [onCrossOriginDetected]);

  // Handle URL changes
  useEffect(() => {
    if (url) {
      loadPage(url);
    }
  }, [url, loadPage]);

  // Handle element selection from screenshot coordinates
  const handleScreenshotClick = useCallback(async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingMode || !sessionToken || !screenshot) {
      console.log('🔍 Click ignored: picking mode off, no session, or no screenshot');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = screenshotDimensions.width / rect.width;
    const scaleY = screenshotDimensions.height / rect.height;
    
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;
    
    console.log(`🎯 Element selection at coordinates: (${Math.round(clickX)}, ${Math.round(clickY)})`);
    
    try {
      setIsLoading(true);
      
      // Use backend Playwright to detect element at coordinates
      const result = await browserAPI.crossOriginElementDetection({
        url: url,
        clickX: clickX,
        clickY: clickY,
        viewport: screenshotDimensions
      });
      
      if (result.success && result.elements && result.elements.length > 0) {
        const selectedElement = result.elements[0];
        console.log('✅ Element detected by Playwright:', selectedElement);
        
        // Transform element data for frontend with proper SelectorGenerator format
        const elementData = {
          tagName: selectedElement.tagName || 'unknown',
          selectors: selectedElement.selectors ? selectedElement.selectors : [selectedElement.selector].filter(Boolean), // Fix: ensure selectors array exists
          attributes: selectedElement.attributes || {},
          textContent: selectedElement.text || selectedElement.textContent || '',
          innerText: selectedElement.text || selectedElement.textContent || '',
          boundingRect: selectedElement.boundingRect || {
            x: clickX,
            y: clickY,
            width: 100,
            height: 30
          },
          href: selectedElement.href || null,
          src: selectedElement.attributes?.src || null,
          value: selectedElement.value || selectedElement.attributes?.value || null,
          placeholder: selectedElement.placeholder || selectedElement.attributes?.placeholder || null,
          title: selectedElement.attributes?.title || null,
          role: selectedElement.role || selectedElement.attributes?.role || null,
          ariaLabel: selectedElement.ariaLabel || selectedElement.attributes?.['aria-label'] || null,
          // Include CSS info that will be enhanced later with real data
          cssInfo: {
            isVisible: true,
            isStyled: true,
            hasBackground: true,
            hasText: !!(selectedElement.text || selectedElement.textContent),
            color: 'rgb(0, 0, 0)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            fontFamily: 'system-ui',
            display: 'block',
            position: 'static'
          }
        };
        
        onElementSelected(elementData);
        
        // Show visual feedback
        drawSelectionIndicator(clickX, clickY);
        
      } else {
        console.warn('❌ No element found at clicked coordinates');
        setLoadError('No element found at that location. Try clicking on a different area.');
        setTimeout(() => setLoadError(null), 3000);
      }
      
    } catch (error) {
      console.error('❌ Element detection failed:', error);
      setLoadError('Element detection failed. Please try again.');
      setTimeout(() => setLoadError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [isPickingMode, sessionToken, screenshot, screenshotDimensions, url, onElementSelected]);

  // Infer element type from element data
  const inferElementType = (element: any): string => {
    const tagName = element.tagName?.toLowerCase() || '';
    const type = element.attributes?.type?.toLowerCase() || '';
    
    if (tagName === 'button' || type === 'button' || type === 'submit') return 'button';
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return 'input';
    if (tagName === 'a') return 'link';
    if (tagName === 'form') return 'form';
    if (tagName === 'nav' || element.attributes?.role === 'navigation') return 'navigation';
    return 'text';
  };

  // Handle mouse movement for hover effects
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingMode || !screenshot) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = screenshotDimensions.width / rect.width;
    const scaleY = screenshotDimensions.height / rect.height;
    
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    
    setHoveredCoords({ x: mouseX, y: mouseY });
  }, [isPickingMode, screenshot, screenshotDimensions]);

  // Draw selection indicator on canvas
  const drawSelectionIndicator = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate canvas coordinates
    const rect = canvas.getBoundingClientRect();
    const canvasX = (x / screenshotDimensions.width) * canvas.width;
    const canvasY = (y / screenshotDimensions.height) * canvas.height;
    
    // Draw selection indicator
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(canvasX - 20, canvasY);
    ctx.lineTo(canvasX + 20, canvasY);
    ctx.moveTo(canvasX, canvasY - 20);
    ctx.lineTo(canvasX, canvasY + 20);
    ctx.stroke();
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 15, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Clear indicator after 2 seconds
    setTimeout(() => {
      if (screenshot) {
        redrawScreenshot();
      }
    }, 2000);
  }, [screenshotDimensions, screenshot]);

  // Redraw screenshot on canvas
  const redrawScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !screenshot) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Add hover effect if hovering
      if (hoveredCoords && isPickingMode) {
        const canvasX = (hoveredCoords.x / screenshotDimensions.width) * canvas.width;
        const canvasY = (hoveredCoords.y / screenshotDimensions.height) * canvas.height;
        
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, 10, 0, 2 * Math.PI);
        ctx.stroke();
      }
    };
    img.src = screenshot;
  }, [screenshot, hoveredCoords, isPickingMode, screenshotDimensions]);

  // Draw screenshot when it changes
  useEffect(() => {
    if (screenshot) {
      redrawScreenshot();
    }
  }, [screenshot, redrawScreenshot]);

  // Refresh screenshot periodically during picking mode
  useEffect(() => {
    if (!isPickingMode || !sessionToken) return;
    
    const interval = setInterval(async () => {
      try {
        const screenshotResponse = await browserAPI.getSessionScreenshot(sessionToken);
        if (screenshotResponse.screenshot) {
          let screenshotData = screenshotResponse.screenshot;
          if (!screenshotData.startsWith('data:image/')) {
            screenshotData = `data:image/png;base64,${screenshotData}`;
          }
          setScreenshot(screenshotData);
        }
      } catch (error) {
        console.warn('Failed to refresh screenshot:', error);
      }
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, [isPickingMode, sessionToken]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🌐</div>
          <p>Enter a URL to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-gray-600">Loading website in Playwright...</p>
            <p className="text-sm text-gray-500 mt-1">{new URL(url).hostname}</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
          <div className="text-center max-w-md p-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Cannot Load Website</h3>
            <p className="text-red-700 mb-4">{loadError}</p>
            
            <button
              onClick={() => loadPage(url)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              🔄 Retry
            </button>
          </div>
        </div>
      )}

      {/* Playwright status indicators */}
      {sessionToken && !isLoading && !loadError && (
        <>
          <div className="absolute -top-8 left-0 bg-green-600 text-white px-3 py-1 rounded-t-lg shadow-lg z-20 flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">Playwright Browser Active</span>
          </div>
          
          {isPickingMode && (
            <div className="absolute -top-8 right-0 bg-blue-600 text-white px-3 py-1 rounded-t-lg shadow-lg z-20 flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs font-medium">Click Screenshot to Select Elements</span>
            </div>
          )}
        </>
      )}

      {/* Main screenshot canvas */}
      {screenshot && (
        <canvas
          ref={canvasRef}
          onClick={handleScreenshotClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredCoords(null)}
          className={`w-full h-full border-0 ${isPickingMode ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{
            background: 'white',
            minHeight: '600px',
            maxHeight: '80vh',
            objectFit: 'contain'
          }}
        />
      )}
    </div>
  );
}