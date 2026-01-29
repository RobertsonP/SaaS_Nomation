import { useState, useMemo } from 'react';

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  analyzed: boolean;
}

interface AnalyzeUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectUrls: ProjectUrl[];
  onAnalyze: (selectedUrlIds: string[]) => void;
  isAnalyzing?: boolean;
}

export function AnalyzeUrlsModal({
  isOpen,
  onClose,
  projectUrls,
  onAnalyze,
  isAnalyzing = false
}: AnalyzeUrlsModalProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'analyzed' | 'unanalyzed'>('all');

  // Filter URLs based on selected filter
  const filteredUrls = useMemo(() => {
    if (filter === 'all') return projectUrls;
    if (filter === 'analyzed') return projectUrls.filter(u => u.analyzed);
    return projectUrls.filter(u => !u.analyzed);
  }, [projectUrls, filter]);

  // Stats
  const analyzedCount = projectUrls.filter(u => u.analyzed).length;
  const unanalyzedCount = projectUrls.filter(u => !u.analyzed).length;

  const handleToggleUrl = (urlId: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(urlId)) {
        newSet.delete(urlId);
      } else {
        newSet.add(urlId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedUrls(new Set(filteredUrls.map(u => u.id)));
  };

  const handleDeselectAll = () => {
    setSelectedUrls(new Set());
  };

  const handleSelectUnanalyzed = () => {
    setSelectedUrls(new Set(projectUrls.filter(u => !u.analyzed).map(u => u.id)));
  };

  const handleAnalyze = () => {
    if (selectedUrls.size > 0) {
      onAnalyze(Array.from(selectedUrls));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Select URLs to Analyze
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {projectUrls.length} URLs total ({analyzedCount} analyzed, {unanalyzedCount} pending)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'all'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            All ({projectUrls.length})
          </button>
          <button
            onClick={() => setFilter('unanalyzed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'unanalyzed'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Pending ({unanalyzedCount})
          </button>
          <button
            onClick={() => setFilter('analyzed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'analyzed'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Analyzed ({analyzedCount})
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Deselect All
          </button>
          {unanalyzedCount > 0 && (
            <button
              onClick={handleSelectUnanalyzed}
              className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300"
            >
              Select Unanalyzed
            </button>
          )}
        </div>

        {/* URL list */}
        <div className="overflow-y-auto max-h-96 p-4">
          {filteredUrls.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No URLs match the current filter
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUrls.map(url => (
                <label
                  key={url.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedUrls.has(url.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUrls.has(url.id)}
                    onChange={() => handleToggleUrl(url.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {url.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {url.url}
                    </p>
                  </div>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    url.analyzed
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {url.analyzed ? 'Analyzed' : 'Pending'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedUrls.size} URL{selectedUrls.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={selectedUrls.size === 0 || isAnalyzing}
              className={`px-4 py-2 text-sm rounded font-medium ${
                selectedUrls.size === 0 || isAnalyzing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isAnalyzing ? 'Analyzing...' : `Analyze ${selectedUrls.size} URL${selectedUrls.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
