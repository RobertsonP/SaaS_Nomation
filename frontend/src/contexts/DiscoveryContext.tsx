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
    options?: { maxDepth?: number; maxPages?: number; useSitemap?: boolean }
  ) => Promise<void>;
  minimizeDiscovery: () => void;
  restoreDiscovery: () => void;
  clearDiscovery: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [activeDiscovery, setActiveDiscovery] = useState<DiscoveryState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<number>(3000);
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

  const pollProgress = useCallback(async (projectId: string) => {
    if (!activeDiscovery || activeDiscovery.projectId !== projectId) return;

    try {
      const progressData = await projectsAPI.getDiscoveryProgress(projectId);

      if (progressData) {
        // Reset backoff on success
        pollIntervalRef.current = 3000;
        errorCountRef.current = 0;

        setActiveDiscovery(prev => {
          if (!prev || prev.projectId !== projectId) return prev;
          return {
            ...prev,
            phase: progressData.phase,
            pagesFound: progressData.discoveredUrls,
            discoveredUrls: progressData.urls || prev.discoveredUrls,
            status: progressData.status,
          };
        });

        // Check if discovery is complete
        if (progressData.status === 'complete' || progressData.status === 'failed') {
          if (pollRef.current) {
            clearTimeout(pollRef.current);
            pollRef.current = null;
          }

          if (progressData.status === 'complete') {
            showSuccess(
              'Discovery Complete',
              `Found ${progressData.discoveredUrls} pages on ${activeDiscovery.rootUrl}`
            );
          } else {
            showError('Discovery Failed', progressData.message || 'An error occurred');
          }
          return;
        }
      }
    } catch {
      // Exponential backoff
      errorCountRef.current += 1;
      pollIntervalRef.current = Math.min(pollIntervalRef.current * 2, 30000);

      // Stop after too many failures
      if (errorCountRef.current >= 10) {
        setActiveDiscovery(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'failed',
            error: 'Lost connection to server',
          };
        });
        showError('Discovery Error', 'Lost connection to the server');
        return;
      }
    }

    // Schedule next poll
    pollRef.current = setTimeout(() => pollProgress(projectId), pollIntervalRef.current);
  }, [activeDiscovery, showSuccess, showError]);

  const startBackgroundDiscovery = useCallback(async (
    projectId: string,
    projectName: string,
    rootUrl: string,
    options?: { maxDepth?: number; maxPages?: number; useSitemap?: boolean }
  ) => {
    // Clear any existing poll
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }

    // Reset polling state
    pollIntervalRef.current = 3000;
    errorCountRef.current = 0;

    // Initialize discovery state
    setActiveDiscovery({
      projectId,
      projectName,
      rootUrl,
      status: 'discovering',
      phase: 'initialization',
      pagesFound: 0,
      discoveredUrls: [],
    });
    setIsMinimized(false);

    try {
      const result = await projectsAPI.startDiscovery(projectId, rootUrl, options);

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

      showSuccess(
        'Discovery Complete',
        `Found ${result.pages?.length || 0} pages`
      );
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Discovery failed';

      setActiveDiscovery(prev => {
        if (!prev || prev.projectId !== projectId) return prev;
        return {
          ...prev,
          status: 'failed',
          error: errorMessage,
        };
      });

      showError('Discovery Failed', errorMessage);
    }
  }, [showSuccess, showError]);

  const minimizeDiscovery = useCallback(() => {
    setIsMinimized(true);
    if (activeDiscovery?.status === 'discovering') {
      showInfo('Discovery Running', 'Discovery is running in the background. You\'ll be notified when complete.');
    }
  }, [activeDiscovery, showInfo]);

  const restoreDiscovery = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const clearDiscovery = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setActiveDiscovery(null);
    setIsMinimized(false);
  }, []);

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
