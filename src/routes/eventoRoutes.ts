import { Router } from 'express';
import {
  createEvento,
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

// Rutas públicas (sin autenticación)
router.get('/', getAllEventos);
router.get('/:id', getEventoById);

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, createEvento); 
router.put('/:id', authenticateToken, updateEventoById);
router.delete('/:id', authenticateToken, deleteEventoById); 
router.post('/check-name', checkEventNameExists);
router.post('/:id/join', authenticateToken, joinEvento);
router.post('/:id/leave', authenticateToken, leaveEvento);
router.get('/user/my-events', authenticateToken, getMisEventos);

export default router;