// Analytics service for tracking user behavior and feature usage
import { createLogger } from './logger';

const logger = createLogger('Analytics');

interface AnalyticsEvent {
  event: string
  category: string
  action: string
  label?: string
  value?: number
  properties?: Record<string, any>
}

class AnalyticsService {
  private isEnabled: boolean
  private events: AnalyticsEvent[] = []

  constructor() {
    // Enable analytics in production only
    this.isEnabled = import.meta.env.PROD
    logger.debug(`Analytics ${this.isEnabled ? 'enabled' : 'disabled (development mode)'}`)
  }

  // Track custom events
  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      category: 'user_action',
      action: event,
      properties: {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...properties
      }
    }

    this.events.push(analyticsEvent)

    if (this.isEnabled) {
      // Send to Google Analytics if available
      if (window.gtag) {
        window.gtag('event', event, {
          event_category: analyticsEvent.category,
          event_label: analyticsEvent.label,
          value: analyticsEvent.value,
          custom_map: analyticsEvent.properties
        })
      }

      // Log for debugging
      logger.debug('Analytics event', analyticsEvent)
    } else {
      logger.debug('Analytics event (dev mode)', analyticsEvent)
    }
  }

  // Track page views
  trackPageView(page: string, title?: string) {
    this.track('page_view', {
      page,
      title: title || document.title
    })
  }

  // Track revolutionary features
  trackProjectUpload(framework: string, fileCount: number, elementCount: number) {
    this.track('project_upload', {
      framework,
      file_count: fileCount,
      element_count: elementCount,
      feature_type: 'revolutionary'
    })
  }

  trackElementHunting(projectId: string, stepCount: number, elementsFound: number) {
    this.track('hunt_elements', {
      project_id: projectId,
      step_count: stepCount,
      elements_found: elementsFound,
      feature_type: 'core'
    })
  }

  trackTestExecution(testType: 'individual' | 'suite', status: 'passed' | 'failed', duration?: number) {
    this.track('test_execution', {
      test_type: testType,
      status,
      duration_ms: duration,
      feature_type: 'core'
    })
  }

  trackRobotFrameworkResults(testId: string, stepCount: number, passRate: number) {
    this.track('robot_framework_results', {
      test_id: testId,
      step_count: stepCount,
      pass_rate: passRate,
      feature_type: 'enhanced'
    })
  }

  // Track user engagement
  trackFeatureUsage(feature: string, details?: Record<string, any>) {
    this.track('feature_usage', {
      feature,
      ...details
    })
  }

  trackError(error: string, context?: string) {
    this.track('error', {
      error_message: error,
      context,
      severity: 'error'
    })
  }

  // Performance tracking
  trackPerformance(metric: string, value: number, unit: string = 'ms') {
    this.track('performance', {
      metric,
      value,
      unit
    })
  }

  // Competitive advantage tracking
  trackCompetitiveFeature(feature: 'local_development' | 'source_analysis' | 'robot_results') {
    this.track('competitive_feature', {
      feature,
      advantage_type: 'revolutionary'
    })
  }

  // Get analytics data (for dashboards)
  getEvents(): AnalyticsEvent[] {
    return [...this.events]
  }

  getEventsByCategory(category: string): AnalyticsEvent[] {
    return this.events.filter(event => event.category === category)
  }

  // Clear events (for privacy)
  clearEvents() {
    this.events = []
  }

  // Export data (for analysis)
  exportEvents(): string {
    return JSON.stringify(this.events, null, 2)
  }
}

// Global analytics instance
export const analytics = new AnalyticsService()

// Convenience hooks for React components
export const useAnalytics = () => {
  return {
    track: analytics.track.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackProjectUpload: analytics.trackProjectUpload.bind(analytics),
    trackElementHunting: analytics.trackElementHunting.bind(analytics),
    trackTestExecution: analytics.trackTestExecution.bind(analytics),
    trackRobotFrameworkResults: analytics.trackRobotFrameworkResults.bind(analytics),
    trackFeatureUsage: analytics.trackFeatureUsage.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackPerformance: analytics.trackPerformance.bind(analytics),
    trackCompetitiveFeature: analytics.trackCompetitiveFeature.bind(analytics)
  }
}

// Type declarations for global gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void
  }
}