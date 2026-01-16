import { useState, useEffect, useRef, useCallback } from 'react';
import { TestStep } from '../../types/test.types';
import { createLogger } from '../../lib/logger';

const logger = createLogger('BrowserExecutionView');

interface BrowserExecutionViewProps {
  url: string;
  currentStep?: TestStep;
  isExecuting?: boolean;
  executionResult?: any;
  className?: string;
}

export function BrowserExecutionView({
  url,
  currentStep,
  isExecuting = false,
  executionResult,
  className = ''
}: BrowserExecutionViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Handle iframe load events
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setLoadError(null);
    
    // Inject step highlighting script when a step is being executed
    if (currentStep && isExecuting) {
      injectStepHighlightScript(currentStep);
    }
  }, [currentStep, isExecuting]);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setLoadError('Failed to load website for execution viewing');
  }, []);

  // Inject script to highlight the current executing step
  const injectStepHighlightScript = useCallback((step: TestStep) => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;

      const iframeDoc = iframe.contentDocument;
      
      // Remove existing highlight
      const existingHighlight = iframeDoc.getElementById('execution-step-highlight');
      if (existingHighlight) existingHighlight.remove();

      // Create highlight script
      const script = iframeDoc.createElement('script');
      script.id = 'execution-step-highlight';
      script.innerHTML = `
        (function() {
          // Remove previous highlights
          const prevHighlights = document.querySelectorAll('.execution-highlight');
          prevHighlights.forEach(el => el.classList.remove('execution-highlight'));
          
          // Remove previous styles
          const prevStyle = document.getElementById('execution-highlight-style');
          if (prevStyle) prevStyle.remove();
          
          // Add highlight styles
          const style = document.createElement('style');
          style.id = 'execution-highlight-style';
          style.textContent = \`
            .execution-highlight {
              outline: 3px solid #10B981 !important;
              outline-offset: 2px !important;
              background: rgba(16, 185, 129, 0.1) !important;
              animation: executionPulse 2s infinite !important;
            }
            
            @keyframes executionPulse {
              0%, 100% { outline-color: #10B981; }
              50% { outline-color: #34D399; }
            }
            
            .execution-highlight::after {
              content: "▶️ ${step.type.toUpperCase()}";
              position: absolute;
              top: -30px;
              left: 0;
              background: #10B981;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              z-index: 10000;
            }
          \`;
          document.head.appendChild(style);
          
          // Find and highlight the target element
          try {
            const targetElement = document.querySelector('${step.selector}');
            if (targetElement) {
              targetElement.classList.add('execution-highlight');
              targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              console.log('🎯 Highlighted execution step:', '${step.description}');
            } else {
              console.warn('⚠️ Element not found for highlighting:', '${step.selector}');
            }
          } catch (error) {
            console.error('❌ Error highlighting element:', error);
          }
        })();
      `;
      
      iframeDoc.head.appendChild(script);
      logger.debug('Injected step highlight script for', step.description);

    } catch (error) {
      logger.warn('Cannot inject highlight script into iframe', error);
    }
  }, []);

  // Update highlighting when current step changes
  useEffect(() => {
    if (currentStep && isExecuting && !isLoading && !loadError) {
      // Small delay to ensure iframe is ready
      setTimeout(() => {
        injectStepHighlightScript(currentStep);
      }, 500);
    }
  }, [currentStep, isExecuting, isLoading, loadError, injectStepHighlightScript]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🌐</div>
          <p>No URL provided for execution</p>
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
            <p className="text-gray-600">Loading execution view...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
          <div className="text-center max-w-md p-6">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Cannot Load Execution View</h3>
            <p className="text-red-700">{loadError}</p>
          </div>
        </div>
      )}

      {/* Current step indicator */}
      {currentStep && isExecuting && !isLoading && !loadError && (
        <div className="absolute top-4 left-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-20 flex items-center space-x-2">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            Executing: {currentStep.type.toUpperCase()} on {currentStep.selector}
          </span>
        </div>
      )}

      {/* Execution result indicator */}
      {executionResult && !isExecuting && (
        <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-20 flex items-center space-x-2 ${
          executionResult.success 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <span className="text-sm font-medium">
            {executionResult.success ? '✅ Success' : '❌ Failed'}
          </span>
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
        title="Live execution view"
        style={{
          background: 'white',
          minHeight: '400px'
        }}
      />
    </div>
  );
}