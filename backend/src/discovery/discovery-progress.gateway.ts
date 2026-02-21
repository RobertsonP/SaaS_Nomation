import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

export interface DiscoveryProgressEvent {
  projectId: string;
  phase: 'crawling' | 'sitemap' | 'filtering' | 'completed' | 'error';
  message: string;
  friendlyMessage?: string;
  urlsFound: number;
  currentDepth?: number;
  maxDepth?: number;
  timestamp: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/discovery-progress',
})
export class DiscoveryProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientProjectMap = new Map<string, string>();

  handleConnection(client: Socket) {
    // Silent — no console spam
  }

  handleDisconnect(client: Socket) {
    this.clientProjectMap.delete(client.id);
  }

  @SubscribeMessage('subscribe-to-project')
  handleSubscribeToProject(client: Socket, projectId: string) {
    this.clientProjectMap.set(client.id, projectId);
    client.join(`project-${projectId}`);
    client.emit('subscription-confirmed', { projectId });
  }

  sendProgress(event: DiscoveryProgressEvent) {
    if (!event.friendlyMessage) {
      event.friendlyMessage = this.getFriendlyMessage(event);
    }
    this.server.to(`project-${event.projectId}`).emit('discovery-progress', event);
  }

  sendStarted(projectId: string, message: string) {
    this.sendProgress({
      projectId,
      phase: 'crawling',
      message,
      friendlyMessage: 'Starting page discovery...',
      urlsFound: 0,
      timestamp: new Date(),
    });
  }

  sendUrlFound(projectId: string, urlsFound: number, currentDepth?: number, maxDepth?: number) {
    this.sendProgress({
      projectId,
      phase: 'crawling',
      message: `Found ${urlsFound} URLs`,
      friendlyMessage: `Discovering pages... ${urlsFound} found`,
      urlsFound,
      currentDepth,
      maxDepth,
      timestamp: new Date(),
    });
  }

  sendCompleted(projectId: string, urlsFound: number) {
    this.sendProgress({
      projectId,
      phase: 'completed',
      message: `Discovery complete: ${urlsFound} URLs found`,
      friendlyMessage: `Discovery complete! Found ${urlsFound} page${urlsFound !== 1 ? 's' : ''}`,
      urlsFound,
      timestamp: new Date(),
    });
  }

  sendError(projectId: string, message: string) {
    this.sendProgress({
      projectId,
      phase: 'error',
      message,
      friendlyMessage: message,
      urlsFound: 0,
      timestamp: new Date(),
    });
  }

  private getFriendlyMessage(event: DiscoveryProgressEvent): string {
    switch (event.phase) {
      case 'crawling':
        return event.urlsFound > 0
          ? `Discovering pages... ${event.urlsFound} found`
          : 'Starting page discovery...';
      case 'sitemap':
        return 'Checking sitemap...';
      case 'filtering':
        return 'Filtering discovered pages...';
      case 'completed':
        return `Discovery complete! Found ${event.urlsFound} page${event.urlsFound !== 1 ? 's' : ''}`;
      case 'error':
        return event.message;
      default:
        return event.message;
    }
  }
}
