import { useState, useEffect, useCallback } from 'react';
import { projectsAPI } from '../../lib/api';

export interface SiteMapNodeData {
  id: string;
  url: string;
  title: string;
  analyzed: boolean;
  verified: boolean;
  requiresAuth: boolean;
  pageType?: string;
  discovered: boolean;
  depth?: number;
  screenshot?: string;  // Base64 thumbnail image
}

export interface SiteMapEdgeData {
  id: string;
  source: string;
  target: string;
  linkText?: string;
  linkType: string;
}

export interface SiteMapData {
  nodes: SiteMapNodeData[];
  edges: SiteMapEdgeData[];
}

export interface DiscoveryProgress {
  status: 'pending' | 'discovering' | 'complete' | 'failed';
  phase: string;
  discoveredUrls: number;
  totalUrls: number;
  message: string;
}

export function useSiteMapData(projectId: string | undefined) {
  const [data, setData] = useState<SiteMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSiteMap = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await projectsAPI.getSiteMap(projectId);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch site map');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSiteMap();
  }, [fetchSiteMap]);

  return {
    data,
    loading,
    error,
    refetch: fetchSiteMap,
  };
}

export function useDiscovery(projectId: string | undefined) {
  const [progress, setProgress] = useState<DiscoveryProgress | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDiscovery = useCallback(async (
    rootUrl: string,
    options?: {
      maxDepth?: number;
      maxPages?: number;
      useSitemap?: boolean;
      authFlowId?: string;  // Optional: use authentication for discovering protected pages
    }
  ) => {
    if (!projectId) return null;

    setDiscovering(true);
    setError(null);

    try {
      const result = await projectsAPI.startDiscovery(projectId, rootUrl, options);
      setProgress({
        status: 'complete',
        phase: 'complete',
        discoveredUrls: result.pages?.length || 0,
        totalUrls: result.pages?.length || 0,
        message: 'Discovery complete',
      });
      return result;
    } catch (err) {
      // Extract actual error message from axios response or fallback
      const errorMessage = (err as any)?.response?.data?.message
        || (err instanceof Error ? err.message : 'Discovery failed');
      setError(errorMessage);
      setProgress({
        status: 'failed',
        phase: 'error',
        discoveredUrls: 0,
        totalUrls: 0,
        message: errorMessage,
      });
      return null;
    } finally {
      setDiscovering(false);
    }
  }, [projectId]);

  const checkProgress = useCallback(async () => {
    if (!projectId) return null;

    try {
      const response = await projectsAPI.getDiscoveryProgress(projectId);
      setProgress(response);
      return response;
    } catch (err) {
      // Re-throw to allow caller to implement backoff
      // 429 errors and other API errors should trigger backoff in the caller
      throw err;
    }
  }, [projectId]);

  const selectPages = useCallback(async (urlIds: string[]) => {
    if (!projectId) return null;

    try {
      return await projectsAPI.selectPagesForAnalysis(projectId, urlIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select pages');
      return null;
    }
  }, [projectId]);

  return {
    progress,
    discovering,
    error,
    startDiscovery,
    checkProgress,
    selectPages,
  };
}

export default useSiteMapData;
