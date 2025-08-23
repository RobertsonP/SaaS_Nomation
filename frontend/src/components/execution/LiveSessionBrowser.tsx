import { useState, useEffect, useRef } from 'react';
import { browserAPI } from '../../lib/api';

interface LiveSessionBrowserProps {
  sessionToken: string;
  isExecuting: boolean;
  currentStep?: {
    description: string;
    selector: string;
  };
  className?: string;
}

export function LiveSessionBrowser({ sessionToken, isExecuting, currentStep, className }: LiveSessionBrowserProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureScreenshot = async () => {
    try {
      setError(null);
      const response = await browserAPI.getSessionScreenshot(sessionToken);
      setScreenshot(response.screenshot);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Failed to capture screenshot:', error);
      setError(error.message || 'Failed to capture screenshot');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial screenshot
    captureScreenshot();

    // Set up polling for live updates
    if (isExecuting) {
      // During execution, poll every 500ms for real-time updates
      intervalRef.current = setInterval(captureScreenshot, 500);
    } else {
      // When not executing, poll every 2 seconds for status updates
      intervalRef.current = setInterval(captureScreenshot, 2000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sessionToken, isExecuting]);

  if (isLoading && !screenshot) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">⏳</div>
          <p>Loading live browser view...</p>
        </div>
      </div>
    );
  }

  if (error && !screenshot) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center text-red-500">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-sm">Failed to load browser view</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
          <button
            onClick={captureScreenshot}
            className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative bg-gray-100 flex items-center justify-center`}>
      {/* Desktop Browser Frame */}
      <div className="relative w-full h-full flex items-center justify-center">
        {screenshot ? (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={screenshot}
              alt="Live browser session"
              className="max-w-full max-h-full object-contain border-2 border-gray-300 rounded-lg shadow-2xl"
              style={{
                minHeight: '500px',
                backgroundColor: 'white',
                maxWidth: '95%',
                maxHeight: '95%'
              }}
            />
            
            {/* Desktop Resolution Badge */}
            <div className="absolute top-6 right-6 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
              Desktop 1920×1080
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🌐</div>
            <p>Connecting to browser session...</p>
          </div>
        )}

        {/* Live Execution Indicator */}
        {isExecuting && (
          <div className="absolute top-6 left-6 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg flex items-center z-10">
            <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
            LIVE
          </div>
        )}

        {/* Current Step Indicator */}
        {currentStep && isExecuting && (
          <div className="absolute bottom-6 left-6 right-6 bg-blue-900 bg-opacity-95 text-white px-4 py-3 rounded-lg text-sm shadow-lg z-10">
            <div className="font-semibold mb-1">{currentStep.description}</div>
            <div className="text-xs text-blue-200 font-mono bg-blue-800 bg-opacity-50 px-2 py-1 rounded">
              {currentStep.selector}
            </div>
          </div>
        )}

        {/* Refresh Rate Indicator */}
        <div className="absolute top-6 right-20 bg-gray-800 bg-opacity-90 text-white px-3 py-1 rounded text-xs font-medium shadow z-10">
          {isExecuting ? '🔄 Real-time' : '🔄 Live'}
        </div>
      </div>
    </div>
  );
}