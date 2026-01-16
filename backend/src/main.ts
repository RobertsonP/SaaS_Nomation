// CRITICAL: Polyfill crypto for @nestjs/schedule in Docker environment
import * as crypto from 'crypto';
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ensureUploadDirs } from './config/upload.config';
import helmet from 'helmet';
import { loggerConfig } from './config/logger.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig,
    rawBody: true,
  });

  // Security headers via helmet.js
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny', // Prevent clickjacking
    },
    noSniff: true, // Prevent MIME type sniffing
    xssFilter: true, // Enable XSS filter
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  }));

  // Ensure upload directories exist
  ensureUploadDirs();

  // ENTERPRISE-GRADE PAYLOAD CONFIGURATION
  // Support for large project uploads (Django, C#, Java, React, etc.) up to 1GB
  app.use(json({ 
    limit: '1gb',         // Handle any project type up to 1GB (your 400MB + buffer)
    verify: (req: any, res: any, buf: Buffer) => {
      // Log enterprise uploads for monitoring
      if (buf.length > 100 * 1024 * 1024) { // 100MB+
        const sizeMB = Math.round(buf.length / (1024 * 1024));
        console.log(`🏢 Enterprise upload detected: ${sizeMB}MB payload`);
      }
    }
  }));
  
  app.use(urlencoded({ 
    limit: '1gb', 
    extended: true 
  }));
  
  // Enable CORS for frontend
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // Memory usage monitoring for large project processing
  process.on('memoryUsage', () => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 1024 * 1024 * 1024) { // 1GB warning
      console.warn('⚠️ High memory usage detected during enterprise project processing:', {
        heapUsed: Math.round(usage.heapUsed / (1024 * 1024)) + 'MB',
        heapTotal: Math.round(usage.heapTotal / (1024 * 1024)) + 'MB'
      });
    }
  });
  
  const port = process.env.PORT || 3002;
  const server = await app.listen(port);
  
  // ENTERPRISE TIMEOUT CONFIGURATION
  // Handle large project analysis that may take several minutes
  server.setTimeout(15 * 60 * 1000);  // 15 minutes for complex enterprise projects
  server.keepAliveTimeout = 60000;    // Keep connections alive for all technologies
  server.headersTimeout = 65000;      // Headers timeout buffer
  
  console.log(`🚀 Nomation API running on http://localhost:${port}`);
  console.log(`🏢 Enterprise mode: Supporting projects up to 1GB (Django, C#, Java, React, etc.)`);
}
bootstrap();