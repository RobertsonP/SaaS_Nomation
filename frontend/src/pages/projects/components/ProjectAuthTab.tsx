import React from 'react';

interface AuthFlow {
  id: string;
  name: string;
  loginUrl: string;
}

interface ProjectAuthTabProps {
  authFlows: AuthFlow[];
  onAddAuthentication: () => void;
  onEditAuthentication: (authFlow: AuthFlow) => void;
  onDeleteAuthentication: (authFlowId: string, authFlowName: string) => void;
}

export function ProjectAuthTab({
  authFlows,
  onAddAuthentication,
  onEditAuthentication,
  onDeleteAuthentication,
}: ProjectAuthTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Authentication Flows</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure login credentials for testing authenticated pages</p>
        </div>
        <button
          onClick={onAddAuthentication}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Authentication
        </button>
      </div>

      {authFlows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Authentication Configured</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Add authentication to test pages that require login credentials
          </p>
          <button
            onClick={onAddAuthentication}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Setup Authentication
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {authFlows.map((authFlow) => (
            <div key={authFlow.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{authFlow.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{authFlow.loginUrl}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onEditAuthentication(authFlow)}
                    className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteAuthentication(authFlow.id, authFlow.name)}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-1"
                  >
                    Delete
                  </button>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded">
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
