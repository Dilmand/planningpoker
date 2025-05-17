import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface JoinRoomData {
  roomId: string;
  participantId: string;
}

interface SubmitEstimateData {
  roomId: string;
  participantId: string;
  estimateValue: string;
  storyName?: string;
}

interface SetStoryNameData {
  roomId: string;
  storyName: string;
}

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    logger.info('New socket connection', { socketId: socket.id });

    // Handle joining a room
    socket.on('joinRoom', async (data: JoinRoomData) => {
      try {
        const { roomId, participantId } = data;

        // Validate room and participant
        const participant = await prisma.participant.findFirst({
          where: {
            id: participantId,
            roomId: roomId,
            isActive: true
          }
        });

        if (!participant) {
          socket.emit('error', { message: 'Invalid room or participant' });
          return;
        }

        // Update participant's socket ID
        await prisma.participant.update({
          where: { id: participantId },
          data: { socketId: socket.id }
        });

        // Join the socket to the room
        socket.join(roomId);

        // Get all active participants in the room
        const participants = await prisma.participant.findMany({
          where: {
            roomId,
            isActive: true
          },
          select: {
            id: true,
            name: true
          }
        });

        // Notify others in the room
        socket.to(roomId).emit('participantJoined', {
          participant: {
            id: participant.id,
            name: participant.name
          }
        });

        // Send room info to the joining participant
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            currentStoryName: true
          }
        });

        // Get all current estimates for the current story
        const currentEstimates = await prisma.estimate.findMany({
          where: {
            roomId,
            storyName: room?.currentStoryName
          },
          select: {
            participantId: true
          }
        });

        const participantsWhoVoted = currentEstimates.map(est => est.participantId);

        socket.emit('roomInfo', {
          room,
          participants,
          participantsWhoVoted
        });

        logger.info('Participant joined room via WebSocket', { 
          roomId, 
          participantId,
          socketId: socket.id
        });
      } catch (error) {
        logger.error('Error joining room via WebSocket', { error, data });
        socket.emit('error', { message: 'Error joining room' });
      }
    });

    // Handle submitting an estimate
    socket.on('submitEstimate', async (data: SubmitEstimateData) => {
      try {
        const { roomId, participantId, estimateValue, storyName } = data;

        // Get current story name if not provided
        let effectiveStoryName = storyName;
        if (!effectiveStoryName) {
          const room = await prisma.room.findUnique({
            where: { id: roomId },
            select: { currentStoryName: true }
          });
          effectiveStoryName = room?.currentStoryName || undefined;
        }

        // Check for existing estimate and update or create
        const existingEstimate = await prisma.estimate.findFirst({
          where: {
            participantId,
            roomId,
            storyName: effectiveStoryName
          }
        });

        if (existingEstimate) {
          await prisma.estimate.update({
            where: { id: existingEstimate.id },
            data: { value: estimateValue }
          });
        } else {
          await prisma.estimate.create({
            data: {
              value: estimateValue,
              participantId,
              roomId,
              storyName: effectiveStoryName
            }
          });
        }

        // Broadcast to all clients in the room that a new estimate was received
        // (not including the value yet, just that someone has estimated)
        io.to(roomId).emit('estimateReceived', {
          participantId
        });

        logger.info('Estimate submitted', { 
          roomId, 
          participantId,
          storyName: effectiveStoryName 
        });
      } catch (error) {
        logger.error('Error submitting estimate', { error, data });
        socket.emit('error', { message: 'Error submitting estimate' });
      }
    });

    // Handle revealing estimates
    socket.on('revealEstimates', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        // Get current story name
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: { currentStoryName: true }
        });

        // Get all estimates for the current story
        const estimates = await prisma.estimate.findMany({
          where: {
            roomId,
            storyName: room?.currentStoryName
          },
          include: {
            participant: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        // Broadcast all estimates to clients in the room
        io.to(roomId).emit('estimatesRevealed', {
          estimates: estimates.map(est => ({
            participantId: est.participantId,
            participantName: est.participant.name,
            value: est.value
          })),
          storyName: room?.currentStoryName
        });

        logger.info('Estimates revealed', { 
          roomId, 
          storyName: room?.currentStoryName,
          estimateCount: estimates.length 
        });
      } catch (error) {
        logger.error('Error revealing estimates', { error, roomId: data.roomId });
        socket.emit('error', { message: 'Error revealing estimates' });
      }
    });

    // Handle clearing estimates
    socket.on('clearEstimates', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        // Get current story name
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: { currentStoryName: true }
        });

        // Delete all estimates for the current story
        await prisma.estimate.deleteMany({
          where: {
            roomId,
            storyName: room?.currentStoryName
          }
        });

        // Broadcast that estimates were cleared
        io.to(roomId).emit('estimatesCleared', {
          storyName: room?.currentStoryName
        });

        logger.info('Estimates cleared', { 
          roomId, 
          storyName: room?.currentStoryName 
        });
      } catch (error) {
        logger.error('Error clearing estimates', { error, roomId: data.roomId });
        socket.emit('error', { message: 'Error clearing estimates' });
      }
    });

    // Handle setting story name
    socket.on('setStoryName', async (data: SetStoryNameData) => {
      try {
        const { roomId, storyName } = data;

        // Update room with new story name
        await prisma.room.update({
          where: { id: roomId },
          data: { currentStoryName: storyName }
        });

        // Broadcast new story name to all clients in the room
        io.to(roomId).emit('storyNameUpdated', {
          storyName
        });

        logger.info('Story name updated', { roomId, storyName });
      } catch (error) {
        logger.error('Error setting story name', { error, data });
        socket.emit('error', { message: 'Error setting story name' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        // Find participant with this socket ID
        const participant = await prisma.participant.findFirst({
          where: { socketId: socket.id },
          select: { id: true, roomId: true, name: true }
        });

        if (participant) {
          // Don't set the participant as inactive here
          // This allows users to refresh the page without losing their place
          // Instead, update the socketId to null
          await prisma.participant.update({
            where: { id: participant.id },
            data: { socketId: null }
          });

          // Notify others in the room
          socket.to(participant.roomId).emit('participantDisconnected', {
            participantId: participant.id
          });

          logger.info('Participant disconnected', { 
            participantId: participant.id, 
            participantName: participant.name, 
            roomId: participant.roomId 
          });
        }

        logger.info('Socket disconnected', { socketId: socket.id });
      } catch (error) {
        logger.error('Error handling disconnect', { error, socketId: socket.id });
      }
    });
  });
}; 