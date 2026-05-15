import { useState, useEffect } from 'react'
import { ChevronUp, CheckCircle2, FlaskConical, Loader2, Minus, X, XCircle } from 'lucide-react'
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

  const accentFg = executionResult.status === 'passed'
    ? 'var(--moss)'
    : executionResult.status === 'failed'
    ? 'var(--clay)'
    : 'var(--info)';

  const minimizedShell: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    width: 360,
    background: 'var(--surface)',
    border: '1px solid var(--hair)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-2)',
    zIndex: 50,
    overflow: 'hidden',
  };

  if (isMinimized) {
    return (
      <div style={minimizedShell}>
        <div
          className="row"
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--hair)',
            background: 'var(--surface-2)',
          }}
        >
          <div className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: accentFg,
                animation: executionResult.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : undefined,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {testName}
              </div>
              <div className="dim" style={{ fontSize: 11 }}>
                {executionResult.status === 'running' ? 'Running…' : executionResult.status === 'passed' ? 'Passed' : 'Failed'}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 2 }}>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="icon-btn"
              title="Maximize"
            >
              <ChevronUp size={13} />
            </button>
            <button type="button" onClick={onClose} className="icon-btn" title="Close">
              <X size={13} />
            </button>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="row tabular dim" style={{ justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>{completedSteps}/{totalSteps} steps</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            style={{
              height: 4,
              background: 'var(--surface-2)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: accentFg,
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--info-soft)',
                color: 'var(--info)',
                border: '1px solid var(--info-edge)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <FlaskConical size={16} />
            </span>
            <div>
              <div className="modal-title">Test execution (live)</div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{testName}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 2 }}>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="icon-btn"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button type="button" onClick={onClose} className="icon-btn" title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="modal-body col" style={{ gap: 16, overflowY: 'auto' }}>
          {/* Overall progress */}
          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                Overall progress: <span className="tabular">{completedSteps}/{totalSteps}</span> steps
              </span>
              <span className="tabular" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                background: 'var(--surface-2)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: accentFg,
                  transition: 'width .3s ease',
                }}
              />
            </div>
          </div>

          {/* Current step */}
          {currentStep && (
            <div
              style={{
                background: 'var(--info-soft)',
                border: '1px solid var(--info-edge)',
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--info)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)' }}>
                  Current step
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink)' }}>
                Step {currentStep.stepIndex + 1}: {currentStep.description}
              </p>
            </div>
          )}

          {/* Steps list */}
          <div>
            <div
              className="dim"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Execution steps
            </div>
            {executionResult.steps.length === 0 ? (
              <div className="empty" style={{ padding: '24px 12px' }}>
                <div className="empty-icon">
                  <Loader2 size={18} className="animate-spin" />
                </div>
                <p>Initializing test execution…</p>
              </div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {executionResult.steps.map((step, index) => {
                  let bg = 'var(--surface-2)';
                  let border = 'var(--hair)';
                  if (step.status === 'passed') {
                    bg = 'var(--moss-soft)';
                    border = 'var(--moss-edge)';
                  } else if (step.status === 'failed') {
                    bg = 'var(--clay-soft)';
                    border = 'var(--clay-edge)';
                  } else if (step.status === 'running') {
                    bg = 'var(--info-soft)';
                    border = 'var(--info-edge)';
                  }
                  return (
                    <div
                      key={index}
                      style={{
                        padding: 10,
                        borderRadius: 6,
                        border: `1px solid ${border}`,
                        background: bg,
                      }}
                    >
                      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background:
                              step.status === 'passed'
                                ? 'var(--moss)'
                                : step.status === 'failed'
                                ? 'var(--clay)'
                                : step.status === 'running'
                                ? 'var(--info)'
                                : 'var(--surface-2)',
                            color:
                              step.status === 'pending' ? 'var(--ink-3)' : '#fff',
                            border:
                              step.status === 'pending'
                                ? '1px solid var(--hair)'
                                : 'none',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {step.status === 'passed' ? (
                            <CheckCircle2 size={12} />
                          ) : step.status === 'failed' ? (
                            <XCircle size={12} />
                          ) : step.status === 'running' ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span className="tabular" style={{ fontSize: 10, fontWeight: 600 }}>
                              {step.stepIndex + 1}
                            </span>
                          )}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: 'var(--ink)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Step {step.stepIndex + 1}: {step.description}
                          </p>
                          {step.error && (
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--clay)' }}>
                              Error: {step.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Final result */}
          {executionResult.status !== 'running' && (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background:
                  executionResult.status === 'passed' ? 'var(--moss-soft)' : 'var(--clay-soft)',
                border: `1px solid ${
                  executionResult.status === 'passed' ? 'var(--moss-edge)' : 'var(--clay-edge)'
                }`,
              }}
            >
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                {executionResult.status === 'passed' ? (
                  <CheckCircle2 size={20} style={{ color: 'var(--moss)', flexShrink: 0 }} />
                ) : (
                  <XCircle size={20} style={{ color: 'var(--clay)', flexShrink: 0 }} />
                )}
                <div>
                  <div
                    style={{
                      fontFamily: 'Inter Tight',
                      fontSize: 14,
                      fontWeight: 600,
                      color:
                        executionResult.status === 'passed' ? 'var(--moss)' : 'var(--clay)',
                    }}
                  >
                    Test {executionResult.status === 'passed' ? 'passed' : 'failed'}
                  </div>
                  {executionResult.duration && (
                    <p className="dim" style={{ margin: '2px 0 0', fontSize: 11.5 }}>
                      Duration: {(executionResult.duration / 1000).toFixed(2)}s
                    </p>
                  )}
                  {executionResult.error && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--clay)' }}>
                      Error: {executionResult.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {executionResult.status !== 'running' && (
          <div className="modal-foot">
            <button type="button" onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
