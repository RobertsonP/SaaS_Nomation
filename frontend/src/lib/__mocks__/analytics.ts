/**
 * Mock Analytics for Jest tests
 * Bypasses import.meta.env usage
 */

class MockAnalyticsService {
  private events: unknown[] = [];

  track(_event: string, _properties?: Record<string, unknown>) {
    // No-op in tests
  }

  trackPageView(_page: string, _title?: string) {
    // No-op in tests
  }

  trackProjectUpload(_framework: string, _fileCount: number, _elementCount: number) {
    // No-op in tests
  }

  trackElementHunting(_projectId: string, _stepCount: number, _elementsFound: number) {
    // No-op in tests
  }

  trackTestExecution(_testType: 'individual' | 'suite', _status: 'passed' | 'failed', _duration?: number) {
    // No-op in tests
  }

  trackRobotFrameworkResults(_testId: string, _stepCount: number, _passRate: number) {
    // No-op in tests
  }

  trackFeatureUsage(_feature: string, _details?: Record<string, unknown>) {
    // No-op in tests
  }

  trackError(_error: string, _context?: string) {
    // No-op in tests
  }

  trackPerformance(_metric: string, _value: number, _unit?: string) {
    // No-op in tests
  }

  trackCompetitiveFeature(_feature: 'local_development' | 'source_analysis' | 'robot_results') {
    // No-op in tests
  }

  getEvents(): unknown[] {
    return [...this.events];
  }

  getEventsByCategory(_category: string): unknown[] {
    return [];
  }

  clearEvents() {
    this.events = [];
  }

  exportEvents(): string {
    return '[]';
  }
}

export const analytics = new MockAnalyticsService();

export const useAnalytics = () => ({
  track: jest.fn(),
  trackPageView: jest.fn(),
  trackProjectUpload: jest.fn(),
  trackElementHunting: jest.fn(),
  trackTestExecution: jest.fn(),
  trackRobotFrameworkResults: jest.fn(),
  trackFeatureUsage: jest.fn(),
  trackError: jest.fn(),
  trackPerformance: jest.fn(),
  trackCompetitiveFeature: jest.fn(),
});
