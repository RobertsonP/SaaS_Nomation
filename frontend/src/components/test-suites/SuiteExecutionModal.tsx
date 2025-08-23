import { useState, useEffect, useCallback } from 'react';

interface TestResult {
  testId: string;
  testName: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  stepsCompleted: number;
  totalSteps: number;
}

interface SuiteExecutionProgress {
  suiteId: string;
  suiteName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  currentTestIndex: number;
  totalTests: number;
  overallProgress: number;
  tests: TestResult[];
  error?: string;
}

interface SuiteExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suiteId: string;
  suiteName: string;
  totalTests: number;
  onComplete?: (results: SuiteExecutionProgress) => void;
}

export function SuiteExecutionModal({
  isOpen,
  onClose,
  suiteId,
  suiteName,
  totalTests,
  onComplete
}: SuiteExecutionModalProps) {
  const [executionProgress, setExecutionProgress] = useState<SuiteExecutionProgress>({
    suiteId,
    suiteName,
    status: 'running',
    startedAt: new Date().toISOString(),
    currentTestIndex: 0,
    totalTests,
    overallProgress: 0,
    tests: []
  });

  const [isMinimized, setIsMinimized] = useState(false);

  // Initialize test results
  useEffect(() => {
    if (isOpen && executionProgress.tests.length === 0) {
      // Create initial test results - in real implementation, get from API
      const initialTests: TestResult[] = Array.from({ length: totalTests }, (_, index) => ({
        testId: `test-${index + 1}`,
        testName: `Test ${index + 1}`, // In real implementation, get actual test names
        status: 'pending',
        progress: 0,
        stepsCompleted: 0,
        totalSteps: 5 // In real implementation, get actual step count
      }));

      setExecutionProgress(prev => ({
        ...prev,
        tests: initialTests
      }));

      // Start simulation - in real implementation, start actual execution
      simulateSuiteExecution();
    }
  }, [isOpen, totalTests, executionProgress.tests.length]);

  // Simulate suite execution - replace with real WebSocket/polling
  const simulateSuiteExecution = useCallback(async () => {
    const tests = Array.from({ length: totalTests }, (_, index) => ({
      testId: `test-${index + 1}`,
      testName: `Login Flow Test ${index + 1}`, // Real names from API
      status: 'pending' as const,
      progress: 0,
      stepsCompleted: 0,
      totalSteps: Math.floor(Math.random() * 8) + 3 // 3-10 steps per test
    }));

    setExecutionProgress(prev => ({ ...prev, tests }));

    // Execute tests sequentially
    for (let testIndex = 0; testIndex < totalTests; testIndex++) {
      // Update current test to running
      setExecutionProgress(prev => ({
        ...prev,
        currentTestIndex: testIndex,
        tests: prev.tests.map((test, idx) => 
          idx === testIndex 
            ? { ...test, status: 'running', startedAt: new Date().toISOString() }
            : test
        )
      }));

      // Simulate test execution with step progress
      const currentTest = tests[testIndex];
      for (let step = 0; step < currentTest.totalSteps; step++) {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        
        const stepProgress = ((step + 1) / currentTest.totalSteps) * 100;
        
        setExecutionProgress(prev => ({
          ...prev,
          tests: prev.tests.map((test, idx) => 
            idx === testIndex 
              ? { 
                  ...test, 
                  progress: stepProgress,
                  stepsCompleted: step + 1
                }
              : test
          ),
          overallProgress: ((testIndex * 100 + stepProgress) / totalTests)
        }));
      }

      // Complete current test
      const testStatus = Math.random() > 0.15 ? 'passed' : 'failed'; // 85% pass rate
      const testDuration = 3000 + Math.random() * 7000; // 3-10 seconds
      
      setExecutionProgress(prev => ({
        ...prev,
        tests: prev.tests.map((test, idx) => 
          idx === testIndex 
            ? { 
                ...test, 
                status: testStatus,
                progress: 100,
                completedAt: new Date().toISOString(),
                duration: testDuration,
                error: testStatus === 'failed' ? 'Element not found: #login-button' : undefined
              }
            : test
        )
      }));
    }

    // Complete suite execution
    const finalResults: SuiteExecutionProgress = {
      suiteId,
      suiteName,
      status: 'completed',
      startedAt: executionProgress.startedAt,
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(executionProgress.startedAt).getTime(),
      currentTestIndex: totalTests,
      totalTests,
      overallProgress: 100,
      tests: executionProgress.tests
    };

    setExecutionProgress(finalResults);
    
    // Notify parent component
    if (onComplete) {
      onComplete(finalResults);
    }

    // Auto-close after 3 seconds
    setTimeout(() => {
      if (!isMinimized) {
        onClose();
      }
    }, 3000);
  }, [suiteId, suiteName, totalTests, executionProgress.startedAt, onComplete, onClose, isMinimized]);

  const handleCancel = () => {
    setExecutionProgress(prev => ({
      ...prev,
      status: 'cancelled',
      completedAt: new Date().toISOString()
    }));
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🔄';
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'passed': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '0.0s';
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getOverallStats = () => {
    const passed = executionProgress.tests.filter(t => t.status === 'passed').length;
    const failed = executionProgress.tests.filter(t => t.status === 'failed').length;
    const running = executionProgress.tests.filter(t => t.status === 'running').length;
    const completed = passed + failed;
    
    return { passed, failed, running, completed };
  };

  if (!isOpen) return null;

  const stats = getOverallStats();
  const isComplete = executionProgress.status === 'completed';
  const currentTest = executionProgress.tests[executionProgress.currentTestIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-2xl transition-all duration-300 ${
        isMinimized 
          ? 'w-80 h-20' 
          : 'w-full max-w-4xl max-h-[90vh] h-auto'
      }`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">🚀 Test Suite Execution</h2>
              <p className="text-sm opacity-90">{suiteName}</p>
            </div>
            <div className="flex items-center space-x-2">
              {!isComplete && (
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:text-gray-200 text-lg"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                >
                  {isMinimized ? '⬆️' : '⬇️'}
                </button>
              )}
              {!isComplete && (
                <button
                  onClick={handleCancel}
                  className="text-white hover:text-gray-200 text-sm px-2 py-1 rounded border border-white border-opacity-30"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-xl font-bold"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-sm opacity-90 mb-1">
              <span>
                {isComplete 
                  ? 'Completed!' 
                  : `Test ${executionProgress.currentTestIndex + 1} of ${totalTests}`
                }
              </span>
              <span>{Math.round(executionProgress.overallProgress)}%</span>
            </div>
            <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${executionProgress.overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Stats Bar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-2xl font-bold text-gray-900">{stats.completed}/{totalTests}</div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">✅ {stats.passed}</div>
                  <div className="text-xs text-gray-600">Passed</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="text-2xl font-bold text-red-600">❌ {stats.failed}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">🔄 {stats.running}</div>
                  <div className="text-xs text-gray-600">Running</div>
                </div>
              </div>
            </div>

            {/* Current Test Highlight */}
            {!isComplete && currentTest && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-900">Currently Executing: {currentTest.testName}</div>
                    <div className="text-sm text-blue-700">
                      Step {currentTest.stepsCompleted} of {currentTest.totalSteps} 
                      {currentTest.progress > 0 && ` (${Math.round(currentTest.progress)}%)`}
                    </div>
                  </div>
                  <div className="text-right text-sm text-blue-600">
                    {currentTest.startedAt && (
                      <div>Running for {formatDuration(Date.now() - new Date(currentTest.startedAt).getTime())}</div>
                    )}
                  </div>
                </div>
                
                {/* Current Test Progress Bar */}
                <div className="mt-2">
                  <div className="w-full bg-blue-200 rounded-full h-1">
                    <div 
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${currentTest.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Test Results List */}
            <div className="flex-1 overflow-y-auto p-4 max-h-64">
              <div className="space-y-2">
                {executionProgress.tests.map((test, index) => (
                  <div
                    key={test.testId}
                    className={`border rounded-lg p-3 transition-all ${getStatusColor(test.status)} ${
                      index === executionProgress.currentTestIndex && test.status === 'running' 
                        ? 'ring-2 ring-blue-300 shadow-md' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-lg">{getStatusIcon(test.status)}</span>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{test.testName}</div>
                          <div className="text-xs opacity-75">
                            {test.status === 'running' ? (
                              `Step ${test.stepsCompleted}/${test.totalSteps}`
                            ) : test.status === 'failed' && test.error ? (
                              test.error
                            ) : test.status === 'passed' ? (
                              `Completed in ${formatDuration(test.duration)}`
                            ) : (
                              'Waiting to start...'
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-xs">
                        {test.status === 'running' && (
                          <div className="text-blue-600 font-medium">
                            {Math.round(test.progress)}%
                          </div>
                        )}
                        {(test.status === 'passed' || test.status === 'failed') && test.duration && (
                          <div className="text-gray-500">
                            {formatDuration(test.duration)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Individual test progress bar */}
                    {test.status === 'running' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-current h-1 rounded-full transition-all duration-300"
                            style={{ width: `${test.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm">
                <div className="text-gray-600">
                  {isComplete ? (
                    `✅ Suite completed in ${formatDuration(executionProgress.duration)}`
                  ) : (
                    `🚀 Started ${new Date(executionProgress.startedAt).toLocaleTimeString()}`
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">
                    {stats.passed} passed • {stats.failed} failed
                  </span>
                  {!isComplete && (
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 text-red-600 hover:text-red-800 border border-red-200 rounded text-sm"
                    >
                      Cancel Execution
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}