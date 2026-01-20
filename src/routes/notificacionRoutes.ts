import { Router } from 'express';
import {
  getUserNotificaciones,
  getUnreadNotificaciones,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markRelatedAsRead,
  deleteNotificacion
} from '../controller/notificacionController';
import { authenticateToken } from '../auth/middleware';

const router = Router();

/**
 * @swagger
 * /api/notificaciones/{userId}:
 *   get:
 *     summary: Obtener todas las notificaciones de un usuario
 *     tags: [Notificaciones]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 */
router.get('/:userId', authenticateToken, getUserNotificaciones);

/**
 * @swagger
 * /api/notificaciones/{userId}/unread:
 *   get:
 *     summary: Obtener notificaciones no leídas
 *     tags: [Notificaciones]
 */
router.get('/:userId/unread', authenticateToken, getUnreadNotificaciones);

/**
 * @swagger
 * /api/notificaciones/{userId}/unread/count:
 *   get:
 *     summary: Obtener el número de notificaciones no leídas
 *     tags: [Notificaciones]
 */
router.get('/:userId/unread/count', authenticateToken, getUnreadCount);

/**
 * @swagger
 * /api/notificaciones/{notificacionId}/read:
 *   patch:
 *     summary: Marcar una notificación como leída
 *     tags: [Notificaciones]
 */
router.patch('/:notificacionId/read', authenticateToken, markAsRead);

/**
 * @swagger
 * /api/notificaciones/{userId}/read-all:
 *   patch:
 *     summary: Marcar todas las notificaciones como leídas
 *     tags: [Notificaciones]
 */
router.patch('/:userId/read-all', authenticateToken, markAllAsRead);

/**
 * @swagger
 * /api/notificaciones/{userId}/mark-related:
 *   patch:
 *     summary: Marcar notificaciones relacionadas como leídas automáticamente
 *     tags: [Notificaciones]
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               relatedId:
 *                 type: string
 *                 description: ID del usuario o evento relacionado
 *               type:
 *                 type: string
 *                 enum: [user, event]
 *                 description: Tipo de relación (user para chats, event para eventos)
 */
router.patch('/:userId/mark-related', authenticateToken, markRelatedAsRead);

/**
 * @swagger
 * /api/notificaciones/{notificacionId}:
 *   delete:
 *     summary: Eliminar una notificación
 *     tags: [Notificaciones]
 */
router.delete('/:notificacionId', authenticateToken, deleteNotificacion);

export default router;