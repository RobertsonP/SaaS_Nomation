import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { WebSocketExecutionEvent } from '../../types/api.types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('TestExecutionModal')

interface TestExecutionModalProps {
  isOpen: boolean
  onClose: () => void
  testId: string
  testName: string
  executionId: string
  onComplete?: (results: TestExecutionResult) => void
}

interface TestExecutionResult {
  status: 'passed' | 'failed' | 'running'
  startedAt: string
  completedAt?: string
  duration?: number
  error?: string
  steps: StepResult[]
}

interface StepResult {
  stepIndex: number
  description: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  timestamp?: string
  error?: string
}

export function TestExecutionModal({
  isOpen,
  onClose,
  testId,
  testName,
  executionId,
  onComplete
}: TestExecutionModalProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [executionResult, setExecutionResult] = useState<TestExecutionResult>({
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: []
  })
  const [isMinimized, setIsMinimized] = useState(false)

  // WebSocket connection for real-time progress
  useEffect(() => {
    if (!isOpen || !executionId) return

    logger.debug(`Connecting to WebSocket for execution ${executionId}`)

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'
    const newSocket = io(`${API_URL}/execution-progress`, {
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      logger.debug('Connected to WebSocket')
      newSocket.emit('subscribe-to-execution', executionId)
    })

    newSocket.on('subscription-confirmed', (data) => {
      logger.debug('Subscribed to execution', data)
    })

    // Listen for execution progress events
    newSocket.on('execution-progress', (event: WebSocketExecutionEvent) => {
      logger.debug('Received event', { type: event.type, status: event.status })

      if (event.type === 'test') {
        handleTestEvent(event)
      } else if (event.type === 'step') {
        handleStepEvent(event)
      }
    })

    newSocket.on('disconnect', () => {
      logger.warn('Disconnected from WebSocket')
    })

    setSocket(newSocket)

    return () => {
      logger.debug('Cleaning up WebSocket connection')
      newSocket.disconnect()
    }
  }, [isOpen, executionId])

  const handleTestEvent = (event: WebSocketExecutionEvent) => {
    if (event.status === 'started') {
      logger.info(`Test started: ${event.message}`)
      setExecutionResult(prev => ({
        ...prev,
        status: 'running',
        startedAt: event.timestamp
      }))
    } else if (event.status === 'completed') {
      logger.info(`Test passed: ${event.message}`)
      setExecutionResult(prev => ({
        ...prev,
        status: 'passed',
        completedAt: event.timestamp,
        duration: event.details.duration
      }))

      // Notify parent and auto-close after 3 seconds
      if (onComplete) {
        onComplete(executionResult)
      }
      setTimeout(() => {
        if (!isMinimized) {
          onClose()
        }
      }, 3000)
    } else if (event.status === 'failed') {
      logger.error(`Test failed: ${event.message}`)
      setExecutionResult(prev => ({
        ...prev,
        status: 'failed',
        completedAt: event.timestamp,
        error: event.details.error
      }))
    }
  }

  const handleStepEvent = (event: WebSocketExecutionEvent) => {
    const stepIndex = event.details.stepIndex ?? 0
    const totalSteps = event.details.totalSteps ?? 0
    const stepDescription = event.details.stepDescription ?? ''

    if (event.status === 'started') {
      logger.debug(`Step ${stepIndex + 1}/${totalSteps}: ${stepDescription}`)
      setExecutionResult(prev => {
        const existingStepIdx = prev.steps.findIndex(s => s.stepIndex === stepIndex)
        const updatedSteps = existingStepIdx >= 0
          ? prev.steps.map((s, idx) =>
              idx === existingStepIdx
                ? { ...s, status: 'running' as const, timestamp: event.timestamp }
                : s
            )
          : [
              ...prev.steps,
              {
                stepIndex,
                description: stepDescription,
                status: 'running' as const,
                timestamp: event.timestamp
              }
            ]

        return { ...prev, steps: updatedSteps }
      })
    } else if (event.status === 'completed') {
      logger.debug(`Step completed: ${stepDescription}`)
      setExecutionResult(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.stepIndex === stepIndex
            ? { ...s, status: 'passed' as const }
            : s
        )
      }))
    } else if (event.status === 'failed') {
      logger.warn(`Step failed: ${stepDescription}`)
      setExecutionResult(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.stepIndex === stepIndex
            ? { ...s, status: 'failed' as const, error: event.details.error }
            : s
        )
      }))
    }
  }

  if (!isOpen) return null

  const currentStep = executionResult.steps.find(s => s.status === 'running')
  const completedSteps = executionResult.steps.filter(s => s.status === 'passed').length
  const totalSteps = executionResult.steps.length
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <div className={`fixed ${isMinimized ? 'bottom-4 right-4 w-96' : 'inset-0 bg-black bg-opacity-50 flex items-center justify-center'} z-50`}>
      <div className={`bg-white rounded-lg shadow-xl ${isMinimized ? 'w-96' : 'w-full max-w-2xl max-h-[90vh]'} flex flex-col`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              executionResult.status === 'running' ? 'bg-blue-500 animate-pulse' :
              executionResult.status === 'passed' ? 'bg-green-500' :
              'bg-red-500'
            }`} />
            <div>
              <h2 className="text-xl font-bold">🧪 Test Execution (Live)</h2>
              <p className="text-sm text-gray-600">{testName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isMinimized ? 'Maximize' : 'Minimize'}
            >
              {isMinimized ? '⬆️' : '⬇️'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Overall Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Overall Progress: {completedSteps}/{totalSteps} steps
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    executionResult.status === 'passed' ? 'bg-green-500' :
                    executionResult.status === 'failed' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current Step */}
            {currentStep && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-medium text-blue-700">Current Step</span>
                </div>
                <p className="text-sm text-gray-700">
                  Step {currentStep.stepIndex + 1}: {currentStep.description}
                </p>
              </div>
            )}

            {/* Steps List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Execution Steps:</h3>
              {executionResult.steps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-pulse">Initializing test execution...</div>
                </div>
              ) : (
                executionResult.steps.map((step, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      step.status === 'passed' ? 'bg-green-50 border-green-200' :
                      step.status === 'failed' ? 'bg-red-50 border-red-200' :
                      step.status === 'running' ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          step.status === 'passed' ? 'bg-green-500 text-white' :
                          step.status === 'failed' ? 'bg-red-500 text-white' :
                          step.status === 'running' ? 'bg-blue-500 text-white' :
                          'bg-gray-300 text-gray-600'
                        }`}>
                          {step.status === 'passed' ? '✓' :
                           step.status === 'failed' ? '✗' :
                           step.status === 'running' ? '⟳' :
                           step.stepIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Step {step.stepIndex + 1}: {step.description}
                          </p>
                          {step.error && (
                            <p className="text-xs text-red-600 mt-1">
                              Error: {step.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {step.status === 'passed' && '✅'}
                        {step.status === 'failed' && '❌'}
                        {step.status === 'running' && (
                          <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Final Result */}
            {executionResult.status !== 'running' && (
              <div className={`mt-6 p-4 rounded-lg border ${
                executionResult.status === 'passed'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">
                    {executionResult.status === 'passed' ? '✅' : '❌'}
                  </span>
                  <div>
                    <h3 className={`text-lg font-bold ${
                      executionResult.status === 'passed' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      Test {executionResult.status === 'passed' ? 'Passed' : 'Failed'}
                    </h3>
                    {executionResult.duration && (
                      <p className="text-sm text-gray-600">
                        Duration: {(executionResult.duration / 1000).toFixed(2)}s
                      </p>
                    )}
                    {executionResult.error && (
                      <p className="text-sm text-red-600 mt-1">
                        Error: {executionResult.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Minimized Footer */}
        {isMinimized && (
          <div className="px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {executionResult.status === 'running' ? 'Running...' :
                 executionResult.status === 'passed' ? 'Passed ✅' :
                 'Failed ❌'}
              </span>
              <span className="font-medium text-gray-700">
                {completedSteps}/{totalSteps} steps
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  executionResult.status === 'passed' ? 'bg-green-500' :
                  executionResult.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isMinimized && executionResult.status !== 'running' && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
