import { useState, useEffect } from 'react';
import { browserAPI } from '../../lib/api';

interface SessionBrowserPreviewProps {
  sessionToken: string | null;
  className?: string;
}

export function SessionBrowserPreview({ 
  sessionToken, 
  className = '' 
}: SessionBrowserPreviewProps) {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [sessionView, setSessionView] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) {
      setSessionInfo(null);
      setSessionView(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Fetch both session info and live view
    const fetchSessionData = async () => {
      try {
        const [infoResponse, viewResponse] = await Promise.all([
          browserAPI.getSessionInfo(sessionToken),
          browserAPI.getSessionView(sessionToken)
        ]);
        
        setSessionInfo(infoResponse.session);
        setSessionView(viewResponse);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch session data:', err);
        setError('Failed to connect to browser session');
        setIsLoading(false);
      }
    };

    fetchSessionData();

    // Poll for session updates every 2 seconds during execution
    const interval = setInterval(fetchSessionData, 2000);
    
    return () => clearInterval(interval);
  }, [sessionToken]);

  if (!sessionToken) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🌐</div>
          <p>No active browser session</p>
          <p className="text-sm mt-1">Start test execution to view live browser</p>
        </div>
      </div>
    );
  }

  if (isLoading && !sessionInfo) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-gray-600">Connecting to browser session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-red-600">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Session Connection Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!sessionView?.currentUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🔄</div>
          <p>Waiting for navigation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Session status indicator */}
      <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg z-20 flex items-center space-x-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">
          🎭 Live Session: {sessionToken.slice(-8)}
        </span>
      </div>

      {/* Authentication status */}
      {sessionInfo.isAuthenticated && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded text-xs z-20">
          🔐 Authenticated
        </div>
      )}

      {/* Main iframe showing live session view */}
      <iframe
        src={sessionView.viewUrl}
        className="w-full h-full border-0"
        title="Live Browser Session"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        style={{
          background: 'white',
          minHeight: '600px',
          width: '100%',
          height: '100%',
          transform: 'scale(0.75)', // Zoom out to show desktop view in smaller iframe
          transformOrigin: 'top left',
          border: 'none'
        }}
      />
    </div>
  );
}