import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const checkBlockedIP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip;
    
    // Check if the IP is blocked
    const blockedIP = await prisma.blockedIP.findUnique({
      where: { ipAddress: ip }
    });
    
    if (blockedIP) {
      logger.warn('Blocked IP attempt', { ip, path: req.path, method: req.method });
      return res.status(403).json({ 
        error: {
          message: 'Access denied',
          status: 403
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking blocked IP', { error, ip: req.ip });
    next();  // Continue even if there's an error checking the IP
  }
}; 