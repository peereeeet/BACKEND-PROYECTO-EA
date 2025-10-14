import { Router } from 'express';
import * as apuntadoController from '../controller/apuntadoController';
import { listarApuntados } from '../controller/apuntadoController';

const router = Router();

router.post('/', apuntadoController.addApuntadoHandler);
router.delete('/:id', apuntadoController.removeApuntadoHandler);
router.get('/evento/:eventoId', apuntadoController.getApuntadosByEventoHandler);
router.get('/user/:userId', apuntadoController.getEventosByUserHandler);
router.get('/', apuntadoController.getAllApuntadosHandler);
router.get("/list", listarApuntados);


export default router;
