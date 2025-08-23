// Comprehensive validation utilities for testing user journeys
import { api } from './api';

interface ValidationResult {
  success: boolean
  message: string
  details?: any
  duration?: number
}

interface UserJourneyStep {
  name: string
  action: () => Promise<ValidationResult>
  timeout: number
  required: boolean
}

class ValidationService {
  private results: ValidationResult[] = []

  // Validate API endpoints
  async validateApiEndpoint(
    url: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<ValidationResult> {
    const startTime = performance.now()
    
    try {
      const response = await api.request({
        url,
        method,
        data: body
      })

      const duration = performance.now() - startTime
      
      return {
        success: true,
        message: `${method} ${url} - Success (${response.status})`,
        duration,
        details: {
          status: response.status,
          data: response.data
        }
      }
    } catch (error: any) {
      const duration = performance.now() - startTime
      return {
        success: false,
        message: `${method} ${url} - Error: ${error.response?.status || 'Network Error'}`,
        duration,
        details: { 
          status: error.response?.status,
          error: error.message,
          data: error.response?.data
        }
      }
    }
  }

  // Validate project upload workflow
  async validateProjectUpload(): Promise<ValidationResult> {
    try {
      // Test file upload endpoint
      const uploadTest = await this.validateApiEndpoint('/api/projects/test-id/elements', 'POST', {
        elements: [{
          selector: 'button.test',
          elementType: 'button',
          description: 'Test button',
          confidence: 0.95
        }]
      })

      if (!uploadTest.success) {
        return {
          success: false,
          message: 'Project upload API validation failed',
          details: uploadTest
        }
      }

      return {
        success: true,
        message: 'Project upload workflow validated successfully'
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Project upload validation error: ${error.message}`,
        details: { error: error.message }
      }
    }
  }

  // Validate hunt elements workflow
  async validateHuntElements(): Promise<ValidationResult> {
    try {
      const huntTest = await this.validateApiEndpoint('/api/projects/test-id/hunt-elements', 'POST', {
        steps: [
          { type: 'click', selector: 'button', description: 'Test click' }
        ],
        testId: 'test-hunt'
      })

      return {
        success: huntTest.success,
        message: huntTest.success 
          ? 'Hunt elements workflow validated successfully'
          : 'Hunt elements workflow validation failed',
        details: huntTest
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Hunt elements validation error: ${error.message}`,
        details: { error: error.message }
      }
    }
  }

  // Validate test execution workflow
  async validateTestExecution(): Promise<ValidationResult> {
    try {
      // Check test creation endpoint
      const createTest = await this.validateApiEndpoint('/api/tests', 'POST', {
        name: 'Validation Test',
        projectId: 'test-project',
        steps: [],
        startingUrl: 'http://localhost:3000'
      })

      return {
        success: createTest.success,
        message: createTest.success 
          ? 'Test execution workflow validated successfully'
          : 'Test execution workflow validation failed',
        details: createTest
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Test execution validation error: ${error.message}`,
        details: { error: error.message }
      }
    }
  }

  // Validate complete user journey
  async validateCompleteUserJourney(): Promise<ValidationResult[]> {
    const steps: UserJourneyStep[] = [
      {
        name: 'API Health Check',
        action: () => this.validateApiEndpoint('/api/health', 'GET'),
        timeout: 5000,
        required: true
      },
      {
        name: 'Authentication',
        action: () => this.validateApiEndpoint('/api/auth/profile', 'GET'),
        timeout: 5000,
        required: true
      },
      {
        name: 'Projects List',
        action: () => this.validateApiEndpoint('/api/projects', 'GET'),
        timeout: 5000,
        required: true
      },
      {
        name: 'Project Upload',
        action: () => this.validateProjectUpload(),
        timeout: 10000,
        required: false
      },
      {
        name: 'Hunt Elements',
        action: () => this.validateHuntElements(),
        timeout: 15000,
        required: false
      },
      {
        name: 'Test Creation',
        action: () => this.validateTestExecution(),
        timeout: 10000,
        required: false
      }
    ]

    const results: ValidationResult[] = []

    for (const step of steps) {
      console.log(`🧪 Validating: ${step.name}`)
      
      try {
        const result = await Promise.race([
          step.action(),
          new Promise<ValidationResult>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), step.timeout)
          )
        ])

        results.push({
          ...result,
          message: `${step.name}: ${result.message}`
        })

        // If required step fails, stop validation
        if (step.required && !result.success) {
          console.error(`❌ Required step failed: ${step.name}`)
          break
        }

        console.log(result.success ? `✅ ${step.name}` : `⚠️ ${step.name}`)
      } catch (error: any) {
        const result = {
          success: false,
          message: `${step.name}: Timeout or error - ${error.message}`,
          details: { error: error.message }
        }

        results.push(result)
        
        if (step.required) {
          console.error(`❌ Required step timed out: ${step.name}`)
          break
        }
        
        console.log(`⚠️ ${step.name} (timeout)`)
      }
    }

    this.results = results
    return results
  }

  // Browser compatibility check
  async validateBrowserCompatibility(): Promise<ValidationResult> {
    const features = {
      'File API': 'File' in window,
      'Drag and Drop': 'ondrop' in document.createElement('div'),
      'Local Storage': 'localStorage' in window,
      'Fetch API': 'fetch' in window,
      'WebSocket': 'WebSocket' in window,
      'Performance API': 'performance' in window,
      'ES6 Support': (() => {
        try {
          eval('const test = () => {}')
          return true
        } catch {
          return false
        }
      })()
    }

    const unsupported = Object.entries(features)
      .filter(([, supported]) => !supported)
      .map(([feature]) => feature)

    const compatibility = {
      userAgent: navigator.userAgent,
      supported: unsupported.length === 0,
      unsupportedFeatures: unsupported,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink
      } : null
    }

    return {
      success: compatibility.supported,
      message: compatibility.supported 
        ? 'Browser compatibility check passed'
        : `Browser compatibility issues: ${unsupported.join(', ')}`,
      details: compatibility
    }
  }

  // Performance validation
  async validatePerformance(): Promise<ValidationResult> {
    const metrics = {
      loadTime: performance.now(),
      memory: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      timing: performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    }

    const issues = []
    
    if (metrics.loadTime > 5000) {
      issues.push('Slow page load time')
    }
    
    if (metrics.memory && metrics.memory.used > 100) {
      issues.push('High memory usage')
    }

    return {
      success: issues.length === 0,
      message: issues.length === 0 
        ? 'Performance validation passed'
        : `Performance issues: ${issues.join(', ')}`,
      details: metrics
    }
  }

  // Generate validation report
  generateReport(): {
    summary: {
      total: number
      passed: number
      failed: number
      passRate: number
    }
    results: ValidationResult[]
    recommendations: string[]
  } {
    const total = this.results.length
    const passed = this.results.filter(r => r.success).length
    const failed = total - passed
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    const recommendations = []
    
    if (passRate < 100) {
      recommendations.push('Review failed validations and fix underlying issues')
    }
    
    if (failed > 0) {
      recommendations.push('Monitor error logs for recurring issues')
    }

    const slowResults = this.results.filter(r => r.duration && r.duration > 2000)
    if (slowResults.length > 0) {
      recommendations.push('Optimize slow operations for better user experience')
    }

    return {
      summary: { total, passed, failed, passRate },
      results: this.results,
      recommendations
    }
  }
}

// Global validation service
export const validationService = new ValidationService()

// React hook for validation
export const useValidation = () => {
  return {
    validateApiEndpoint: validationService.validateApiEndpoint.bind(validationService),
    validateProjectUpload: validationService.validateProjectUpload.bind(validationService),
    validateHuntElements: validationService.validateHuntElements.bind(validationService),
    validateTestExecution: validationService.validateTestExecution.bind(validationService),
    validateCompleteUserJourney: validationService.validateCompleteUserJourney.bind(validationService),
    validateBrowserCompatibility: validationService.validateBrowserCompatibility.bind(validationService),
    validatePerformance: validationService.validatePerformance.bind(validationService),
    generateReport: validationService.generateReport.bind(validationService)
  }
}