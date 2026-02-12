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
    console.log(`📡 Broadcasting progress: ${event.step} - ${event.message}`);

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