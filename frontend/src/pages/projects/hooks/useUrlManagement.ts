import { useState, useCallback } from 'react';
import { projectsAPI } from '../../../lib/api';
import { createLogger } from '../../../lib/logger';

const logger = createLogger('useUrlManagement');

/**
 * Normalize URL by adding protocol if missing
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const localPatterns = [
    /^localhost(:\d+)?/i,
    /^127\.0\.0\.1(:\d+)?/,
    /^192\.168\.\d+\.\d+(:\d+)?/,
    /^10\.\d+\.\d+\.\d+(:\d+)?/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?/,
    /^0\.0\.0\.0(:\d+)?/,
  ];
  const isLocal = localPatterns.some(pattern => pattern.test(trimmed));
  return (isLocal ? 'http://' : 'https://') + trimmed;
}

/**
 * Normalize URL for comparison to prevent duplicates
 */
function normalizeUrlForComparison(url: string): string {
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.origin + urlObj.pathname;
    if (normalized.endsWith('/') && normalized !== urlObj.origin + '/') {
      normalized = normalized.slice(0, -1);
    }
    normalized = normalized.replace('://127.0.0.1', '://localhost');
    normalized = normalized.replace('://www.', '://');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  verified: boolean;
}

interface UseUrlManagementOptions {
  projectId: string | undefined;
  projectUrls: ProjectUrl[];
  onProjectReload: () => Promise<void>;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
}

interface UseUrlManagementReturn {
  newUrl: string;
  setNewUrl: (url: string) => void;
  addingUrl: boolean;
  verifyingUrl: string | null;
  handleAddUrl: () => Promise<void>;
  handleRemoveUrl: (urlToRemove: string) => Promise<void>;
  handleVerifyUrl: (urlId: string) => Promise<void>;
}

export function useUrlManagement({
  projectId,
  projectUrls,
  onProjectReload,
  showSuccess,
  showError,
}: UseUrlManagementOptions): UseUrlManagementReturn {
  const [newUrl, setNewUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [verifyingUrl, setVerifyingUrl] = useState<string | null>(null);

  const handleAddUrl = useCallback(async () => {
    if (!projectId || !newUrl.trim()) return;

    setAddingUrl(true);
    try {
      const urlToAdd = normalizeUrl(newUrl);

      if (projectUrls.some(url => normalizeUrlForComparison(url.url) === normalizeUrlForComparison(urlToAdd))) {
        showError('Duplicate URL', 'This URL is already added to the project');
        setAddingUrl(false);
        return;
      }

      const updatedUrls = [...projectUrls, { url: urlToAdd, title: 'Page', description: 'Project URL' }];

      await projectsAPI.update(projectId, { urls: updatedUrls });

      setNewUrl('');
      showSuccess('URL Added', 'URL has been added to the project. Run analysis to discover elements.');
      await onProjectReload();
    } catch (error) {
      logger.error('Failed to add URL', error);
      showError('Failed to Add URL', 'Please try again.');
    } finally {
      setAddingUrl(false);
    }
  }, [projectId, newUrl, projectUrls, onProjectReload, showSuccess, showError]);

  const handleRemoveUrl = useCallback(async (urlToRemove: string) => {
    if (!projectId) return;

    if (!confirm(`Remove URL: ${urlToRemove}?\n\nThis will also remove any elements discovered from this URL.`)) {
      return;
    }

    try {
      const updatedUrls = projectUrls.filter(url => url.url !== urlToRemove);

      await projectsAPI.update(projectId, {
        urls: updatedUrls.map(url => ({ url: url.url, title: url.title, description: url.description }))
      });

      showSuccess('URL Removed', 'URL has been removed from the project.');
      await onProjectReload();
    } catch (error) {
      logger.error('Failed to remove URL', error);
      showError('Failed to Remove URL', 'Please try again.');
    }
  }, [projectId, projectUrls, onProjectReload, showSuccess, showError]);

  const handleVerifyUrl = useCallback(async (urlId: string) => {
    if (!projectId) return;

    setVerifyingUrl(urlId);
    try {
      const organizationId = localStorage.getItem('organizationId');
      const response = await fetch(`http://localhost:3002/api/projects/urls/${urlId}/verify?organizationId=${organizationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();

      if (result.accessible) {
        showSuccess('URL Verified', result.message);
        await onProjectReload();
      } else {
        showError('URL Not Accessible', result.message);
      }
    } catch (error) {
      logger.error('Failed to verify URL', error);
      showError('Verification Failed', 'Could not verify URL. Please try again.');
    } finally {
      setVerifyingUrl(null);
    }
  }, [projectId, onProjectReload, showSuccess, showError]);

  return {
    newUrl,
    setNewUrl,
    addingUrl,
    verifyingUrl,
    handleAddUrl,
    handleRemoveUrl,
    handleVerifyUrl,
  };
}
