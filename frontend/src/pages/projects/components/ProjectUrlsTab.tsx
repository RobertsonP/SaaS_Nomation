import React, { useState, useMemo } from 'react';
import { Project, ProjectUrl } from './types';

interface ProjectUrlsTabProps {
  project: Project;
  newUrl: string;
  setNewUrl: (url: string) => void;
  addingUrl: boolean;
  verifyingUrl: string | null;
  selectedUrls: string[];
  setSelectedUrls: (urls: string[]) => void;
  analyzing: boolean;
  onAddUrl: () => void;
  onRemoveUrl: (url: string) => void;
  onVerifyUrl: (urlId: string) => void;
  onAnalyzeSelected: () => void;
  onShowDiscoveryModal: () => void;
}

// Collapsible section component for URL grouping
function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
  icon,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {icon}
          <span className="font-medium text-gray-900 dark:text-white">{title}</span>
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-xs text-gray-600 dark:text-gray-300">
            {count}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

// URL Card component for consistent rendering
function UrlCard({
  url,
  selectedUrls,
  setSelectedUrls,
  showCheckbox,
  verifyingUrl,
  onVerifyUrl,
  onRemoveUrl,
}: {
  url: ProjectUrl;
  selectedUrls: string[];
  setSelectedUrls: (urls: string[]) => void;
  showCheckbox: boolean;
  verifyingUrl: string | null;
  onVerifyUrl: (urlId: string) => void;
  onRemoveUrl: (urlStr: string) => void;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:shadow-sm transition-shadow bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selectedUrls.includes(url.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUrls([...selectedUrls, url.id]);
                } else {
                  setSelectedUrls(selectedUrls.filter(id => id !== url.id));
                }
              }}
              className="w-4 h-4 text-blue-600 rounded mt-1 flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {url.title && (
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {url.title}
                </span>
              )}
              {url.pageType && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                  {url.pageType}
                </span>
              )}
            </div>
            <a
              href={url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate block"
            >
              {url.url}
            </a>
            <div className="flex items-center gap-2 mt-1">
              {url.analyzed && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                  Analyzed
                </span>
              )}
              {url.verified && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                  Verified
                </span>
              )}
              {url.discovered && (
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded">
                  Auto-discovered
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          <button
            onClick={() => onVerifyUrl(url.id)}
            disabled={verifyingUrl === url.id}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1"
          >
            {verifyingUrl === url.id ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={() => onRemoveUrl(url.url)}
            className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectUrlsTab({
  project,
  newUrl,
  setNewUrl,
  addingUrl,
  verifyingUrl,
  selectedUrls,
  setSelectedUrls,
  analyzing,
  onAddUrl,
  onRemoveUrl,
  onVerifyUrl,
  onAnalyzeSelected,
  onShowDiscoveryModal,
}: ProjectUrlsTabProps) {
  // Group URLs by depth
  const groupedUrls = useMemo(() => {
    const rootUrls: ProjectUrl[] = [];
    const level1Urls: ProjectUrl[] = [];
    const deepUrls: ProjectUrl[] = [];
    const manualUrls: ProjectUrl[] = [];

    project.urls.forEach(url => {
      const depth = url.discoveryDepth ?? -1;
      const isDiscovered = url.discovered ?? false;

      if (!isDiscovered) {
        manualUrls.push(url);
      } else if (depth === 0) {
        rootUrls.push(url);
      } else if (depth === 1) {
        level1Urls.push(url);
      } else {
        deepUrls.push(url);
      }
    });

    return { rootUrls, level1Urls, deepUrls, manualUrls };
  }, [project.urls]);

  // Determine if we should show hierarchical view (only if there are discovered URLs with different depths)
  const hasHierarchy = useMemo(() => {
    const hasDiscovered = project.urls.some(u => u.discovered);
    const hasMultipleDepths = new Set(project.urls.map(u => u.discoveryDepth ?? -1)).size > 1;
    return hasDiscovered && hasMultipleDepths;
  }, [project.urls]);

  return (
    <div className="space-y-6">
      {/* Add URL Form */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="flex space-x-3">
          <div className="flex-1">
            <input
              type="url"
              placeholder="https://example.com/page-to-test"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && onAddUrl()}
            />
          </div>
          <button
            onClick={onAddUrl}
            disabled={addingUrl || !newUrl.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingUrl ? 'Adding...' : '+ Add URL'}
          </button>
          <button
            onClick={onShowDiscoveryModal}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Auto-Discover
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Add URLs manually or use Auto-Discover to find pages from a root URL.
        </p>
      </div>

      {/* URLs List */}
      {project.urls.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No URLs Added Yet</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">Add your first URL or use Auto-Discover to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selective Analysis Controls */}
          {project.urls.length > 1 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedUrls.length === project.urls.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUrls(project.urls.map(u => u.id));
                    } else {
                      setSelectedUrls([]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedUrls.length > 0 ? `${selectedUrls.length} selected` : 'Select all'}
                </span>
              </div>
              {selectedUrls.length > 0 && (
                <button
                  onClick={onAnalyzeSelected}
                  disabled={analyzing}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {analyzing ? 'Analyzing...' : `Analyze Selected (${selectedUrls.length})`}
                </button>
              )}
            </div>
          )}

          {/* Hierarchical URL View (when discovery data is available) */}
          {hasHierarchy ? (
            <div className="space-y-4">
              {/* Manually Added URLs */}
              {groupedUrls.manualUrls.length > 0 && (
                <CollapsibleSection
                  title="Manually Added"
                  count={groupedUrls.manualUrls.length}
                  icon={<span className="text-lg">➕</span>}
                >
                  {groupedUrls.manualUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Root Pages (depth 0) */}
              {groupedUrls.rootUrls.length > 0 && (
                <CollapsibleSection
                  title="Root Pages"
                  count={groupedUrls.rootUrls.length}
                  icon={<span className="text-lg">🏠</span>}
                >
                  {groupedUrls.rootUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Direct Links (depth 1) */}
              {groupedUrls.level1Urls.length > 0 && (
                <CollapsibleSection
                  title="Direct Links"
                  count={groupedUrls.level1Urls.length}
                  icon={<span className="text-lg">🔗</span>}
                  defaultOpen={groupedUrls.level1Urls.length <= 10}
                >
                  {groupedUrls.level1Urls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Deep Links (depth 2+) */}
              {groupedUrls.deepUrls.length > 0 && (
                <CollapsibleSection
                  title="Deep Links"
                  count={groupedUrls.deepUrls.length}
                  icon={<span className="text-lg">📁</span>}
                  defaultOpen={false}
                >
                  {groupedUrls.deepUrls.map(url => (
                    <UrlCard
                      key={url.id}
                      url={url}
                      selectedUrls={selectedUrls}
                      setSelectedUrls={setSelectedUrls}
                      showCheckbox={project.urls.length > 1}
                      verifyingUrl={verifyingUrl}
                      onVerifyUrl={onVerifyUrl}
                      onRemoveUrl={onRemoveUrl}
                    />
                  ))}
                </CollapsibleSection>
              )}
            </div>
          ) : (
            /* Flat URL List (no hierarchy data) */
            <div className="space-y-2">
              {project.urls.map((url) => (
                <UrlCard
                  key={url.id}
                  url={url}
                  selectedUrls={selectedUrls}
                  setSelectedUrls={setSelectedUrls}
                  showCheckbox={project.urls.length > 1}
                  verifyingUrl={verifyingUrl}
                  onVerifyUrl={onVerifyUrl}
                  onRemoveUrl={onRemoveUrl}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
