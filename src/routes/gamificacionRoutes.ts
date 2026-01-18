import { Router } from 'express';
import {
  obtenerMiProgreso,
  obtenerProgresoUsuario,
  obtenerInsignias,
  inicializarInsignias,
} from '../controller/gamificacionController';
import { authenticateToken } from '../auth/middleware';

const router = Router();

/**
 * @swagger
 * /api/gamificacion/mi-progreso:
 *   get:
 *     summary: Obtener el progreso del usuario autenticado
 *     tags: [Gamificación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progreso del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usuario:
 *                   type: string
 *                 puntos:
 *                   type: number
 *                 nivel:
 *                   type: string
 *                 insignias:
 *                   type: array
 *                   items:
 *                     type: object
 *                 estadisticas:
 *                   type: object
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.get('/mi-progreso', authenticateToken, obtenerMiProgreso);

/**
 * @swagger
 * /api/gamificacion/progreso/{usuarioId}:
 *   get:
 *     summary: Obtener el progreso de un usuario específico
 *     tags: [Gamificación]
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progreso del usuario
 *       400:
 *         description: Falta usuarioId
 *       500:
 *         description: Error del servidor
 */
router.get('/progreso/:usuarioId', obtenerProgresoUsuario);

/**
 * @swagger
 * /api/gamificacion/insignias:
 *   get:
 *     summary: Obtener todas las insignias disponibles
 *     tags: [Gamificación]
 *     responses:
 *       200:
 *         description: Lista de insignias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   codigo:
 *                     type: string
 *                   nombre:
 *                     type: string
 *                   descripcion:
 *                     type: string
 *                   icono:
 *                     type: string
 *                   puntos:
 *                     type: number
 *                   criterios:
 *                     type: object
 *       500:
 *         description: Error del servidor
 */
router.get('/insignias', obtenerInsignias);

/**
 * @swagger
 * /api/gamificacion/inicializar-insignias:
 *   post:
 *     summary: Inicializar insignias predefinidas (solo administración)
 *     tags: [Gamificación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insignias inicializadas correctamente
 *       500:
 *         description: Error del servidor
 */
router.post('/inicializar-insignias', authenticateToken, inicializarInsignias);

export default router;
