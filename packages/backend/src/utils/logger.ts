import winston from 'winston';
import { PrismaClient } from '@prisma/client';
import Transport from 'winston-transport';

const prisma = new PrismaClient();

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class PrismaTransport extends Transport {
  async log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));
    try {
      const { level, message, ...meta } = info;
      await prisma.logEntry.create({
        data: {
          level: level.toUpperCase(),
          message: String(message),
          meta: meta as any,
        },
      });
    } catch (error) {
      console.error('Failed to save log to database:', error);
    }
    callback();
  }
}


// Configure Winston logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new PrismaTransport(),
  ],
});


// Add PostgreSQL transport after prisma is initialized in the application
const setupDatabaseLogging = () => {
  logger.add(new PrismaTransport());
};

export { logger, setupDatabaseLogging }; 