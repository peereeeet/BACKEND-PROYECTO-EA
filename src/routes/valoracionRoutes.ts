import { Router } from 'express';
import {
  createValoracion,
  getUserValoracion,
  updateValoracion,
  listValoracionesEvento,
  getValoracionById,
  deleteValoracion
} from '../controller/valoracionController';
import { authenticateToken } from '../auth/middleware';
import { validateRatingContent } from '../profanityMiddleware';

const router = Router();

/**
 * @swagger
 * /api/ratings/event/{eventoId}:
 *   post:
 *     summary: Crear una valoración para un evento
 *     tags: [Valoraciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventoId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               puntuacion:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comentario:
 *                 type: string
 *     responses:
 *       201:
 *         description: Valoración creada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Usuario no autenticado
 *       409:
 *         description: El usuario ya ha valorado este evento
 *       500:
 *         description: Error del servidor
 */
router.post('/event/:eventoId', authenticateToken, validateRatingContent, createValoracion);

/**
 * @swagger
 * /api/ratings/event/{eventoId}/my-rating:
 *   get:
 *     summary: Obtener la valoración del usuario autenticado para un evento
 *     tags: [Valoraciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Valoración del usuario
 *       401:
 *         description: Usuario no autenticado
 *       404:
 *         description: El usuario no ha valorado este evento
 *       500:
 *         description: Error del servidor
 */
router.get('/event/:eventoId/my-rating', authenticateToken, getUserValoracion);

/**
 * @swagger
 * /api/ratings/event/{eventoId}:
 *   get:
 *     summary: Listar valoraciones de un evento
 *     tags: [Valoraciones]
 *     parameters:
 *       - in: path
 *         name: eventoId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Buscar en comentarios
 *     responses:
 *       200:
 *         description: Lista de valoraciones del evento
 *       500:
 *         description: Error del servidor
 */
router.get('/event/:eventoId', listValoracionesEvento);

/**
 * @swagger
 * /api/ratings/{id}:
 *   get:
 *     summary: Obtener una valoración por ID
 *     tags: [Valoraciones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Valoración encontrada
 *       404:
 *         description: Valoración no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', getValoracionById);

/**
 * @swagger
 * /api/ratings/{id}:
 *   put:
 *     summary: Actualizar una valoración
 *     tags: [Valoraciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               puntuacion:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comentario:
 *                 type: string
 *     responses:
 *       200:
 *         description: Valoración actualizada correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Valoración no encontrada
 *       500:
 *         description: Error del servidor
 */
router.put('/:id', authenticateToken, validateRatingContent, updateValoracion);

/**
 * @swagger
 * /api/ratings/{id}:
 *   delete:
 *     summary: Eliminar una valoración
 *     tags: [Valoraciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Valoración eliminada correctamente
 *       404:
 *         description: Valoración no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id', authenticateToken, deleteValoracion);

export default router;