import { Router } from 'express';
import {
  createEvento,
  createEventoFromPanel,
  getAllEventos,
  getUpcomingEventos,
  getEventoById,
  updateEventoById,
  checkEventNameExists,
  deleteEventoById,
  joinEvento,
  leaveEvento,
  leaveWaitlist,
  getWaitlistPosition,
  getMisEventos,
  getEventosByBounds,
  searchEventos,
  inviteUsersToPrivateEvent,
  acceptPrivateEventInvitation,
  rejectPrivateEventInvitation,
  getMyPendingInvitations,
  removeInvitedUserFromEvent,
  getEventosVisibles,
  getCalendarEvents,
  getRecommendedEventos,
} from '../controller/eventoController';
import { authenticateToken } from '../auth/middleware';
import { validateEventContent } from '../profanityMiddleware';

const router = Router();

/**
 * @swagger
 * /api/event/by-bounds:
 *   get:
 *     summary: Obtener eventos dentro de un área del mapa
 *     tags: [Eventos]
 *     parameters:
 *       - in: query
 *         name: north
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: south
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: east
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: west
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Lista de eventos dentro del área
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 */
router.get('/by-bounds', getEventosByBounds);

/**
 * @swagger
 * /api/event/upcoming:
 *   get:
 *     summary: Obtener solo eventos futuros (no pasados), paginados
 *     tags: [Eventos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página (por defecto 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Tamaño de página (por defecto 10)
 *     responses:
 *       200:
 *         description: Lista de eventos futuros paginados
 *       500:
 *         description: Error del servidor
 */
router.get('/upcoming', getUpcomingEventos);

/**
 * @swagger
 * /api/event/recommended:
 *   get:
 *     summary: Obtener eventos recomendados para el usuario autenticado
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de eventos recomendados
 *       401:
 *         description: No autenticado
 */
router.get('/recommended', authenticateToken, getRecommendedEventos);

/**
 * @swagger
 * /api/event/search:
 *   get:
 *     summary: Buscar eventos por nombre y/o fecha
 *     tags: [Eventos]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Término de búsqueda para el nombre del evento
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *     responses:
 *       200:
 *         description: Eventos encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Evento'
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *                 totalItems:
 *                   type: number
 *       500:
 *         description: Error del servidor
 */
router.get('/search', searchEventos);

/**
 * @swagger
 * /api/event/user/my-events:
 *   get:
 *     summary: Obtener eventos creados e inscritos del usuario autenticado
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de eventos del usuario
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.get('/user/my-events', authenticateToken, getMisEventos);

/**
 * @swagger
 * /api/event:
 *   get:
 *     summary: Obtener todos los eventos
 *     tags: [Eventos]
 *     responses:
 *       200:
 *         description: Lista de eventos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Evento'
 *       500:
 *         description: Error del servidor
 */
router.get('/', getAllEventos);

/**
 * @swagger
 * /api/event/calendar:
 *   get:
 *     summary: Obtener eventos para vista de calendario (rango de fechas)
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lista de eventos en el rango
 *       400:
 *         description: Parámetros faltantes o inválidos
 *       401:
 *         description: No autenticado
 */
router.get('/calendar', authenticateToken, getCalendarEvents);

/**
 * @swagger
 * /api/event:
 *   post:
 *     summary: Crear un nuevo evento
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               schedule:
 *                 type: string
 *               address:
 *                 type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               participantes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Evento creado correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.post('/', authenticateToken, validateEventContent, createEvento);

/**
 * @swagger
 * /api/event/create-from-panel:
 *   post:
 *     summary: Crear un evento desde el panel de administración
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               creador:
 *                 type: string
 *               address:
 *                 type: string
 *               schedule:
 *                 type: string
 *               participantes:
 *                 type: array
 *                 items:
 *                   type: string
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *     responses:
 *       201:
 *         description: Evento creado correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post('/create-from-panel', authenticateToken, createEventoFromPanel);

/**
 * @swagger
 * /api/event/check-name:
 *   post:
 *     summary: Comprobar si existe un evento con un nombre dado
 *     tags: [Eventos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado de la comprobación
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post('/check-name', checkEventNameExists);

/**
 * @swagger
 * /api/event/{id}/join:
 *   post:
 *     summary: Unirse a un evento
 *     tags: [Eventos]
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
 *         description: Usuario unido al evento
 *       400:
 *         description: El usuario ya está inscrito o petición incorrecta
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/:id/join', authenticateToken, joinEvento);

/**
 * @swagger
 * /api/event/{id}/leave:
 *   post:
 *     summary: Salir de un evento
 *     tags: [Eventos]
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
 *         description: Usuario eliminado del evento
 *       400:
 *         description: El usuario no está inscrito o petición incorrecta
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/:id/leave', authenticateToken, leaveEvento);

/**
 * @swagger
 * /api/event/{id}/waitlist:
 *   delete:
 *     summary: Salir de la lista de espera
 *     tags: [Eventos]
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
 *         description: Usuario eliminado de la lista de espera
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Evento no encontrado
 */
