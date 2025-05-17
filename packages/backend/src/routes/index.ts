import { Express } from 'express';
import roomRoutes from './roomRoutes';
import adminRoutes from './adminRoutes';
import { logger } from '../utils/logger';

export const configureRoutes = (app: Express) => {
  app.use('/api/rooms', roomRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    logger.error('API Error', { 
      error: err.message, 
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip 
    });
    
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        status: err.status || 500
      }
    });
  });
}; 