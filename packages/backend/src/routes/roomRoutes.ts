import express from 'express';
import { joinRoom, leaveRoom } from '../controllers/roomController';
import { checkBlockedIP } from '../middleware/ipBlockingMiddleware';

const router = express.Router();

// Apply IP blocking middleware to all room routes
router.use(checkBlockedIP);

// Room routes
router.post('/join', joinRoom);
router.post('/leave', leaveRoom);

export default router; 