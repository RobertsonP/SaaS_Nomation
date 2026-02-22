import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { projectsAPI } from '../lib/api';
import { useNotification } from './NotificationContext';

export interface DiscoveryState {
  projectId: string;
  projectName: string;
  rootUrl: string;
  status: 'pending' | 'discovering' | 'complete' | 'failed';
  phase: string;
  pagesFound: number;
  maxPages: number;
  currentUrl?: string;
  discoveredUrls: string[];
  result?: {
    pages: any[];
    relationships: any[];
  };
  error?: string;
}

interface DiscoveryContextType {
  activeDiscovery: DiscoveryState | null;
  isMinimized: boolean;
  startBackgroundDiscovery: (
    projectId: string,
    projectName: string,
    rootUrl: string,
    options?: { maxDepth?: number; maxPages?: number; useSitemap?: boolean; authFlowId?: string }
  ) => void;
  minimizeDiscovery: () => void;
  restoreDiscovery: () => void;
  clearDiscovery: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [activeDiscovery, setActiveDiscovery] = useState<DiscoveryState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<number>(2000);
  const errorCountRef = useRef<number>(0);
  const { showSuccess, showError, showInfo } = useNotification();

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Progress polling — runs alongside the main API call
  const startPolling = useCallback((projectId: string) => {
    pollIntervalRef.current = 2000;
    errorCountRef.current = 0;

    const poll = async () => {
      try {
        const progressData = await projectsAPI.getDiscoveryProgress(projectId);

        if (progressData) {
          pollIntervalRef.current = 2000;
          errorCountRef.current = 0;

          setActiveDiscovery(prev => {
            if (!prev || prev.projectId !== projectId) return prev;
            // Don't overwrite 'complete' or 'failed' states set by the main API call
            if (prev.status === 'complete' || prev.status === 'failed') return prev;
            return {
              ...prev,
              phase: progressData.phase || prev.phase,
              pagesFound: progressData.discoveredUrls ?? prev.pagesFound,
              discoveredUrls: progressData.urls || prev.discoveredUrls,
              // Only update status from progress if still discovering
              ...(progressData.status === 'complete' || progressData.status === 'failed'
                ? {} // Let the main API call handle final state
                : { status: progressData.status }),
            };
          });

          // Stop polling if progress says complete/failed (main API will finalize)
          if (progressData.status === 'complete' || progressData.status === 'failed') {
            return; // Don't schedule another poll
          }
        }
      } catch {
        errorCountRef.current += 1;
        pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.5, 15000);

        if (errorCountRef.current >= 15) {
          return; // Stop polling after too many errors
        }
      }

      // Schedule next poll
      pollRef.current = setTimeout(poll, pollIntervalRef.current);
    };

    // Start first poll after a short delay (give backend time to initialize)
    pollRef.current = setTimeout(poll, 1500);
  }, []);

  const startBackgroundDiscovery = useCallback((
    projectId: string,
    projectName: string,
    rootUrl: string,
    options?: { maxDepth?: number; maxPages?: number; useSitemap?: boolean; authFlowId?: string }
  ) => {
    // Clear any existing poll
    stopPolling();

    // Initialize discovery state
    setActiveDiscovery({
      projectId,
      projectName,
      rootUrl,
      status: 'discovering',
      phase: 'initialization',
      pagesFound: 0,
      maxPages: options?.maxPages || 50,
      currentUrl: rootUrl,
      discoveredUrls: [],
    });

    // Don't minimize — modal stays open
    setIsMinimized(false);

    // Start progress polling alongside the API call
    startPolling(projectId);

    // Fire the main discovery API call (long-running)
    projectsAPI.startDiscovery(projectId, rootUrl, options)
      .then((result) => {
        stopPolling();
        setActiveDiscovery(prev => {
          if (!prev || prev.projectId !== projectId) return prev;
          return {
            ...prev,
            status: 'complete',
            phase: 'complete',
            pagesFound: result.pages?.length || 0,
            result,
          };
        });
        showSuccess('Discovery Complete', `Found ${result.pages?.length || 0} pages`);
      })
      .catch((err: any) => {
        stopPolling();
        const errorMessage = err?.response?.data?.message || err?.message || 'Discovery failed';
        setActiveDiscovery(prev => {
          if (!prev || prev.projectId !== projectId) return prev;
          return {
            ...prev,
            status: 'failed',
            error: errorMessage,
          };
        });
        showError('Discovery Failed', errorMessage);
      });
  }, [stopPolling, startPolling, showSuccess, showError]);

  const minimizeDiscovery = useCallback(() => {
    setIsMinimized(true);
    if (activeDiscovery?.status === 'discovering') {
      showInfo('Discovery Running', 'Discovery continues in the background.');
    }
  }, [activeDiscovery, showInfo]);

  const restoreDiscovery = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const clearDiscovery = useCallback(() => {
    stopPolling();
    setActiveDiscovery(null);
    setIsMinimized(false);
  }, [stopPolling]);

  return (
    <DiscoveryContext.Provider
      value={{
        activeDiscovery,
        isMinimized,
        startBackgroundDiscovery,
        minimizeDiscovery,
        restoreDiscovery,
        clearDiscovery,
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscoveryContext() {
  const context = useContext(DiscoveryContext);
  if (context === undefined) {
    throw new Error('useDiscoveryContext must be used within a DiscoveryProvider');
  }
  return context;
}
