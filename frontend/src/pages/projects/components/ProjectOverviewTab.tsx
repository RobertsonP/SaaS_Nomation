import React, { useState } from 'react';
import { Project, TestStats } from './types';

// Feature flag: AI test generation — hidden until Anthropic API billing is funded (pre-launch).
const AI_TEST_GEN_ENABLED = false;

interface ProjectOverviewTabProps {
  project: Project;
  testStats: TestStats | null;
  analyzing: boolean;
  currentAnalysisStep: string;
  analysisProgressPercent: number;
  onSetActiveTab: (tab: 'urls') => void;
  onShowAnalysisModal: () => void;
  onGenerateTests: () => Promise<void>;
  isGeneratingTests: boolean;
}

export function ProjectOverviewTab({
  project,
  testStats,
  analyzing,
  currentAnalysisStep,
  analysisProgressPercent,
  onSetActiveTab,
  onShowAnalysisModal,
  onGenerateTests,
  isGeneratingTests,
}: ProjectOverviewTabProps) {
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Empty Project Setup Guide */}
      {project.urls.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Get Started</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Your project is ready. Add URLs and start discovering testable elements to build your automated test suite.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
              <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">1</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Add URLs</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start by adding the web pages you want to test</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
              <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">2</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Analyze Pages</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Our AI discovers testable elements automatically</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
              <div className="text-blue-600 dark:text-blue-400 text-2xl font-bold mb-3">3</div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Build Tests</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Use discovered elements to create automated tests</p>
            </div>
          </div>

          <button
            onClick={() => onSetActiveTab('urls')}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First URL
          </button>
        </div>
      )}

      {/* Analysis Controls - Only show when project has URLs */}
      {project.urls.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Analysis</h3>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Analysis Progress</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{currentAnalysisStep}</span>
            </div>
            <div
              className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 cursor-pointer"
              onDoubleClick={onShowAnalysisModal}
              title="Double-click for details"
            >
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  analyzing && analysisProgressPercent < 100 ? 'bg-blue-500' :
                  analysisProgressPercent === 100 ? 'bg-green-500' : 'bg-gray-400'
                }`}
                style={{ width: `${analysisProgressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Test Execution Stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {testStats?.totalPassed ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Passed</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {testStats?.totalFailed ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {testStats?.regressions ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Regressions</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {testStats?.successRate ?? 0}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
            </div>
          </div>
          {testStats && testStats.totalExecutions === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              No test executions yet. Run tests to see statistics.
            </p>
          )}
        </div>
      )}

      {/* AI Test Generation — show when project has analyzed elements */}
      {AI_TEST_GEN_ENABLED && project._count.elements > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                AI Test Generation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
                Generate a comprehensive test suite using Claude AI. Tests are created from your discovered elements,
                navigation paths, and authentication flows — covering authentication, navigation, forms, tables, and
                end-to-end user workflows.
              </p>
            </div>
            <button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={isGeneratingTests}
              className={`ml-4 flex-shrink-0 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                isGeneratingTests
                  ? 'bg-purple-300 dark:bg-purple-800 text-purple-100 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isGeneratingTests ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Test Suite with AI'
              )}
            </button>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{project._count.elements} elements available</span>
            <span>{project._count.urls} pages indexed</span>
          </div>
        </div>
      )}

      {/* Generate Confirmation Modal */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Generate Test Suite with AI
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Claude AI will analyze your {project._count.elements} discovered elements and {project._count.urls} pages
              to generate a comprehensive test suite covering authentication, navigation, forms, tables, and end-to-end
              workflows. Generated tests will be saved as drafts.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
              This may take 1-2 minutes depending on the number of pages and elements.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowGenerateConfirm(false);
                  onGenerateTests();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Generate Tests
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
