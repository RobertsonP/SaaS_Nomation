import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ENV } from './environment.config';

export const loggerConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        ENV.isProduction
          ? winston.format.json() // JSON in production for log aggregation
          : winston.format.simple(), // Human-readable in dev
      ),
    }),

    // Production: Write errors to file
    ...(ENV.isProduction ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ] : []),
  ],
});