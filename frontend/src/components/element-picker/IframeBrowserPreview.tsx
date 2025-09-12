import { useState, useRef, useCallback, useEffect } from 'react';
import { ReliableSelectorGenerator } from './ReliableSelectorGenerator';

// Extend Window interface to include custom element picking functions
declare global {
  interface Window {
    enableElementPicking?: () => void;
    disableElementPicking?: () => void;
  }
}

interface IframeBrowserPreviewProps {
  url: string;
  isPickingMode: boolean;
  onElementSelected: (elementData: any) => void;
  onCrossOriginDetected?: (isCrossOrigin: boolean) => void;
  className?: string;
}

export function IframeBrowserPreview({
  url,
  isPickingMode,
  onElementSelected,
  onCrossOriginDetected,
  className = ''
}: IframeBrowserPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCrossOrigin, setIsCrossOrigin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Element picking script that will be injected into the iframe
  const elementPickerScript = `
    (function() {
      // Remove any existing element picker
      const existingPicker = document.querySelector('#element-picker-overlay');
      if (existingPicker) {
        existingPicker.remove();
      }

      let isPickingActive = false;
      let hoveredElement = null;
      let originalOutline = '';

      // Create overlay for visual feedback
      const overlay = document.createElement('div');
      overlay.id = 'element-picker-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '999999';
      document.body.appendChild(overlay);

      function generateOptimizedSelectors(element) {
        const selectors = [];
        
        // Strategy 1: data-testid (highest priority)
        if (element.getAttribute('data-testid')) {
          selectors.push('[data-testid="' + element.getAttribute('data-testid') + '"]');
        }
        
        // Strategy 2: ID selector
        if (element.id) {
          selectors.push('#' + element.id);
        }
        
        // Strategy 3: unique class combinations
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\\s+/).filter(c => 
            c && !c.match(/^(css-|sc-|emotion-)/)); // Filter out CSS-in-JS classes
          if (classes.length > 0) {
            selectors.push('.' + classes.join('.'));
            if (classes.length > 1) {
              selectors.push('.' + classes[0]); // First class as fallback
            }
          }
        }
        
        // Strategy 4: name attribute for form elements
        if (element.name) {
          selectors.push('[name="' + element.name + '"]');
        }
        
        // Strategy 5: aria-label
        if (element.getAttribute('aria-label')) {
          selectors.push('[aria-label="' + element.getAttribute('aria-label') + '"]');
        }
        
        // Strategy 6: role attribute
        if (element.getAttribute('role')) {
          selectors.push('[role="' + element.getAttribute('role') + '"]');
        }
        
        // Strategy 7: text-based selector for links and buttons
        if (element.tagName.toLowerCase() === 'a' && element.textContent.trim()) {
          selectors.push('a:contains("' + element.textContent.trim().substring(0, 50) + '")');
        } else if (element.tagName.toLowerCase() === 'button' && element.textContent.trim()) {
          selectors.push('button:contains("' + element.textContent.trim().substring(0, 50) + '")');
        }
        
        // Strategy 8: nth-child as last resort (less stable but works)
        if (element.parentElement) {
          const siblings = Array.from(element.parentElement.children);
          const index = siblings.indexOf(element) + 1;
          selectors.push(element.tagName.toLowerCase() + ':nth-child(' + index + ')');
        }
        
        // Strategy 9: XPath as ultimate fallback
        const xpath = getXPath(element);
        if (xpath) {
          selectors.push('xpath:' + xpath);
        }
        
        return selectors;
      }
      
      function getXPath(element) {
        if (!element || element === document.body) return '/html/body';
        
        const parts = [];
        while (element && element !== document.body) {
          let part = element.tagName.toLowerCase();
          const siblings = Array.from(element.parentElement?.children || [])
            .filter(el => el.tagName === element.tagName);
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            part += '[' + index + ']';
          }
          
          parts.unshift(part);
          element = element.parentElement;
        }
        
        return '/html/body/' + parts.join('/');
      }

      function getComputedStyles(element) {
        const styles = window.getComputedStyle(element);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          fontWeight: styles.fontWeight,
          display: styles.display,
          position: styles.position,
          width: styles.width,
          height: styles.height,
          padding: styles.padding,
          margin: styles.margin,
          border: styles.border,
          borderRadius: styles.borderRadius,
          boxShadow: styles.boxShadow,
          opacity: styles.opacity,
          visibility: styles.visibility,
          transform: styles.transform,
          cursor: styles.cursor,
          textAlign: styles.textAlign,
          backgroundImage: styles.backgroundImage,
          zIndex: styles.zIndex,
          overflow: styles.overflow,
          textDecoration: styles.textDecoration,
          lineHeight: styles.lineHeight,
          letterSpacing: styles.letterSpacing,
          // Quality indicators
          isVisible: styles.visibility !== 'hidden' && styles.display !== 'none' && styles.opacity !== '0',
          isStyled: styles.backgroundColor !== 'rgba(0, 0, 0, 0)' || styles.color !== 'rgb(0, 0, 0)' || styles.border !== '0px none rgb(0, 0, 0)',
          hasBackground: styles.backgroundColor !== 'rgba(0, 0, 0, 0)' || styles.backgroundImage !== 'none',
          hasText: !!element.textContent?.trim()
        };
      }

      function highlightElement(element) {
        if (hoveredElement && hoveredElement !== element) {
          hoveredElement.style.outline = originalOutline;
        }
        
        if (element) {
          originalOutline = element.style.outline;
          element.style.outline = '2px solid #10B981';
          element.style.outlineOffset = '2px';
          hoveredElement = element;
        }
      }

      function clearHighlight() {
        if (hoveredElement) {
          hoveredElement.style.outline = originalOutline;
          hoveredElement = null;
        }
      }

      // Mouse event handlers
      function handleMouseMove(e) {
        if (!isPickingActive) return;
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        if (element && element !== overlay) {
          highlightElement(element);
        }
      }

      function handleClick(e) {
        if (!isPickingActive) return;
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        if (!element || element === overlay) return;
        
        // Capture comprehensive element data
        const rect = element.getBoundingClientRect();
        const selectors = generateOptimizedSelectors(element);
        const computedStyles = getComputedStyles(element);
        
        // Collect all attributes
        const attributes = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          attributes[attr.name] = attr.value;
        }
        
        const elementData = {
          tagName: element.tagName.toLowerCase(),
          selectors: selectors,
          attributes: attributes,
          textContent: element.textContent?.trim() || '',
          innerText: element.innerText?.trim() || '',
          boundingRect: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          href: element.href || null,
          src: element.src || null,
          value: element.value || null,
          placeholder: element.placeholder || null,
          title: element.title || null,
          role: element.getAttribute('role') || null,
          ariaLabel: element.getAttribute('aria-label') || null,
          cssInfo: computedStyles,
          // Additional context for reliability
          parentTagName: element.parentElement?.tagName?.toLowerCase() || null,
          parentClasses: element.parentElement?.className || '',
          siblingIndex: element.parentElement ? 
            Array.from(element.parentElement.children).indexOf(element) : -1
        };
        
        // Send data to parent window
        window.parent.postMessage({
          type: 'elementSelected',
          data: elementData
        }, '*');
        
        clearHighlight();
      }

      // API to control picking mode
      window.enableElementPicking = function() {
        isPickingActive = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
        
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
      };

      window.disableElementPicking = function() {
        isPickingActive = false;
        clearHighlight();
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
      };
      
      // Let parent know the picker is ready
      window.parent.postMessage({
        type: 'pickerReady'
      }, '*');
    })();
  `;

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      // Try to access iframe content - will fail for cross-origin
      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDocument) {
        setIsCrossOrigin(false);
        onCrossOriginDetected?.(false);
        
        // Inject element picker script
        const script = iframeDocument.createElement('script');
        script.textContent = elementPickerScript;
        iframeDocument.head.appendChild(script);
        
        setIsLoading(false);
        setLoadError(null);
      } else {
        throw new Error('Cannot access iframe content');
      }
    } catch (error) {
      // Cross-origin - fall back to postMessage communication
      setIsCrossOrigin(true);
      onCrossOriginDetected?.(true);
      setIsLoading(false);
      setLoadError('This website blocks iframe embedding. Try using the direct element picker or a different URL.');
    }
  }, [onCrossOriginDetected, elementPickerScript]);

  // Handle iframe errors
  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setLoadError('Failed to load website. Please check the URL and try again.');
  }, []);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'elementSelected') {
        onElementSelected(event.data.data);
      } else if (event.data.type === 'pickerReady') {
        // Enable/disable picking mode when iframe is ready
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          if (isPickingMode) {
            iframe.contentWindow.postMessage({ type: 'enablePicking' }, '*');
          } else {
            iframe.contentWindow.postMessage({ type: 'disablePicking' }, '*');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected, isPickingMode]);

  // Update picking mode
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow && !isCrossOrigin) {
      try {
        if (isPickingMode) {
          iframe.contentWindow.enableElementPicking?.();
        } else {
          iframe.contentWindow.disableElementPicking?.();
        }
      } catch (error) {
        console.warn('Could not control picking mode:', error);
      }
    }
  }, [isPickingMode, isCrossOrigin]);

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
            <p className="text-gray-600">Loading website...</p>
            <p className="text-sm text-gray-500 mt-1">{new URL(url).hostname}</p>
          </div>
        </div>
      )}

      {/* Subtle error notification (not blocking) */}
      {loadError && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 border-l-4 border-yellow-400 p-3 z-20">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">{loadError}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setLoadError(null)}
                className="text-yellow-400 hover:text-yellow-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status indicators */}
      {!isLoading && !loadError && (
        <>
          <div className="absolute top-0 left-0 bg-green-600 text-white px-3 py-1 rounded-br-lg shadow-lg z-20 flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">Live Website</span>
          </div>
          
          {isPickingMode && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 rounded-bl-lg shadow-lg z-20 flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs font-medium">Click Elements to Select</span>
            </div>
          )}
        </>
      )}

      {/* Main iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        className="w-full h-full border-0"
        style={{
          minHeight: '600px',
          background: 'white'
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        title="Website Preview"
      />
    </div>
  );
}