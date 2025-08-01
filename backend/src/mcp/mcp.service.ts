import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

@Injectable()
export class McpService implements OnModuleInit, OnModuleDestroy {
  private runningServers = new Map<string, ChildProcess>();
  private config: McpConfig;
  private isInitialized = false;

  constructor() {
    this.loadConfig();
  }

  async onModuleInit() {
    console.log('🔧 Initializing MCP Service...');
    await this.initializeMcpServers();
    this.isInitialized = true;
  }

  async onModuleDestroy() {
    console.log('🛑 Shutting down MCP Service...');
    await this.stopAllServers();
  }

  private loadConfig() {
    try {
      const configPath = join(process.cwd(), 'mcp.config.json');
      const configContent = readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configContent);
      console.log('✅ MCP configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load MCP configuration:', error);
      this.config = { mcpServers: {} };
    }
  }

  private async initializeMcpServers() {
    const serverNames = Object.keys(this.config.mcpServers);
    
    if (serverNames.length === 0) {
      console.log('⚠️  No MCP servers configured');
      return;
    }

    console.log(`🚀 Starting ${serverNames.length} MCP servers...`);
    
    for (const serverName of serverNames) {
      try {
        await this.startServer(serverName);
        console.log(`✅ Started MCP server: ${serverName}`);
      } catch (error) {
        console.error(`❌ Failed to start MCP server ${serverName}:`, error);
      }
    }
  }

  private async startServer(serverName: string): Promise<void> {
    const serverConfig = this.config.mcpServers[serverName];
    if (!serverConfig) {
      throw new Error(`Server configuration not found for: ${serverName}`);
    }

    return new Promise((resolve, reject) => {
      const childProcess = spawn(serverConfig.command, serverConfig.args, {
        env: { ...process.env, ...serverConfig.env },
        stdio: ['inherit', 'pipe', 'pipe']
      });

      // Handle server output
      childProcess.stdout.on('data', (data) => {
        console.log(`[${serverName}] ${data.toString().trim()}`);
      });

      childProcess.stderr.on('data', (data) => {
        console.error(`[${serverName}] ERROR: ${data.toString().trim()}`);
      });

      childProcess.on('close', (code) => {
        console.log(`[${serverName}] Process exited with code ${code}`);
        this.runningServers.delete(serverName);
      });

      childProcess.on('error', (error) => {
        console.error(`[${serverName}] Failed to start: ${error.message}`);
        this.runningServers.delete(serverName);
        reject(error);
      });

      // Consider the server started if it doesn't error immediately
      setTimeout(() => {
        if (!childProcess.killed) {
          this.runningServers.set(serverName, childProcess);
          resolve();
        }
      }, 2000);
    });
  }

  private async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.runningServers.entries()).map(
      ([serverName, process]) => this.stopServer(serverName)
    );

    await Promise.all(stopPromises);
  }

  private async stopServer(serverName: string): Promise<void> {
    const process = this.runningServers.get(serverName);
    if (!process) {
      return;
    }

    return new Promise((resolve) => {
      process.once('close', () => {
        this.runningServers.delete(serverName);
        resolve();
      });

      process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  // Public methods for managing MCP servers
  async restartServer(serverName: string): Promise<void> {
    console.log(`🔄 Restarting MCP server: ${serverName}`);
    await this.stopServer(serverName);
    await this.startServer(serverName);
  }

  getServerStatus(serverName?: string): Record<string, any> {
    if (serverName) {
      const process = this.runningServers.get(serverName);
      return {
        [serverName]: {
          status: process && !process.killed ? 'running' : 'stopped',
          pid: process?.pid || null
        }
      };
    }

    const status: Record<string, any> = {};
    for (const [name, process] of this.runningServers) {
      status[name] = {
        status: process && !process.killed ? 'running' : 'stopped',
        pid: process?.pid || null
      };
    }

    return status;
  }

  isServerRunning(serverName: string): boolean {
    const process = this.runningServers.get(serverName);
    return process && !process.killed;
  }

  getAvailableServers(): string[] {
    return Object.keys(this.config.mcpServers);
  }

  getServerConfig(serverName: string): McpServerConfig | undefined {
    return this.config.mcpServers[serverName];
  }

  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; servers: Record<string, any> }> {
    const servers = this.getServerStatus();
    const allServersRunning = Object.values(servers).every(
      (server: any) => server.status === 'running'
    );

    return {
      status: allServersRunning ? 'healthy' : 'degraded',
      servers
    };
  }

  // Method to execute MCP tool calls (placeholder for future implementation)
  async executeTool(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.isServerRunning(serverName)) {
      throw new Error(`MCP server ${serverName} is not running`);
    }

    // TODO: Implement actual MCP tool execution
    // This would involve communicating with the MCP server via stdin/stdout
    // or other communication mechanisms
    
    console.log(`🔧 Executing tool ${toolName} on server ${serverName} with args:`, args);
    
    // For now, return a placeholder response
    return {
      success: true,
      result: `Tool ${toolName} executed on ${serverName}`,
      timestamp: new Date().toISOString()
    };
  }
}