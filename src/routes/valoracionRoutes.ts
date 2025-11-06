import { Router } from 'express';
import {
  createValoracion,
  updateValoracion,
  listValoracionesEvento,
  getValoracionById,
  deleteValoracion
} from '../controller/valoracionController';

const router = Router();

router.post('/event/:eventoId', createValoracion);

router.get('/event/:eventoId', listValoracionesEvento);

router.get('/:id', getValoracionById);

router.put('/:id', updateValoracion);

router.delete('/:id', deleteValoracion);

export default router;
