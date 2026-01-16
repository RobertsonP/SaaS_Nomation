import { useState, useEffect, useRef, useCallback } from 'react';
import { browserAPI } from '../../lib/api';
import { createLogger } from '../../lib/logger';

const logger = createLogger('BrowserPreview');

interface BrowserPreviewProps {
  url: string;
  isPickingMode: boolean;
  onElementSelected: (elementData: any) => void;
  className?: string;
}

interface ElementHighlight {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export function BrowserPreview({ 
  url, 
  isPickingMode, 
  onElementSelected, 
  className = '' 
}: BrowserPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setHighlight] = useState<ElementHighlight>({ 
    x: 0, y: 0, width: 0, height: 0, visible: false 
  });
  const [isCrossOrigin, setIsCrossOrigin] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  const LOAD_TIMEOUT_MS = 15000; // 15 second timeout

  // Handle iframe load events
  const handleIframeLoad = useCallback(() => {
    logger.debug('Iframe loaded successfully');

    // Clear any existing timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }

    setIsLoading(false);
    setLoadError(null);
    setRetryCount(0); // Reset retry count on successful load

    // Try to inject element selection script if same-origin
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) {
        logger.warn('Iframe not accessible - missing window or document');
        return;
      }

      // Check if we can access the iframe content (same-origin)
      const iframeDoc = iframe.contentDocument;
      logger.debug('Iframe document accessible - same origin detected');

      // Inject our element picker script
      if (iframeDoc && isPickingMode) {
        logger.debug('Injecting element picker script (picking mode is active)');
        injectElementPickerScript(iframeDoc);
      } else if (iframeDoc) {
        logger.debug('Iframe loaded but picking mode is not active yet');
      }

    } catch (error) {
      logger.warn('Cannot inject scripts into cross-origin iframe', error);
      // For cross-origin, use backend proxy solution
      setIsCrossOrigin(true);
      setLoadError('⚠️ Cross-origin website detected. Using advanced element detection...');
      handleCrossOriginFallback();
    }
  }, [isPickingMode, loadTimeout]);

  // Retry function for failed loads
  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setLoadError(null);
      setIsLoading(true);
      
      // Force iframe reload by updating src
      const iframe = iframeRef.current;
      if (iframe && url) {
        // Add cache-busting parameter to force reload
        const separator = url.includes('?') ? '&' : '?';
        const cacheBustUrl = `${url}${separator}_retry=${Date.now()}`;
        iframe.src = cacheBustUrl;
      }
    } else {
      setLoadError('Maximum retry attempts reached. Please try a different URL or check your internet connection.');
    }
  }, [retryCount, maxRetries, url]);

  const handleIframeError = useCallback(() => {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }
    
    setIsLoading(false);
    
    if (retryCount < maxRetries) {
      setLoadError(`Failed to load website (${retryCount + 1}/${maxRetries + 1}). Retrying in a moment...`);
      // Auto-retry with exponential backoff
      setTimeout(() => {
        handleRetry();
      }, Math.pow(2, retryCount) * 1000); // 1s, 2s, 4s backoff
    } else {
      setLoadError('Failed to load website after multiple attempts. The site may not allow embedding, may be unreachable, or there may be a network issue.');
    }
  }, [loadTimeout, retryCount, maxRetries, handleRetry]);

  // Cross-origin fallback using backend headless browser
  const handleCrossOriginFallback = useCallback(async () => {
    logger.info('Switching to cross-origin element detection mode');
    
    // Clear the error after showing it briefly
    setTimeout(() => {
      setLoadError(null);
      setIsLoading(false);
    }, 2000);

    // Show cross-origin specific instructions
    setTimeout(() => {
      if (isPickingMode) {
        alert(`🎯 Cross-Origin Element Picker Active!\n\nSince this website blocks direct interaction, we're using advanced detection:\n\n1. Click anywhere on the page to capture that area\n2. Our backend will analyze the page and find selectable elements\n3. Elements will be automatically detected and added\n\nClick anywhere on the page to start!`);
      }
    }, 2500);
  }, [isPickingMode]);

  // Handle cross-origin clicks
  const handleCrossOriginClick = useCallback(async (event: React.MouseEvent) => {
    if (!isCrossOrigin || !isPickingMode) return;
    
    event.preventDefault();
    event.stopPropagation();

    logger.debug('Cross-origin click detected, analyzing page...');
    
    try {
      // Get click coordinates relative to iframe
      const rect = iframeRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      // Show loading indicator
      setIsLoading(true);
      
      // Call backend to analyze the page at the clicked coordinates using proper API
      const analysisResult = await browserAPI.crossOriginElementDetection({
        url: url,
        clickX: clickX,
        clickY: clickY,
        viewport: {
          width: rect.width,
          height: rect.height
        }
      });
      
      if (analysisResult.success && analysisResult.elements) {
        // Process detected elements
        analysisResult.elements.forEach((elementData: any) => {
          onElementSelected(elementData);
        });
        
        alert(`✅ Found ${analysisResult.elements.length} elements near your click!\n\nElements have been automatically added to your selection.`);
      } else {
        alert('❌ No elements detected at that location. Try clicking on a different area.');
      }
      
    } catch (error) {
      logger.error('Cross-origin element detection failed', error);
      alert('❌ Element detection failed. The page may be too complex or protected.');
    } finally {
      setIsLoading(false);
    }
  }, [isCrossOrigin, isPickingMode, url, onElementSelected]);

  // Inject element picker functionality into the iframe
  const injectElementPickerScript = useCallback((doc: Document) => {
    if (!isPickingMode) {
      logger.debug('Script injection skipped - picking mode not active');
      return;
    }

    logger.debug('Starting script injection process...');

    // Remove existing scripts
    const existingScript = doc.getElementById('element-picker-script');
    if (existingScript) {
      logger.debug('Removing existing element picker script');
      existingScript.remove();
    }

    // Create and inject the element picker script
    const script = doc.createElement('script');
    script.id = 'element-picker-script';
    script.innerHTML = `
      (function() {
        let isHighlighting = true;
        let highlightedElement = null;
        let overlay = null;
        
        console.log('🎯 Element picker script injected and ready!');
        
        // Create highlight overlay
        function createOverlay() {
          if (overlay) overlay.remove();
          
          overlay = document.createElement('div');
          overlay.id = 'element-picker-overlay';
          overlay.style.cssText = \`
            position: absolute;
            background: rgba(59, 130, 246, 0.3);
            border: 2px solid #3B82F6;
            pointer-events: none;
            z-index: 999999;
            border-radius: 4px;
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.8);
            transition: all 0.1s ease;
          \`;
          document.body.appendChild(overlay);
        }
        
        // ENHANCED: Generate ROBUST selectors with stability priority
        function generateRobustSelectors(element) {
          const selectors = [];
          
          // 1. HIGHEST PRIORITY: Test-specific attributes
          if (element.getAttribute('data-testid')) {
            selectors.push(\`[data-testid="\${element.getAttribute('data-testid')}"]\`);
          }
          if (element.getAttribute('data-test')) {
            selectors.push(\`[data-test="\${element.getAttribute('data-test')}"]\`);
          }
          if (element.getAttribute('data-cy')) {
            selectors.push(\`[data-cy="\${element.getAttribute('data-cy')}"]\`);
          }
          
          // 2. HIGH PRIORITY: ID (if meaningful)
          if (element.id && !element.id.match(/^[0-9a-f]{8,}$/i)) {
            selectors.push(\`#\${element.id}\`);
          }
          
          // 3. MEDIUM-HIGH PRIORITY: Semantic attributes
          if (element.getAttribute('aria-label')) {
            selectors.push(\`[\${element.tagName.toLowerCase()}][aria-label="\${element.getAttribute('aria-label')}"]\`);
          }
          if (element.getAttribute('role')) {
            selectors.push(\`[role="\${element.getAttribute('role')}"]\`);
          }
          if (element.name && ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
            selectors.push(\`\${element.tagName.toLowerCase()}[name="\${element.name}"]\`);
          }
          
          // 4. MEDIUM PRIORITY: Stable class combinations
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\\s+/).filter(c => {
              // Filter out utility/framework classes that might change
              return !c.match(/^(p-|m-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|text-|bg-|border-|w-|h-|flex|grid|block|inline)/);
            });
            
            if (classes.length > 0) {
              // Use first stable class
              selectors.push(\`.\${classes[0]}\`);
              
              // If multiple stable classes, create specific combination
              if (classes.length > 1) {
                selectors.push(\`.\${classes.join('.')}\`);
              }
            }
          }
          
          // 5. ROBUST PATH SELECTOR: Build from meaningful parents
          function buildRobustPath(el) {
            const path = [];
            let current = el;
            let depth = 0;
            
            while (current && current.nodeType === Node.ELEMENT_NODE && depth < 5) {
              let selector = current.nodeName.toLowerCase();
              
              // Stop at meaningful IDs
              if (current.id && !current.id.match(/^[0-9a-f]{8,}$/i)) {
                selector += '#' + current.id;
                path.unshift(selector);
                break;
              }
              
              // Add meaningful attributes
              if (current.getAttribute('data-testid')) {
                selector += \`[data-testid="\${current.getAttribute('data-testid')}"]\`;
                path.unshift(selector);
                break;
              }
              
              if (current.className && typeof current.className === 'string') {
                const stableClasses = current.className.trim().split(/\\s+/).filter(c => 
                  !c.match(/^(p-|m-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|text-|bg-|border-|w-|h-|flex|grid|block|inline)/) &&
                  c.length > 2
                );
                
                if (stableClasses.length > 0) {
                  selector += '.' + stableClasses[0];
                }
              }
              
              // Add position only if necessary for uniqueness
              const parent = current.parentNode;
              if (parent && parent.nodeType === Node.ELEMENT_NODE) {
                const siblings = Array.from(parent.children).filter(sibling => 
                  sibling.nodeName === current.nodeName &&
                  sibling.className === current.className
                );
                if (siblings.length > 1) {
                  const index = siblings.indexOf(current) + 1;
                  selector += \`:nth-of-type(\${index})\`;
                }
              }
              
              path.unshift(selector);
              current = current.parentNode;
              depth++;
            }
            
            return path.join(' > ');
          }
          
          const robustPath = buildRobustPath(element);
          if (robustPath && robustPath !== element.tagName.toLowerCase()) {
            selectors.push(robustPath);
          }
          
          // 6. FALLBACK: Tag with specific attributes
          let tagSelector = element.tagName.toLowerCase();
          if (element.type && ['INPUT', 'BUTTON'].includes(element.tagName)) {
            tagSelector += \`[type="\${element.type}"]\`;
          }
          if (element.placeholder) {
            tagSelector += \`[placeholder="\${element.placeholder}"]\`;
          }
          if (tagSelector !== element.tagName.toLowerCase()) {
            selectors.push(tagSelector);
          }
          
          return selectors.length > 0 ? selectors : [element.tagName.toLowerCase()];
        }
        
        // Get comprehensive element information
        function getElementInfo(element) {
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
          
          const selectors = generateRobustSelectors(element);
          
          console.log(\`🎯 Generated \${selectors.length} selectors for \${element.tagName}:\`, selectors);
          
          return {
            tagName: element.tagName,
            textContent: element.textContent ? element.textContent.trim().substring(0, 100) : '',
            selectors: selectors,
            attributes: Array.from(element.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {}),
            boundingRect: {
              x: rect.left + scrollLeft,
              y: rect.top + scrollTop,
              width: rect.width,
              height: rect.height
            },
            innerText: element.innerText ? element.innerText.substring(0, 200) : '',
            href: element.href || null,
            src: element.src || null,
            value: element.value || null,
            placeholder: element.placeholder || null,
            title: element.title || null,
            role: element.getAttribute('role') || null,
            ariaLabel: element.getAttribute('aria-label') || null
          };
        }
        
        // Update highlight position
        function updateHighlight(element) {
          if (!overlay || !element) return;
          
          const rect = element.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
          
          overlay.style.display = 'block';
          overlay.style.left = (rect.left + scrollLeft) + 'px';
          overlay.style.top = (rect.top + scrollTop) + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          
          // Show element info tooltip
          const info = document.getElementById('element-info-tooltip') || document.createElement('div');
          info.id = 'element-info-tooltip';
          info.style.cssText = \`
            position: absolute;
            background: #1F2937;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            pointer-events: none;
          \`;
          
          const tagName = element.tagName.toLowerCase();
          const text = element.textContent ? element.textContent.trim().substring(0, 50) : '';
          const id = element.id ? \`#\${element.id}\` : '';
          const classes = element.className && typeof element.className === 'string' 
            ? '.' + element.className.trim().split(/\\s+/).join('.') : '';
          
          info.innerHTML = \`
            <div style="font-weight: bold; color: #60A5FA;">\${tagName}\${id}\${classes}</div>
            \${text ? \`<div style="margin-top: 4px; opacity: 0.9;">\${text}...</div>\` : ''}
          \`;
          
          // Position tooltip above element
          info.style.left = (rect.left + scrollLeft) + 'px';
          info.style.top = (rect.top + scrollTop - 60) + 'px';
          
          if (!info.parentNode) {
            document.body.appendChild(info);
          }
        }
        
        // Hide highlight
        function hideHighlight() {
          if (overlay) overlay.style.display = 'none';
          const tooltip = document.getElementById('element-info-tooltip');
          if (tooltip) tooltip.remove();
        }
        
        // Mouse move handler
        function handleMouseMove(e) {
          if (!isHighlighting) return;
          
          const element = e.target;
          if (!element || element === document.body || element === document.documentElement) {
            hideHighlight();
            return;
          }
          
          // Skip our own overlay elements
          if (element.id === 'element-picker-overlay' || element.id === 'element-info-tooltip') {
            return;
          }
          
          highlightedElement = element;
          updateHighlight(element);
        }
        
        // ENHANCED: Click handler with better error handling and feedback
        function handleClick(e) {
          if (!isHighlighting || !highlightedElement) {
            console.log('🔍 Click ignored: isHighlighting=', isHighlighting, 'highlightedElement=', highlightedElement);
            return;
          }
          
          e.preventDefault();
          e.stopPropagation();
          
          console.log('🎯 Element clicked!', highlightedElement.tagName, highlightedElement);
          
          try {
            const elementInfo = getElementInfo(highlightedElement);
            console.log('📋 Element info generated:', elementInfo);
            
            // Send element info to parent window
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              data: elementInfo
            }, '*');
            
            console.log('📤 Message sent to parent window');
            
            // Enhanced visual feedback
            const originalBorder = highlightedElement.style.border;
            const originalBackground = highlightedElement.style.backgroundColor;
            
            highlightedElement.style.border = '3px solid #10B981';
            highlightedElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.style.cssText = \`
              position: fixed;
              top: 20px;
              right: 20px;
              background: #10B981;
              color: white;
              padding: 12px 16px;
              border-radius: 8px;
              font-size: 14px;
              z-index: 1000001;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              animation: slideIn 0.3s ease-out;
            \`;
            successMessage.innerHTML = '✅ Element selected successfully!';
            document.body.appendChild(successMessage);
            
            setTimeout(() => {
              if (highlightedElement) {
                highlightedElement.style.border = originalBorder;
                highlightedElement.style.backgroundColor = originalBackground;
              }
              if (successMessage.parentNode) {
                successMessage.remove();
              }
            }, 1000);
            
          } catch (error) {
            console.error('❌ Error processing element selection:', error);
            
            // Show error message
            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = \`
              position: fixed;
              top: 20px;
              right: 20px;
              background: #EF4444;
              color: white;
              padding: 12px 16px;
              border-radius: 8px;
              font-size: 14px;
              z-index: 1000001;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            \`;
            errorMessage.innerHTML = '❌ Failed to select element';
            document.body.appendChild(errorMessage);
            
            setTimeout(() => {
              if (errorMessage.parentNode) {
                errorMessage.remove();
              }
            }, 3000);
          }
        }
        
        // Cleanup function
        function cleanup() {
          hideHighlight();
          if (overlay) overlay.remove();
          const tooltip = document.getElementById('element-info-tooltip');
          if (tooltip) tooltip.remove();
          
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('click', handleClick);
          document.removeEventListener('keydown', handleKeyDown);
        }
        
        // Keyboard handler
        function handleKeyDown(e) {
          if (e.key === 'Escape') {
            cleanup();
            window.parent.postMessage({ type: 'PICKING_CANCELLED' }, '*');
          }
        }
        
        // Initialize
        createOverlay();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        
        // Listen for messages from parent
        window.addEventListener('message', function(e) {
          if (e.data.type === 'STOP_PICKING') {
            isHighlighting = false;
            cleanup();
          } else if (e.data.type === 'START_PICKING') {
            isHighlighting = true;
            createOverlay();
          }
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', cleanup);
        
        // Send ready message
        window.parent.postMessage({ type: 'PICKER_READY' }, '*');
      })();
    `;

    try {
      doc.head.appendChild(script);
      logger.debug('Element picker script injected successfully');
      logger.debug(`Script size: ${script.innerHTML.length} characters`);
    } catch (error) {
      logger.error('Failed to inject element picker script', error);
    }
  }, [isPickingMode]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      logger.debug('Received message from iframe', event.data);

      if (event.data.type === 'ELEMENT_SELECTED') {
        logger.info('Element selected from iframe', event.data.data);
        onElementSelected(event.data.data);
      } else if (event.data.type === 'PICKER_READY') {
        logger.debug('Element picker is ready in iframe');
      } else if (event.data.type === 'PICKING_CANCELLED') {
        logger.debug('Picking mode cancelled in iframe');
        setHighlight(prev => ({ ...prev, visible: false }));
      } else {
        logger.debug('Unknown message type from iframe:', event.data.type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected]);

  // Update picking mode
  useEffect(() => {
    logger.debug(`Picking mode changed to: ${isPickingMode}`);

    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      logger.warn('Cannot send picking mode update - iframe not available');
      return;
    }

    try {
      const message = {
        type: isPickingMode ? 'START_PICKING' : 'STOP_PICKING'
      };

      logger.debug('Sending message to iframe', message);
      iframe.contentWindow.postMessage(message, '*');

      // Also try to inject script if picking mode is enabled and iframe is loaded
      if (isPickingMode && iframe.contentDocument) {
        logger.debug('Re-injecting script due to picking mode activation');
        injectElementPickerScript(iframe.contentDocument);
      }

    } catch (error) {
      logger.error('Cannot send message to iframe', error);
    }
  }, [isPickingMode, injectElementPickerScript]);

  // Handle URL changes with timeout
  useEffect(() => {
    if (!url) return;

    // Clear any existing timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }

    setIsLoading(true);
    setLoadError(null);
    setHighlight({ x: 0, y: 0, width: 0, height: 0, visible: false });
    setIsCrossOrigin(false);

    // Set timeout for iframe loading
    const timeoutId = setTimeout(() => {
      logger.warn('Iframe load timeout reached for:', url);
      setIsLoading(false);
      
      // Check if this is a retry attempt
      if (retryCount < maxRetries) {
        setLoadError(`Loading timeout (${LOAD_TIMEOUT_MS/1000}s). This might be a slow website or connection issue.`);
      } else {
        setLoadError(`Loading timeout after ${maxRetries + 1} attempts. The website may be slow, blocking iframe embedding, or unreachable. Try a different page or check your connection.`);
      }
    }, LOAD_TIMEOUT_MS);

    setLoadTimeout(timeoutId);

    // Cleanup timeout on unmount or URL change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [url, retryCount, maxRetries, LOAD_TIMEOUT_MS, handleRetry]);

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
    <div className={`relative ${className}`} ref={overlayRef}>
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
            <p className="text-gray-600">Loading website...</p>
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
            
            {/* Retry and dismiss buttons */}
            <div className="flex items-center justify-center space-x-3 mb-4">
              {retryCount < maxRetries && (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Retry ({maxRetries - retryCount} attempts left)</span>
                </button>
              )}
              <button
                onClick={() => setLoadError(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
            
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <div className="font-medium mb-1">Common solutions:</div>
              <ul className="text-left space-y-1">
                <li>• Check if the URL is correct and accessible</li>
                <li>• The site may not allow iframe embedding</li>
                <li>• Try using a different page on the same site</li>
                <li>• Some sites block embedding for security reasons</li>
                <li>• Check your internet connection</li>
                <li>• Try refreshing or waiting a moment</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Picking mode indicator */}
      {isPickingMode && !isLoading && !loadError && (
        <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg z-20 flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">🎯 Click any element to select</span>
        </div>
      )}


      {/* Cross-origin click overlay */}
      {isCrossOrigin && isPickingMode && !isLoading && !loadError && (
        <div 
          className="absolute inset-0 z-30 cursor-crosshair"
          onClick={handleCrossOriginClick}
          style={{
            background: 'rgba(255, 165, 0, 0.1)', // Subtle orange tint
            backdropFilter: 'blur(0.5px)'
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
              🎯 Click anywhere to detect elements
            </div>
          </div>
        </div>
      )}

      {/* Main iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-full border-0"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        title="Website preview for element selection"
        style={{
          background: 'white',
          minHeight: '600px'
        }}
      />
    </div>
  );
}