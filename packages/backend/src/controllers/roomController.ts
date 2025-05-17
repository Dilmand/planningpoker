import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema for joining a room
const joinRoomSchema = z.object({
  uniqueLinkIdentifier: z.string().min(1, 'Room identifier is required'),
  participantName: z.string().min(1, 'Name is required')
});

export const joinRoom = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = joinRoomSchema.parse(req.body);
    const { uniqueLinkIdentifier, participantName } = validatedData;

    // Find the room
    const room = await prisma.room.findUnique({
      where: { uniqueLinkIdentifier },
      include: { 
        participants: {
          where: { isActive: true },
          select: { id: true, name: true }
        }
      }
    });

    if (!room) {
      logger.warn('Failed room join attempt - Room not found', { 
        uniqueLinkIdentifier, 
        participantName,
        ip: req.ip
      });
      return res.status(404).json({ 
        error: { 
          message: 'Room not found', 
          status: 404 
        } 
      });
    }

    // Create or update the participant
    const existingParticipant = await prisma.participant.findFirst({
      where: {
        roomId: room.id,
        name: participantName,
        isActive: true
      }
    });

    // If participant with the same name exists, return error
    if (existingParticipant) {
      return res.status(400).json({
        error: {
          message: 'A participant with this name is already active in the room',
          status: 400
        }
      });
    }

    // Create a new participant
    const participant = await prisma.participant.create({
      data: {
        name: participantName,
        roomId: room.id,
        isActive: true
      }
    });

    logger.info('Participant joined room', { 
      roomId: room.id, 
      participantId: participant.id,
      ip: req.ip
    });

    return res.status(200).json({
      room: {
        id: room.id,
        uniqueLinkIdentifier: room.uniqueLinkIdentifier,
        currentStoryName: room.currentStoryName
      },
      participant,
      participants: room.participants
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Join room validation error', { errors: error.errors });
      return res.status(400).json({ 
        error: { 
          message: 'Invalid request data', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Error joining room', { error });
    return res.status(500).json({ 
      error: { 
        message: 'Internal server error', 
        status: 500 
      } 
    });
  }
};

// Validation schema for leaving a room
const leaveRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  participantId: z.string().min(1, 'Participant ID is required')
});

export const leaveRoom = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = leaveRoomSchema.parse(req.body);
    const { roomId, participantId } = validatedData;

    // Find and update the participant
    const participant = await prisma.participant.findFirst({
      where: {
        id: participantId,
        roomId: roomId,
        isActive: true
      }
    });

    if (participant) {
      // Mark participant as inactive
      await prisma.participant.update({
        where: { id: participantId },
        data: { isActive: false }
      });

      logger.info('Participant left room', { 
        roomId, 
        participantId,
        ip: req.ip
      });
    }

    return res.status(200).json({ message: 'Successfully left the room' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Leave room validation error', { errors: error.errors });
      return res.status(400).json({ 
        error: { 
          message: 'Invalid request data', 
          details: error.errors,
          status: 400 
        } 
      });
    }

    logger.error('Error leaving room', { error });
    return res.status(500).json({ 
      error: { 
        message: 'Internal server error', 
        status: 500 
      } 
    });
  }
}; 