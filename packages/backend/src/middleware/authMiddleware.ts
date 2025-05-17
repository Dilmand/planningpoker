import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from the header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: { message: 'Access denied. No token provided', status: 401 } });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production') as any;
    
    // Check if the admin exists in the database
    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id }
    });

    if (!admin) {
      return res.status(401).json({ error: { message: 'Invalid token. User not found', status: 401 } });
    }

    // Set the user in the request
    req.user = {
      id: admin.id,
      username: admin.username
    };

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(401).json({ error: { message: 'Invalid token', status: 401 } });
  }
}; 