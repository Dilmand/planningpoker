import express from 'express';
import { 
  login, 
  createRoom, 
  getAllRooms, 
  getRoomParticipants, 
  removeParticipant,
  blockIP,
  getBlockedIPs,
  unblockIP,
  getLogs,
  deleteRoom
} from '../controllers/adminController';
import { authenticateAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// Public admin routes
router.post('/login', login);

// Protected admin routes
router.use(authenticateAdmin);

// Room management
router.post('/rooms', createRoom);
router.get('/rooms', getAllRooms);
router.get('/rooms/:roomId/participants', getRoomParticipants);
router.delete('/rooms/:roomId/participants/:participantId', removeParticipant);
router.delete('/rooms/:roomId', deleteRoom);

// IP blocking management
router.post('/ip-block', blockIP);
router.get('/ip-block', getBlockedIPs);
router.delete('/ip-block/:ipAddress', unblockIP);

// Logs
router.get('/logs', getLogs);

export default router; 