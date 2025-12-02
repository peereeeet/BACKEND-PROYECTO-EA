import { Router } from 'express';
import {
  createValoracion,
  updateValoracion,
  listValoracionesEvento,
  getValoracionById,
  deleteValoracion
} from '../controller/valoracionController';

const router = Router();

/**
 * @swagger
 * /api/ratings/event/{eventoId}:
 *   post:
 *     summary: Crear una valoración para un evento
 *     tags: [Valoraciones]
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
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/event/:eventoId', createValoracion);

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
 *     responses:
 *       200:
 *         description: Lista de valoraciones del evento
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Valoracion'
 *       404:
 *         description: Evento no encontrado
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Valoracion'
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
router.put('/:id', updateValoracion);

/**
 * @swagger
 * /api/ratings/{id}:
 *   delete:
 *     summary: Eliminar una valoración
 *     tags: [Valoraciones]
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
router.delete('/:id', deleteValoracion);

export default router;