router.delete('/:id/waitlist', authenticateToken, leaveWaitlist);

/**
 * @swagger
 * /api/event/{id}/waitlist/position:
 *   get:
 *     summary: Obtener posición en lista de espera
 *     tags: [Eventos]
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
 *         description: Posición del usuario en la lista
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Evento no encontrado
 */
router.get('/:id/waitlist/position', authenticateToken, getWaitlistPosition);

/**
 * @swagger
 * /api/event/{id}:
 *   delete:
 *     summary: Eliminar un evento
 *     tags: [Eventos]
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
 *         description: Evento eliminado correctamente
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id', authenticateToken, deleteEventoById);

/**
 * @swagger
 * /api/event/{id}:
 *   put:
 *     summary: Actualizar un evento
 *     tags: [Eventos]
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
 *             $ref: '#/components/schemas/Evento'
 *     responses:
 *       200:
 *         description: Evento actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put('/:id', authenticateToken, validateEventContent, updateEventoById);

/**
 * @swagger
 * /api/event/{id}:
 *   delete:
 *     summary: Eliminar un evento
 *     tags: [Eventos]
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
 *         description: Evento eliminado correctamente
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */

/**
 * @swagger
 * /api/event/{id}/invite:
 *   post:
 *     summary: Invitar usuarios a un evento privado
 *     tags: [Eventos Privados]
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
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Invitaciones enviadas correctamente
 *       403:
 *         description: Solo el creador puede invitar usuarios
 *       404:
 *         description: Evento no encontrado
 */
router.post('/:id/invite', authenticateToken, inviteUsersToPrivateEvent);

/**
 * @swagger
 * /api/event/{id}/accept-invitation:
 *   post:
 *     summary: Aceptar invitación a un evento privado
 *     tags: [Eventos Privados]
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
 *         description: Invitación aceptada correctamente
 *       400:
 *         description: No tienes invitación pendiente
 *       404:
 *         description: Evento no encontrado
 */
router.post(
  '/:id/accept-invitation',
  authenticateToken,
  acceptPrivateEventInvitation,
);

/**
 * @swagger
 * /api/event/{id}/reject-invitation:
 *   post:
 *     summary: Rechazar invitación a un evento privado
 *     tags: [Eventos Privados]
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
 *         description: Invitación rechazada
 *       400:
 *         description: No tienes invitación pendiente
 *       404:
 *         description: Evento no encontrado
 */
router.post(
  '/:id/reject-invitation',
  authenticateToken,
  rejectPrivateEventInvitation,
);

/**
 * @swagger
 * /api/event/invitations/pending:
 *   get:
 *     summary: Obtener invitaciones pendientes del usuario autenticado
 *     tags: [Eventos Privados]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de invitaciones pendientes
 *       401:
 *         description: No autenticado
 */
router.get('/invitations/pending', authenticateToken, getMyPendingInvitations);

/**
 * @swagger
 * /api/event/{id}/remove-invite/{userId}:
 *   delete:
 *     summary: Eliminar invitado de un evento privado (solo creador)
 *     tags: [Eventos Privados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario eliminado del evento
 *       403:
 *         description: Solo el creador puede eliminar invitados
 *       404:
 *         description: Evento no encontrado
 */
router.delete(
  '/:id/remove-invite/:userId',
  authenticateToken,
  removeInvitedUserFromEvent,
);

/**
 * @swagger
 * /api/event/visible:
 *   get:
 *     summary: Obtener eventos visibles para el usuario (públicos + privados donde está invitado)
 *     tags: [Eventos Privados]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de eventos visibles
 *       401:
 *         description: No autenticado
 */
router.get('/visible', authenticateToken, getEventosVisibles);

/**
 * @swagger
 * /api/event/calendar:
 *   get:
 *     summary: Obtener eventos para vista de calendario (rango de fechas)
 *     tags: [Eventos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lista de eventos en el rango
 *       400:
 *         description: Parámetros faltantes o inválidos
 *       401:
 *         description: No autenticado
 */

/**
 * @swagger
 * /api/event/{id}:
 *   get:
 *     summary: Obtener un evento por ID
 *     tags: [Eventos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Evento'
 *       404:
 *         description: Evento no encontrado
 *       500:
 *         description: Error del servidor
 */

router.get('/:id', authenticateToken, getEventoById);

export default router;
