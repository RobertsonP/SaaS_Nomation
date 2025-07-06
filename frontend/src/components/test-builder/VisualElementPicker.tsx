import { useState } from 'react'

interface VisualElementPickerProps {
  projectUrl: string
  onElementSelect: (selector: string, description: string) => void
  onClose: () => void
}

export function VisualElementPicker({ projectUrl, onElementSelect, onClose }: VisualElementPickerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openElementPicker = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Create a new browser window/tab for element picking
      const pickerWindow = window.open(
        projectUrl,
        'element-picker',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      )

      if (!pickerWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      // Wait for the window to load
      pickerWindow.addEventListener('load', () => {
        // Inject our element picker script
        const script = pickerWindow.document.createElement('script')
        script.textContent = getElementPickerScript()
        pickerWindow.document.head.appendChild(script)

        // Inject CSS for highlighting
        const style = pickerWindow.document.createElement('style')
        style.textContent = getElementPickerCSS()
        pickerWindow.document.head.appendChild(style)

        // Listen for element selection
        window.addEventListener('message', handleElementSelected)
      })

      // Handle window close
      const checkClosed = setInterval(() => {
        if (pickerWindow.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleElementSelected)
          setIsLoading(false)
        }
      }, 1000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open element picker')
      setIsLoading(false)
    }
  }

  const handleElementSelected = (event: MessageEvent) => {
    if (event.data.type === 'ELEMENT_SELECTED') {
      const { selector, description } = event.data
      onElementSelect(selector, description)
      window.removeEventListener('message', handleElementSelected)
      setIsLoading(false)
      onClose()
    }
  }

  const getElementPickerScript = () => {
    return `
      (function() {
        let isPickerActive = true;
        let highlightedElement = null;
        let overlay = null;

        // Create overlay div for highlighting
        function createOverlay() {
          overlay = document.createElement('div');
          overlay.id = 'nomation-element-overlay';
          overlay.style.position = 'absolute';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '999999';
          overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
          overlay.style.border = '2px solid #3B82F6';
          overlay.style.borderRadius = '4px';
          overlay.style.transition = 'all 0.1s ease';
          document.body.appendChild(overlay);
        }

        // Generate CSS selector for element
        function generateSelector(element) {
          // Priority 1: data-testid
          if (element.getAttribute('data-testid')) {
            return '[data-testid="' + element.getAttribute('data-testid') + '"]';
          }
          
          // Priority 2: id
          if (element.id) {
            return '#' + element.id;
          }
          
          // Priority 3: aria-label
          if (element.getAttribute('aria-label')) {
            return '[aria-label="' + element.getAttribute('aria-label') + '"]';
          }
          
          // Priority 4: name (for inputs)
          if (element.tagName === 'INPUT' && element.getAttribute('name')) {
            return 'input[name="' + element.getAttribute('name') + '"]';
          }
          
          // Priority 5: text content for buttons/links
          const text = element.textContent?.trim();
          if (text && (element.tagName === 'BUTTON' || element.tagName === 'A')) {
            const escapedText = text.replace(/"/g, '\\\\"');
            return element.tagName.toLowerCase() + ':has-text("' + escapedText + '")';
          }
          
          // Priority 6: class + tag (avoid utility classes)
          if (element.className) {
            const classes = element.className.split(' ').filter(cls => 
              cls && !cls.includes('text-') && !cls.includes('bg-') && 
              !cls.includes('p-') && !cls.includes('m-') && cls.length > 2
            );
            if (classes.length > 0) {
              return element.tagName.toLowerCase() + '.' + classes[0];
            }
          }
          
          // Fallback: tag name
          return element.tagName.toLowerCase();
        }

        // Generate description for element
        function generateDescription(element) {
          // Use aria-label if available
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
          
          // Use text content
          const text = element.textContent?.trim();
          if (text && text.length < 50) {
            return text;
          }
          
          // Use alt text for images
          if (element.tagName === 'IMG' && element.getAttribute('alt')) {
            return element.getAttribute('alt');
          }
          
          // Use placeholder for inputs
          if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
            return element.getAttribute('placeholder');
          }
          
          // Use title
          if (element.getAttribute('title')) {
            return element.getAttribute('title');
          }
          
          // Fallback based on element type
          const tagName = element.tagName.toLowerCase();
          if (tagName === 'button') return 'Button';
          if (tagName === 'input') return element.getAttribute('type') + ' input' || 'Input field';
          if (tagName === 'a') return 'Link';
          if (tagName === 'form') return 'Form';
          
          return tagName + ' element';
        }

        // Update overlay position
        function updateOverlay(element) {
          if (!overlay || !element) return;
          
          const rect = element.getBoundingClientRect();
          overlay.style.left = (rect.left + window.scrollX) + 'px';
          overlay.style.top = (rect.top + window.scrollY) + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.display = 'block';
        }

        // Hide overlay
        function hideOverlay() {
          if (overlay) {
            overlay.style.display = 'none';
          }
        }

        // Check if element is interactive
        function isInteractiveElement(element) {
          const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM'];
          const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'];
          
          return interactiveTags.includes(element.tagName) ||
                 interactiveRoles.includes(element.getAttribute('role')) ||
                 element.hasAttribute('onclick') ||
                 element.hasAttribute('tabindex');
        }

        // Mouse move handler
        function handleMouseMove(event) {
          if (!isPickerActive) return;
          
          const element = document.elementFromPoint(event.clientX, event.clientY);
          if (!element || element === highlightedElement) return;
          
          // Skip if not an interactive element
          if (!isInteractiveElement(element)) {
            hideOverlay();
            highlightedElement = null;
            return;
          }
          
          highlightedElement = element;
          updateOverlay(element);
        }

        // Click handler
        function handleClick(event) {
          if (!isPickerActive || !highlightedElement) return;
          
          event.preventDefault();
          event.stopPropagation();
          
          const selector = generateSelector(highlightedElement);
          const description = generateDescription(highlightedElement);
          
          // Send message back to parent window
          window.parent.postMessage({
            type: 'ELEMENT_SELECTED',
            selector: selector,
            description: description
          }, '*');
          
          cleanup();
        }

        // Escape key handler
        function handleKeyDown(event) {
          if (event.key === 'Escape') {
            cleanup();
            window.close();
          }
        }

        // Cleanup function
        function cleanup() {
          isPickerActive = false;
          if (overlay) {
            overlay.remove();
          }
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('click', handleClick);
          document.removeEventListener('keydown', handleKeyDown);
        }

        // Initialize
        createOverlay();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleClick);
        document.addEventListener('keydown', handleKeyDown);

        // Show instructions
        const instructions = document.createElement('div');
        instructions.id = 'nomation-instructions';
        instructions.innerHTML = \`
          <div style="position: fixed; top: 20px; left: 20px; background: #1F2937; color: white; padding: 12px 16px; border-radius: 8px; z-index: 1000000; font-family: system-ui; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <div style="font-weight: 600; margin-bottom: 8px;">🎯 Nomation Element Picker</div>
            <div style="opacity: 0.9; line-height: 1.4;">
              • Hover over interactive elements to highlight them<br>
              • Click to select an element<br>
              • Press <kbd style="background: #374151; padding: 2px 6px; border-radius: 3px; font-size: 12px;">Esc</kbd> to cancel
            </div>
          </div>
        \`;
        document.body.appendChild(instructions);

        // Auto-hide instructions after 5 seconds
        setTimeout(() => {
          if (instructions) {
            instructions.style.opacity = '0';
            instructions.style.transition = 'opacity 0.3s ease';
            setTimeout(() => instructions.remove(), 300);
          }
        }, 5000);
      })();
    `
  }

  const getElementPickerCSS = () => {
    return `
      #nomation-element-overlay {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
      }
      
      #nomation-instructions kbd {
        background: #374151 !important;
        padding: 2px 6px !important;
        border-radius: 3px !important;
        font-size: 12px !important;
        color: #E5E7EB !important;
      }
    `
  }

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🎯 Visual Element Picker</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Click elements directly on your website to automatically generate selectors
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close element picker"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-white rounded-md p-3 border border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-1">Target Website:</div>
          <div className="text-sm text-blue-600 font-mono break-all">{projectUrl}</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-amber-700">
              <div className="font-medium mb-1">How it works:</div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Click "Start Element Picker" to open your website</li>
                <li>Hover over interactive elements to highlight them</li>
                <li>Click the element you want to select</li>
                <li>The selector will be automatically generated and added to your test</li>
              </ol>
            </div>
          </div>
        </div>

        <button
          onClick={openElementPicker}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            isLoading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:transform active:scale-95'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Opening Element Picker...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              🎯 Start Element Picker
            </div>
          )}
        </button>
      </div>
    </div>
  )
}