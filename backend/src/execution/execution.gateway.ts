import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

export interface ExecutionProgressEvent {
  executionId: string;
  testId?: string;
  suiteId?: string;
  type: 'test' | 'suite' | 'step' | 'step:retry';
  status: 'started' | 'progress' | 'completed' | 'failed' | 'error' | 'retrying';
  message: string;
  details?: any;
  timestamp: Date;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/execution-progress',
})
export class ExecutionProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientExecutionMap = new Map<string, string>(); // socketId -> executionId

  handleConnection(client: Socket) {
    console.log(`✅ Execution WebSocket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Execution WebSocket client disconnected: ${client.id}`);
    this.clientExecutionMap.delete(client.id);
  }

  // Handle WebSocket subscription event from frontend
  @SubscribeMessage('subscribe-to-execution')
  handleSubscribeToExecution(client: Socket, executionId: string) {
    this.subscribeToExecution(client.id, executionId);
    // Join execution-specific room
    client.join(`execution-${executionId}`);

    // Send acknowledgment back to client
    client.emit('subscription-confirmed', {
      executionId,
      message: `Subscribed to execution ${executionId}`
    });
  }

  // Subscribe client to execution updates
  subscribeToExecution(clientId: string, executionId: string) {
    this.clientExecutionMap.set(clientId, executionId);
    console.log(`📺 Client ${clientId} subscribed to execution ${executionId}`);
  }

  // Send progress update to all clients watching this execution
  sendProgressUpdate(event: ExecutionProgressEvent) {
    console.log(`📡 Broadcasting execution progress: ${event.type} - ${event.message}`);

    // Send to all clients watching this execution
    this.clientExecutionMap.forEach((watchedExecutionId, clientId) => {
      if (watchedExecutionId === event.executionId) {
        this.server.to(clientId).emit('execution-progress', event);
      }
    });

    // Also send to execution-specific room
    this.server.to(`execution-${event.executionId}`).emit('execution-progress', event);
  }

  // ============================================================================
  // CONVENIENCE METHODS: Test Execution
  // ============================================================================

  sendTestStarted(executionId: string, testId: string, testName: string) {
    this.sendProgressUpdate({
      executionId,
      testId,
      type: 'test',
      status: 'started',
      message: `Starting test: ${testName}`,
      details: { testId, testName },
      timestamp: new Date(),
    });
  }

  sendTestCompleted(executionId: string, testId: string, testName: string, duration: number) {
    this.sendProgressUpdate({
      executionId,
      testId,
      type: 'test',
      status: 'completed',
      message: `Test passed: ${testName}`,
      details: { testId, testName, duration },
      timestamp: new Date(),
    });
  }

  sendTestFailed(executionId: string, testId: string, testName: string, error: string) {
    this.sendProgressUpdate({
      executionId,
      testId,
      type: 'test',
      status: 'failed',
      message: `Test failed: ${testName}`,
      details: { testId, testName, error },
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // CONVENIENCE METHODS: Suite Execution
  // ============================================================================

  sendSuiteStarted(executionId: string, suiteId: string, suiteName: string, totalTests: number) {
    this.sendProgressUpdate({
      executionId,
      suiteId,
      type: 'suite',
      status: 'started',
      message: `Starting suite: ${suiteName} (${totalTests} tests)`,
      details: { suiteId, suiteName, totalTests },
      timestamp: new Date(),
      progress: {
        current: 0,
        total: totalTests,
        percentage: 0,
      },
    });
  }

  sendSuiteProgress(executionId: string, suiteId: string, current: number, total: number, currentTestName: string) {
    this.sendProgressUpdate({
      executionId,
      suiteId,
      type: 'suite',
      status: 'progress',
      message: `Running test ${current}/${total}: ${currentTestName}`,
      details: { suiteId, currentTestName },
      timestamp: new Date(),
      progress: {
        current,
        total,
        percentage: Math.round((current / total) * 100),
      },
    });
  }

  sendSuiteCompleted(executionId: string, suiteId: string, suiteName: string, passed: number, failed: number) {
    this.sendProgressUpdate({
      executionId,
      suiteId,
      type: 'suite',
      status: 'completed',
      message: `Suite completed: ${suiteName} (${passed} passed, ${failed} failed)`,
      details: { suiteId, suiteName, passed, failed },
      timestamp: new Date(),
    });
  }

  sendSuiteFailed(executionId: string, suiteId: string, suiteName: string, error: string) {
    this.sendProgressUpdate({
      executionId,
      suiteId,
      type: 'suite',
      status: 'error',
      message: `Suite failed: ${suiteName}`,
      details: { suiteId, suiteName, error },
      timestamp: new Date(),
    });
  }

  // ============================================================================
  // CONVENIENCE METHODS: Step Execution
  // ============================================================================

  sendStepStarted(executionId: string, stepIndex: number, totalSteps: number, stepDescription: string) {
    this.sendProgressUpdate({
      executionId,
      type: 'step',
      status: 'started',
      message: `Step ${stepIndex + 1}/${totalSteps}: ${stepDescription}`,
      details: { stepIndex, totalSteps, stepDescription },
      timestamp: new Date(),
      progress: {
        current: stepIndex + 1,
        total: totalSteps,
        percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
      },
    });
  }

  sendStepCompleted(executionId: string, stepIndex: number, totalSteps: number, stepDescription: string) {
    this.sendProgressUpdate({
      executionId,
      type: 'step',
      status: 'completed',
      message: `Completed step ${stepIndex + 1}/${totalSteps}: ${stepDescription}`,
      details: { stepIndex, totalSteps, stepDescription },
      timestamp: new Date(),
      progress: {
        current: stepIndex + 1,
        total: totalSteps,
        percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
      },
    });
  }

  sendStepFailed(executionId: string, stepIndex: number, totalSteps: number, stepDescription: string, error: string) {
    this.sendProgressUpdate({
      executionId,
      type: 'step',
      status: 'failed',
      message: `Failed at step ${stepIndex + 1}/${totalSteps}: ${stepDescription}`,
      details: { stepIndex, totalSteps, stepDescription, error },
      timestamp: new Date(),
      progress: {
        current: stepIndex + 1,
        total: totalSteps,
        percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
      },
    });
  }

  sendStepRetry(executionId: string, stepIndex: number, totalSteps: number, stepDescription: string, attempt: number, maxAttempts: number, errorReason: string, errorCategory: string) {
    this.sendProgressUpdate({
      executionId,
      type: 'step:retry',
      status: 'retrying',
      message: `Retrying step ${stepIndex + 1}/${totalSteps}: ${stepDescription} (Attempt ${attempt}/${maxAttempts})`,
      details: {
        stepIndex,
        totalSteps,
        stepDescription,
        attempt,
        maxAttempts,
        errorReason,
        errorCategory
      },
      timestamp: new Date(),
      progress: {
        current: stepIndex + 1,
        total: totalSteps,
        percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
      },
    });
  }

  // ============================================================================
  // DIRECT EVENT METHODS (for LiveExecutionViewer frontend compatibility)
  // These emit specific event names that the frontend listens for
  // ============================================================================

  /**
   * Emit execution-queued event to frontend
   */
  sendExecutionQueued(executionId: string, position: number, jobId?: string) {
    console.log(`📡 [LIVE] Execution queued: ${executionId}, position: ${position}`);
    this.server.to(`execution-${executionId}`).emit('execution-queued', {
      jobId: jobId || executionId,
      position
    });
  }

  /**
   * Emit execution-started event to frontend
   */
  sendExecutionStartedEvent(executionId: string, totalSteps: number, testName?: string) {
    console.log(`📡 [LIVE] Execution started: ${executionId}, totalSteps: ${totalSteps}`);
    this.server.to(`execution-${executionId}`).emit('execution-started', {
      jobId: executionId,
      executionId,
      totalSteps,
      testName
    });
  }

  /**
   * Emit step-started event to frontend (LiveExecutionViewer compatible)
   */
  sendStepStartedEvent(executionId: string, stepIndex: number, step: any) {
    console.log(`📡 [LIVE] Step ${stepIndex + 1} started: ${step?.description || step?.type || 'unknown'}`);
    this.server.to(`execution-${executionId}`).emit('step-started', {
      stepIndex,
      step: {
        id: step?.id || `step-${stepIndex}`,
        type: step?.type || 'unknown',
        selector: step?.selector || '',
        value: step?.value,
        description: step?.description || `Step ${stepIndex + 1}`
      }
    });
  }

  /**
   * Emit step-completed event to frontend (LiveExecutionViewer compatible)
   */
  sendStepCompletedEvent(executionId: string, stepIndex: number, status: 'passed' | 'failed', screenshot?: string, error?: string, duration?: number) {
    console.log(`📡 [LIVE] Step ${stepIndex + 1} completed: ${status}`);
    this.server.to(`execution-${executionId}`).emit('step-completed', {
      stepIndex,
      status,
      screenshot,
      error,
      duration
    });
  }

  /**
   * Emit viewport-update event to frontend (for live browser view)
   */
  sendViewportUpdate(executionId: string, screenshot: string, viewport?: { width: number; height: number; url: string }) {
    this.server.to(`execution-${executionId}`).emit('viewport-update', {
      screenshot,
      viewport
    });
  }

  /**
   * Emit execution-completed event to frontend
   */
  sendExecutionCompletedEvent(executionId: string, status: 'passed' | 'failed', duration: number, results?: any[]) {
    console.log(`📡 [LIVE] Execution completed: ${executionId}, status: ${status}`);
    this.server.to(`execution-${executionId}`).emit('execution-completed', {
      status,
      duration,
      results: results || []
    });
  }

  /**
   * Emit execution-failed event to frontend
   */
  sendExecutionFailedEvent(executionId: string, error: string, duration?: number) {
    console.log(`📡 [LIVE] Execution failed: ${executionId}, error: ${error}`);
    this.server.to(`execution-${executionId}`).emit('execution-failed', {
      error,
      duration
    });
  }
}
