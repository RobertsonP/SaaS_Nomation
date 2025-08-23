import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  });
  
  // Enable validation
  app.useGlobalPipes(new ValidationPipe());
  
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