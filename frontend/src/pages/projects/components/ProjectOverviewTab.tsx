import React from 'react';
import { Project, TestStats } from './types';

interface ProjectOverviewTabProps {
  project: Project;
  testStats: TestStats | null;
  analyzing: boolean;
  currentAnalysisStep: string;
  analysisProgressPercent: number;
  onSetActiveTab: (tab: 'urls') => void;
  onShowAnalysisModal: () => void;
}

export function ProjectOverviewTab({
  project,
  testStats,
  analyzing,
  currentAnalysisStep,
  analysisProgressPercent,
  onSetActiveTab,
  onShowAnalysisModal,
}: ProjectOverviewTabProps) {
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
    </div>
  );
}
