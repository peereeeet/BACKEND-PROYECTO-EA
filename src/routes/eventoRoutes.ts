import { Router } from 'express';
import {
  createEvento,
  createEventoFromPanel,
  getAllEventos,
  getEventoById,
  updateEventoById,
  checkEventNameExists,
  deleteEventoById,
  joinEvento,      
  leaveEvento,    
  getMisEventos   
} from '../controller/eventoController';
import { authenticateToken } from '../auth/middleware';

const router = Router();

router.get('/', getAllEventos);
router.get('/:id', getEventoById);

router.post('/', authenticateToken, createEvento); 
router.post('/create-from-panel', authenticateToken, createEventoFromPanel);
router.put('/:id', authenticateToken, updateEventoById);
router.delete('/:id', authenticateToken, deleteEventoById); 
router.post('/check-name', checkEventNameExists);
router.post('/:id/join', authenticateToken, joinEvento);
router.post('/:id/leave', authenticateToken, leaveEvento);
router.get('/user/my-events', authenticateToken, getMisEventos);

export default router;