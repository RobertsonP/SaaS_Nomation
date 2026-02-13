import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

export interface AnalysisProgressEvent {
  projectId: string;
  step: string;
  status: 'started' | 'progress' | 'completed' | 'error';
  message: string;
  /** User-friendly message for display (no technical jargon) */
  friendlyMessage?: string;
  details?: any;
  timestamp: Date;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

/** Map step names to user-friendly labels */
function getFriendlyMessage(step: string, message: string, status: string): string {
  if (step === 'initialization') {
    if (message.includes('Found')) return message;
    return 'Preparing analysis...';
  }
  if (step === 'auth_check') {
    if (message.includes('Found authentication')) return 'Authenticating...';
    if (message.includes('No authentication')) return 'No login needed, scanning directly...';
    return 'Checking authentication...';
  }
  if (step === 'authenticated_analysis' || step === 'standard_analysis') {
    const urlMatch = message.match(/URL (\d+)\/(\d+)/i) || message.match(/(\d+) of (\d+)/i);
    if (urlMatch) return `Scanning page ${urlMatch[1]} of ${urlMatch[2]}...`;
    if (status === 'started') return 'Scanning page elements...';
    if (status === 'completed') {
      const elemMatch = message.match(/(\d+) elements/);
      return elemMatch ? `Done! Found ${elemMatch[1]} elements` : 'Analysis complete!';
    }
    return 'Scanning page elements...';
  }
  if (step === 'element_extraction') {
    if (message.includes('Found')) return message;
    return 'Extracting elements...';
  }
  if (step === 'element_storage') {
    const elemMatch = message.match(/(\d+) elements/);
    return elemMatch ? `Saving ${elemMatch[1]} elements...` : 'Saving elements...';
  }
  if (step === 'analysis_completed') return 'Analysis complete!';
  if (step === 'analysis_error') return 'Analysis failed';
  return message;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/analysis-progress',
})
export class AnalysisProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientProjectMap = new Map<string, string>(); // socketId -> projectId

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.clientProjectMap.delete(client.id);
  }

  // Handle WebSocket subscription event from frontend
  @SubscribeMessage('subscribe-to-project')
  handleSubscribeToProject(client: Socket, projectId: string) {
    this.subscribeToProject(client.id, projectId);
    // Join project-specific room for additional broadcast method
    client.join(`project-${projectId}`);
    
    // Send acknowledgment back to client
    client.emit('subscription-confirmed', { 
      projectId, 
      message: `Subscribed to project ${projectId}` 
    });
  }

  // Subscribe client to project analysis updates
  subscribeToProject(clientId: string, projectId: string) {
    this.clientProjectMap.set(clientId, projectId);
    console.log(`Client ${clientId} subscribed to project ${projectId}`);
  }

  // Send progress update to all clients watching this project
  sendProgressUpdate(event: AnalysisProgressEvent) {
    // Add friendly message if not already set
    if (!event.friendlyMessage) {
      event.friendlyMessage = getFriendlyMessage(event.step, event.message, event.status);
    }

    console.log(`📡 Broadcasting progress: ${event.step} - ${event.friendlyMessage}`);

    // Send to project-specific room (clients join on subscribe)
    this.server.to(`project-${event.projectId}`).emit('analysis-progress', event);
  }

  // Convenience methods for different types of progress updates
  sendStarted(projectId: string, step: string, message: string, details?: any) {
    this.sendProgressUpdate({
      projectId,
      step,
      status: 'started',
      message,
      details,
      timestamp: new Date(),
    });
  }

  sendProgress(projectId: string, step: string, message: string, current: number, total: number, details?: any) {
    this.sendProgressUpdate({
      projectId,
      step,
      status: 'progress',
      message,
      details,
      timestamp: new Date(),
      progress: {
        current,
        total,
        percentage: Math.round((current / total) * 100),
      },
    });
  }

  sendCompleted(projectId: string, step: string, message: string, details?: any) {
    this.sendProgressUpdate({
      projectId,
      step,
      status: 'completed',
      message,
      details,
      timestamp: new Date(),
    });
  }

  sendError(projectId: string, step: string, message: string, error: any) {
    this.sendProgressUpdate({
      projectId,
      step,
      status: 'error',
      message,
      details: {
        error: error.message || error,
        stack: error.stack,
      },
      timestamp: new Date(),
    });
  }

}