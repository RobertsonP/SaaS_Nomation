import { useEffect } from 'react';

interface TestStep {
  id: string;
  type: string;
  selector: string;
  value?: string;
  description: string;
}

interface ExecutionResult {
  success: boolean;
  result?: string;
  screenshot?: string;
  error?: string;
  timing?: {
    duration: number;
    startTime: string;
    endTime: string;
  };
  elementFound?: boolean;
  logs?: Array<{
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

interface LiveExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: TestStep;
  result: ExecutionResult;
}

export function LiveExecutionModal({
  isOpen,
  onClose,
  step,
  result
}: LiveExecutionModalProps) {
  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'click': return '👆';
      case 'doubleclick': return '👆👆';
      case 'type': return '⌨️';
      case 'hover': return '🫸';
      case 'scroll': return '↕️';
      case 'wait': return '⏳';
      case 'assert': return '✓';
      default: return '📝';
    }
  };

  const getStatusColor = (success: boolean) => {
    return success
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const formatTiming = (duration: number) => {
    if (duration < 1000) return `${Math.round(duration)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-200 ${
          result.success 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
            : 'bg-gradient-to-r from-red-500 to-pink-600'
        } text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{result.success ? '✅' : '❌'}</div>
              <div>
                <h2 className="text-xl font-bold">
                  {result.success ? 'Step Executed Successfully!' : 'Step Execution Failed'}
                </h2>
                <p className="text-sm opacity-90">
                  Live execution result for test step
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold p-2 rounded-full hover:bg-black hover:bg-opacity-20 transition-colors"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Step Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <span>📋</span>
                <span>Step Details</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Action</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-lg">{getStepIcon(step.type)}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.success)}`}>
                      {step.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <div className="mt-1 text-gray-900">{step.description}</div>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-600">Selector</label>
                <div className="mt-1 bg-white p-3 rounded border font-mono text-sm text-gray-800 break-all">
                  {step.selector}
                </div>
              </div>
              {step.value && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-600">Value</label>
                  <div className="mt-1 bg-white p-3 rounded border text-gray-900">
                    "{step.value}"
                  </div>
                </div>
              )}
            </div>

            {/* Execution Results */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <span>{result.success ? '🎯' : '⚠️'}</span>
                <span>Execution Results</span>
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(result.success)}`}>
                    {result.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>

                {result.timing && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Duration</span>
                    <span className="text-sm text-gray-900 font-mono">
                      {formatTiming(result.timing.duration)}
                    </span>
                  </div>
                )}

                {result.elementFound !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Element Found</span>
                    <span className={`text-sm font-medium ${result.elementFound ? 'text-green-600' : 'text-red-600'}`}>
                      {result.elementFound ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                )}

                {result.result && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Result</label>
                    <div className="mt-1 bg-white p-3 rounded border text-gray-900">
                      {result.result}
                    </div>
                  </div>
                )}

                {result.error && (
                  <div>
                    <label className="text-sm font-medium text-red-600">Error</label>
                    <div className="mt-1 bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm">
                      {result.error}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Screenshot */}
            {result.screenshot && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>📸</span>
                  <span>Screenshot</span>
                </h3>
                <div className="bg-white p-4 rounded-lg border">
                  <div className="text-center">
                    <img
                      src={result.screenshot.startsWith('data:image/') 
                        ? result.screenshot 
                        : `data:image/png;base64,${result.screenshot}`}
                      alt="Step execution screenshot"
                      className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200"
                      style={{ maxHeight: '500px' }}
                    />
                    <div className="mt-3 text-sm text-gray-600">
                      Screenshot taken after step execution
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Logs */}
            {result.logs && result.logs.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>📝</span>
                  <span>Execution Logs</span>
                </h3>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                  {result.logs.map((log, index) => (
                    <div key={index} className={`flex items-start space-x-3 mb-1 ${
                      log.level === 'error' ? 'text-red-300' :
                      log.level === 'warning' ? 'text-yellow-300' : 'text-gray-100'
                    }`}>
                      <span className="text-gray-500 text-xs">{log.timestamp}</span>
                      <span className="uppercase text-xs font-medium">
                        [{log.level}]
                      </span>
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {result.timing && (
              <span>
                Executed at {new Date(result.timing.startTime).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            {result.screenshot && (
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `step-${step.id}-screenshot.png`;
                  link.href = result.screenshot?.startsWith('data:image/') 
                    ? result.screenshot 
                    : `data:image/png;base64,${result.screenshot || ''}`;
                  link.click();
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                📥 Download Screenshot
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}