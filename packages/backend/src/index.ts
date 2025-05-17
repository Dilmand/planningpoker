import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { configureRoutes } from './routes';
import { setupSocketHandlers } from './services/socketService';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Configure all routes
configureRoutes(app);

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach io to app
app.set('io', io);

// Set up socket handlers
setupSocketHandlers(io);

// Start the server
server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled Rejection', { error: error.message, stack: error.stack });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

export { app, server, io }; 