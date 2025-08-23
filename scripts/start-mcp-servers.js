#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load MCP configuration
const configPath = path.join(__dirname, '..', 'mcp.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Store running processes
const runningProcesses = new Map();

// Function to start an MCP server
function startMcpServer(serverName, serverConfig) {
  console.log(`🚀 Starting MCP server: ${serverName}`);
  
  const process = spawn(serverConfig.command, serverConfig.args, {
    env: { ...process.env, ...serverConfig.env },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  // Handle server output
  process.stdout.on('data', (data) => {
    console.log(`[${serverName}] ${data.toString().trim()}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`[${serverName}] ERROR: ${data.toString().trim()}`);
  });

  process.on('close', (code) => {
    console.log(`[${serverName}] Process exited with code ${code}`);
    runningProcesses.delete(serverName);
  });

  process.on('error', (error) => {
    console.error(`[${serverName}] Failed to start: ${error.message}`);
    runningProcesses.delete(serverName);
  });

  runningProcesses.set(serverName, process);
  return process;
}

// Function to stop all MCP servers
function stopAllServers() {
  console.log('🛑 Stopping all MCP servers...');
  
  for (const [serverName, process] of runningProcesses) {
    console.log(`Stopping ${serverName}...`);
    process.kill('SIGTERM');
  }
  
  runningProcesses.clear();
}

// Function to check server health
function checkServerHealth(serverName) {
  const process = runningProcesses.get(serverName);
  if (process && !process.killed) {
    return { status: 'running', pid: process.pid };
  }
  return { status: 'stopped' };
}

// Function to restart a server
function restartServer(serverName) {
  const process = runningProcesses.get(serverName);
  if (process) {
    process.kill('SIGTERM');
  }
  
  setTimeout(() => {
    const serverConfig = config.mcpServers[serverName];
    if (serverConfig) {
      startMcpServer(serverName, serverConfig);
    }
  }, 2000);
}

// Main function
async function main() {
  const command = process.argv[2];
  const serverName = process.argv[3];

  switch (command) {
    case 'start':
      if (serverName) {
        const serverConfig = config.mcpServers[serverName];
        if (serverConfig) {
          startMcpServer(serverName, serverConfig);
        } else {
          console.error(`❌ Server '${serverName}' not found in configuration`);
          process.exit(1);
        }
      } else {
        // Start all servers
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          startMcpServer(name, serverConfig);
        }
      }
      break;

    case 'stop':
      if (serverName) {
        const process = runningProcesses.get(serverName);
        if (process) {
          process.kill('SIGTERM');
          console.log(`🛑 Stopped ${serverName}`);
        } else {
          console.log(`⚠️  Server '${serverName}' is not running`);
        }
      } else {
        stopAllServers();
      }
      break;

    case 'restart':
      if (serverName) {
        restartServer(serverName);
        console.log(`🔄 Restarted ${serverName}`);
      } else {
        stopAllServers();
        setTimeout(() => {
          for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
            startMcpServer(name, serverConfig);
          }
        }, 2000);
      }
      break;

    case 'status':
      if (serverName) {
        const status = checkServerHealth(serverName);
        console.log(`${serverName}: ${status.status}${status.pid ? ` (PID: ${status.pid})` : ''}`);
      } else {
        console.log('📊 MCP Server Status:');
        for (const [name] of Object.entries(config.mcpServers)) {
          const status = checkServerHealth(name);
          console.log(`  ${name}: ${status.status}${status.pid ? ` (PID: ${status.pid})` : ''}`);
        }
      }
      break;

    case 'list':
      console.log('📋 Available MCP Servers:');
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        console.log(`  ${name}: ${serverConfig.command} ${serverConfig.args.join(' ')}`);
      }
      break;

    default:
      console.log(`
🔧 MCP Server Manager

Usage: node start-mcp-servers.js <command> [server-name]

Commands:
  start [server-name]   - Start MCP server(s)
  stop [server-name]    - Stop MCP server(s)
  restart [server-name] - Restart MCP server(s)
  status [server-name]  - Check server status
  list                  - List available servers

Examples:
  node start-mcp-servers.js start playwright
  node start-mcp-servers.js stop
  node start-mcp-servers.js status
      `);
      break;
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  stopAllServers();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  stopAllServers();
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});