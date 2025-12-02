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
  getMisEventos,
  getEventosByBounds
} from '../controller/eventoController';
import { authenticateToken } from '../auth/middleware';

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
router.get('/:id', getEventoById);

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
router.post('/', authenticateToken, createEvento); 

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
router.put('/:id', authenticateToken, updateEventoById);

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

export default router;