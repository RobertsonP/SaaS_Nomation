// Performance monitoring utilities
import { createLogger } from './logger';

const logger = createLogger('PerformanceMonitor');

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  context?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()

  // Start timing an operation
  startTimer(name: string, context?: Record<string, any>) {
    this.timers.set(name, performance.now())
    logger.debug(`Started timer: ${name}`)
  }

  // End timing and record metric
  endTimer(name: string, context?: Record<string, any>): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn(`Timer ${name} was not started`)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(name)

    this.recordMetric(name, duration, 'ms', context)
    logger.debug(`Completed timer: ${name} - ${duration.toFixed(2)}ms`)
    
    return duration
  }

  // Record any performance metric
  recordMetric(name: string, value: number, unit: string = 'ms', context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context
    }

    this.metrics.push(metric)

    // Log slow operations
    if (unit === 'ms' && value > 1000) {
      logger.warn(`Slow operation detected: ${name} took ${value.toFixed(2)}ms`)
    }
  }

  // Memory usage monitoring
  recordMemoryUsage(context?: string) {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.recordMetric(
        'memory_usage',
        memory.usedJSHeapSize / 1024 / 1024,
        'MB',
        {
          total: memory.totalJSHeapSize / 1024 / 1024,
          limit: memory.jsHeapSizeLimit / 1024 / 1024,
          context
        }
      )
    }
  }

  // File processing performance
  measureFileProcessing<T>(
    operation: () => Promise<T>,
    fileName: string,
    fileSize: number
  ): Promise<T> {
    const timerName = `file_processing_${fileName}`
    
    return new Promise(async (resolve, reject) => {
      this.startTimer(timerName, { fileName, fileSize })
      
      try {
        const result = await operation()
        const duration = this.endTimer(timerName)
        
        // Calculate processing rate
        const mbPerSecond = (fileSize / 1024 / 1024) / (duration / 1000)
        this.recordMetric('file_processing_rate', mbPerSecond, 'MB/s', { fileName })
        
        resolve(result)
      } catch (error) {
        this.endTimer(timerName)
        reject(error)
      }
    })
  }

  // Project analysis performance
  measureProjectAnalysis<T>(
    operation: () => Promise<T>,
    fileCount: number,
    framework: string
  ): Promise<T> {
    const timerName = 'project_analysis'
    
    return new Promise(async (resolve, reject) => {
      this.startTimer(timerName, { fileCount, framework })
      this.recordMemoryUsage('analysis_start')
      
      try {
        const result = await operation()
        const duration = this.endTimer(timerName)
        this.recordMemoryUsage('analysis_end')
        
        // Calculate analysis rate
        const filesPerSecond = fileCount / (duration / 1000)
        this.recordMetric('analysis_rate', filesPerSecond, 'files/s', { framework })
        
        resolve(result)
      } catch (error) {
        this.endTimer(timerName)
        this.recordMemoryUsage('analysis_error')
        reject(error)
      }
    })
  }

  // API request performance
  measureApiRequest<T>(
    operation: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> {
    const timerName = `api_${method}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`
    
    return new Promise(async (resolve, reject) => {
      this.startTimer(timerName, { endpoint, method })
      
      try {
        const result = await operation()
        this.endTimer(timerName)
        resolve(result)
      } catch (error) {
        this.endTimer(timerName)
        this.recordMetric('api_error', 1, 'count', { endpoint, method })
        reject(error)
      }
    })
  }

  // Get performance report
  getReport(): {
    metrics: PerformanceMetric[]
    summary: {
      totalOperations: number
      averageTime: number
      slowestOperation: PerformanceMetric | null
      memoryPeak: number
    }
  } {
    const timeMetrics = this.metrics.filter(m => m.unit === 'ms')
    const memoryMetrics = this.metrics.filter(m => m.name === 'memory_usage')
    
    return {
      metrics: this.metrics,
      summary: {
        totalOperations: timeMetrics.length,
        averageTime: timeMetrics.length > 0 
          ? timeMetrics.reduce((sum, m) => sum + m.value, 0) / timeMetrics.length 
          : 0,
        slowestOperation: timeMetrics.length > 0 
          ? timeMetrics.reduce((slowest, current) => 
              current.value > slowest.value ? current : slowest
            )
          : null,
        memoryPeak: memoryMetrics.length > 0 
          ? Math.max(...memoryMetrics.map(m => m.value))
          : 0
      }
    }
  }

  // Clear metrics (for memory management)
  clear() {
    this.metrics = []
    this.timers.clear()
  }

  // Export for analysis
  export(): string {
    return JSON.stringify(this.getReport(), null, 2)
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor()

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    startTimer: performanceMonitor.startTimer.bind(performanceMonitor),
    endTimer: performanceMonitor.endTimer.bind(performanceMonitor),
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    measureFileProcessing: performanceMonitor.measureFileProcessing.bind(performanceMonitor),
    measureProjectAnalysis: performanceMonitor.measureProjectAnalysis.bind(performanceMonitor),
    measureApiRequest: performanceMonitor.measureApiRequest.bind(performanceMonitor),
    getReport: performanceMonitor.getReport.bind(performanceMonitor)
  }
}