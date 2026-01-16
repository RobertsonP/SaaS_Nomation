import { useState, useCallback, useRef, useEffect } from 'react'
import { executionAPI } from '../lib/api'
import { ExecutionResult, getErrorMessage } from '../types/api.types'
import { createLogger } from '../lib/logger'

const logger = createLogger('useTestExecution')

export interface ExecutionStatus {
  jobId: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown'
  progress: number
  result?: ExecutionResult
  error?: string
  position?: number // Initial position when queued
}

export function useTestExecution() {
  const [executionState, setExecutionState] = useState<ExecutionStatus | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const pollStatus = useCallback(async (jobId: string, onComplete?: (result: ExecutionResult) => void) => {
    try {
      const response = await executionAPI.getJobStatus(jobId)
      
      if (!response.data.success) {
        logger.warn('Job status check failed', response.data.error)
        return
      }

      const job = response.data.job

      if (!job) {
        logger.error('Job not found', jobId)
        stopPolling()
        setIsExecuting(false)
        setExecutionState(prev => prev ? { ...prev, status: 'failed', error: 'Job not found' } : null)
        return
      }

      setExecutionState(prevState => ({
        ...prevState,
        jobId,
        status: job.state,
        progress: job.progress,
        // Keep original position if we have it, as backend doesn't return dynamic position
        position: prevState?.position, 
        result: job.returnValue,
        error: job.failedReason
      }))

      if (job.state === 'completed' || job.state === 'failed') {
        stopPolling()
        setIsExecuting(false)
        if (job.state === 'completed' && onComplete) {
          onComplete(job.returnValue)
        }
      }
    } catch (error) {
      logger.error('Failed to poll job status', error)
      // Don't stop polling immediately on error, might be transient network issue
    }
  }, [stopPolling])

  const runTest = useCallback(async (testId: string, onComplete?: (result: ExecutionResult) => void) => {
    setIsExecuting(true)
    setExecutionState({
      jobId: '',
      status: 'waiting',
      progress: 0,
      position: 1
    })

    try {
      // Use runLive for higher priority in UI-triggered tests
      const response = await executionAPI.runLive(testId)

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to queue test')
      }

      const { jobId, position } = response.data

      setExecutionState({
        jobId,
        status: 'waiting',
        progress: 0,
        position
      })

      // Start polling
      stopPolling() // Clear any existing poll
      pollIntervalRef.current = setInterval(() => pollStatus(jobId, onComplete), 1000)

    } catch (error: unknown) {
      logger.error('Failed to start test', error)
      setExecutionState({
        jobId: '',
        status: 'failed',
        progress: 0,
        error: getErrorMessage(error)
      })
      setIsExecuting(false)
    }
  }, [pollStatus, stopPolling])

  const cancelExecution = useCallback(async () => {
    if (executionState?.jobId) {
      try {
        await executionAPI.stop(executionState.jobId) // Or use the cancel endpoint if specific
        stopPolling()
        setIsExecuting(false)
        setExecutionState(prev => prev ? { ...prev, status: 'failed', error: 'Cancelled by user' } : null)
      } catch (error) {
        logger.error('Failed to cancel execution', error)
      }
    }
  }, [executionState?.jobId, stopPolling])

  return {
    runTest,
    executionState,
    isExecuting,
    stopPolling,
    cancelExecution
  }
}
