import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { Secret } from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const createRoomSchema = z.object({
  roomName: z.string().optional(),
  identifierHint: z.string().optional()
});

const blockIPSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required'),
  reason: z.string().optional()
});

const logsQuerySchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR', 'DEBUG']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  searchTerm: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(50)
});

// Login
export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { username, password } = validatedData;

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { username }
    });

    if (!admin) {
      logger.warn('Failed login attempt - User not found', { username, ip: req.ip });
      return res.status(401).json({ error: { message: 'Invalid credentials', status: 401 } });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      logger.warn('Failed login attempt - Invalid password', { username, ip: req.ip });
      return res.status(401).json({ error: { message: 'Invalid credentials', status: 401 } });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      (process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production') as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    logger.info('Admin login successful', { adminId: admin.id, ip: req.ip });

    return res.status(200).json({
      token,
      user: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: { 
          message: 'Invalid request data', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Login error', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Create Room
export const createRoom = async (req: Request, res: Response) => {
  try {
    const validatedData = createRoomSchema.parse(req.body);
    const { roomName, identifierHint } = validatedData;

    // Generate a unique link identifier
    const uniqueLinkIdentifier = identifierHint ? 
      `${identifierHint}-${nanoid(8)}` : 
      nanoid(12);

    // Create the room
    const room = await prisma.room.create({
      data: {
        uniqueLinkIdentifier,
        currentStoryName: roomName
      }
    });

    logger.info('Room created', { roomId: room.id, adminId: req.user?.id });

    return res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: { 
          message: 'Invalid request data', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Error creating room', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Get All Rooms
export const getAllRooms = async (_req: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        _count: {
          select: {
            participants: {
              where: {
                isActive: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(rooms);
  } catch (error) {
    logger.error('Error getting rooms', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Get Room Participants
export const getRoomParticipants = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: {
            isActive: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: { message: 'Room not found', status: 404 } });
    }

    return res.status(200).json(room.participants);
  } catch (error) {
    logger.error('Error getting room participants', { roomId: req.params.roomId, error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Remove Participant
export const removeParticipant = async (req: Request, res: Response) => {
  try {
    const { roomId, participantId } = req.params;

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return res.status(404).json({ error: { message: 'Room not found', status: 404 } });
    }

    // Update participant to inactive
    const participant = await prisma.participant.update({
      where: { id: participantId },
      data: { isActive: false }
    });

    // After updating participant to inactive
    const io = req.app.get('io');
    if (participant.socketId && io) {
      io.to(participant.socketId).emit('participantRemoved', {
        message: 'You have been removed from the room by an admin.'
      });
    }

    logger.info('Participant removed', { 
      roomId, 
      participantId, 
      adminId: req.user?.id 
    });

    return res.status(200).json(participant);
  } catch (error) {
    logger.error('Error removing participant', { 
      roomId: req.params.roomId, 
      participantId: req.params.participantId, 
      error 
    });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Block IP
export const blockIP = async (req: Request, res: Response) => {
  try {
    const validatedData = blockIPSchema.parse(req.body);
    const { ipAddress, reason } = validatedData;

    // Check if IP is already blocked
    const existingBlock = await prisma.blockedIP.findUnique({
      where: { ipAddress }
    });

    if (existingBlock) {
      return res.status(400).json({ 
        error: { 
          message: 'IP address is already blocked', 
          status: 400 
        } 
      });
    }

    // Block the IP
    const blockedIP = await prisma.blockedIP.create({
      data: {
        ipAddress,
        reason
      }
    });

    logger.info('IP address blocked', { 
      ipAddress, 
      reason, 
      adminId: req.user?.id 
    });

    return res.status(201).json(blockedIP);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: { 
          message: 'Invalid request data', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Error blocking IP', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Get Blocked IPs
export const getBlockedIPs = async (_req: Request, res: Response) => {
  try {
    const blockedIPs = await prisma.blockedIP.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(blockedIPs);
  } catch (error) {
    logger.error('Error getting blocked IPs', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Unblock IP
export const unblockIP = async (req: Request, res: Response) => {
  try {
    const { ipAddress } = req.params;

    // Check if IP is blocked
    const blockedIP = await prisma.blockedIP.findUnique({
      where: { ipAddress }
    });

    if (!blockedIP) {
      return res.status(404).json({ 
        error: { 
          message: 'IP address is not blocked', 
          status: 404 
        } 
      });
    }

    // Delete the blocked IP
    await prisma.blockedIP.delete({
      where: { ipAddress }
    });

    logger.info('IP address unblocked', { 
      ipAddress, 
      adminId: req.user?.id 
    });

    return res.status(200).json({ message: 'IP address unblocked successfully' });
  } catch (error) {
    logger.error('Error unblocking IP', { ipAddress: req.params.ipAddress, error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Get Logs
export const getLogs = async (req: Request, res: Response) => {
  try {
    const queryParams = logsQuerySchema.parse({
      level: req.query.level,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      searchTerm: req.query.searchTerm,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50
    });

    const { level, dateFrom, dateTo, searchTerm, page, limit } = queryParams;

    // Build the where condition
    const where: any = {};

    if (level) {
      where.level = level;
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        where.timestamp.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.timestamp.lte = new Date(dateTo);
      }
    }

    if (searchTerm) {
      where.message = {
        contains: searchTerm,
        mode: 'insensitive'
      };
    }

    // Count total logs matching the criteria
    const totalLogs = await prisma.logEntry.count({ where });

    // Fetch logs with pagination
    const logs = await prisma.logEntry.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    return res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        totalLogs,
        totalPages: Math.ceil(totalLogs / limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: { 
          message: 'Invalid query parameters', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Error getting logs', { error });
    return res.status(500).json({ error: { message: 'Internal server error', status: 500 } });
  }
};

// Delete Room
export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // Find the room
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: { isActive: true },
          select: { id: true, socketId: true }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ 
        error: { 
          message: 'Room not found', 
          status: 404 
        } 
      });
    }

    // Get the socket server instance
    const io = req.app.get('io');
    if (!io) {
      logger.error('Socket server instance not found');
      throw new Error('Socket server not initialized');
    }

    try {
      // Notify all participants that the room is being deleted
      room.participants.forEach(participant => {
        if (participant.socketId) {
          io.to(participant.socketId).emit('roomDeleted', {
            roomId: room.id,
            message: 'This room has been deleted by an administrator'
          });
        }
      });
    } catch (socketError) {
      logger.error('Error notifying participants', { error: socketError });
      // Continue with deletion even if socket notification fails
    }

    // Delete all participants and estimates first (due to foreign key constraints)
    await prisma.$transaction([
      prisma.estimate.deleteMany({
        where: { roomId }
      }),
      prisma.participant.deleteMany({
        where: { roomId }
      }),
      prisma.room.delete({
        where: { id: roomId }
      })
    ]);

    logger.info('Room deleted by admin', { 
      roomId, 
      adminId: req.user?.id,
      participantCount: room.participants.length
    });

    return res.status(200).json({ 
      message: 'Room and all participants deleted successfully' 
    });
  } catch (error) {
    logger.error('Error deleting room', { error });
    return res.status(500).json({ 
      error: { 
        message: 'Internal server error', 
        status: 500 
      } 
    });
  }
}; 