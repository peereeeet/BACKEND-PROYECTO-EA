import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserEvents,
  updateUserById,
  deleteUserById,
  deleteWithPassword,
  forgotPassword,
  resetPassword,
  addEventToUser,
  updateOwnProfile,
  loginUser,           
  createAdminUser,
  checkEmailExists,
  checkUsernameExists,
  getPlainPassword,
  disableUser,    
  refreshToken,   
  updateUserRole,
  sendFriendRequest,
  getSentRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests, 
  listFriends,
  putOnline, 
  putOffline, 
  removeFriendBoth,
  postHeartbeat
} from '../controller/usuarioController';
import{ authenticateToken, authenticateadminToken, authenticateRefreshToken } from '../auth/middleware';
import Usuario from '../models/usuario';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Usuario:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: string
 *           description: ID generado por MongoDB
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         birthday:
 *           type: string
 *           format: date
 *       example:
 *         username: "usuarioEjemplo"
 *         email: "usuario@ejemplo.com"
 *         password: "123456"
 *         birthday: "2000-01-01"
 */

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Usuario'
 */
router.get('/', getAllUsers);

/**
 * @swagger
 * /api/user:
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Usuario'
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Error en los datos del usuario
 */
router.post('/', createUser);

/**
 * @swagger
 * /api/user/{id}:
 *   get:
 *     summary: Obtener un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', getUserById);



/**
 * @swagger
 * /api/user/{id}:
 *   put:
 *     summary: Actualizar un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Usuario'
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id', authenticateadminToken, updateUserById);

router.put('/:id/self', authenticateToken, updateOwnProfile);



/**
 * @swagger
 * /api/user/{id}:
 *   delete:
 *     summary: Eliminar un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/:id',authenticateadminToken, deleteUserById);

router.patch('/:id/delete-with-password', deleteWithPassword);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);


/**
 * @swagger
 * /api/user/{id}/addEvent:
 *   put:
 *     summary: Añadir evento a un usuario
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Evento añadido al usuario exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id/addEvent', authenticateadminToken, addEventToUser);

/**
 * @swagger
 * /api/user/auth/login:
 *   post:
 *     summary: Iniciar sesión de usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Credenciales incorrectas
 */
router.post('/auth/login', loginUser);

/**
 * @swagger
 * /api/user/auth/create-admin:
 *   post:
 *     summary: Crear usuario admin (solo desarrollo)
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: Usuario admin creado/verificado
 */
router.post('/auth/create-admin', createAdminUser);

/**
 * @swagger
 * /api/user/{id}/disable:
 *   patch:
 *     summary: Deshabilita un usuario por ID
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a deshabilitar
 *   responses:
 *     '200':
 *       description: Usuario deshabilitado exitosamente
 *     '404':
 *       description: Usuario no encontrado
 *     '500':
 *       description: Error del servidor
 */
router.patch('/:id/disable',authenticateadminToken, disableUser);
router.get('/:id/events', getUserEvents);
router.get('/:id/plain-password', getPlainPassword);

router.post('/check-email', checkEmailExists);
router.post('/check-username', checkUsernameExists);

router.post('/refresh', authenticateRefreshToken, refreshToken);
router.put('/:id/rol', authenticateRefreshToken, updateUserRole);

router.post('/friend-request',authenticateToken, sendFriendRequest);
router.post('/friend-accept',authenticateToken, acceptFriendRequest);
router.post('/friend-reject',authenticateToken, rejectFriendRequest);
router.get('/friend-requests/:userId',authenticateToken, getFriendRequests);
router.delete('/:id/friends/:friendId',authenticateToken, removeFriendBoth);
router.get('/:id/friends',authenticateToken, listFriends);
router.get('/:id/requests/sent',authenticateToken, getSentRequests);

router.put('/:id/online', putOnline);
router.put('/:id/offline', putOffline);
router.post('/:id/heartbeat', postHeartbeat);

export default router;