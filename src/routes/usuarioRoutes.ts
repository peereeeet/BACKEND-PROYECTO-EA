import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  getUserEvents,
  updateUserById,
  deleteUserById,
  deleteWithPassword,
  checkUserExistsForReset,
  directResetPassword,
  addEventToUser,
  updateOwnProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  loginUser,
  //createAdminUser,
  checkEmailExists,
  checkUsernameExists,
  disableUser,
  refreshToken,
  updateUserRole,
  sendFriendRequest,
  getSentRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  listFriends,
  removeFriendBoth,
  getChatBetween,
  postChatMessage,
  getEventChatForEvent,
  postEventChatMessage,
  postHeartbeat,
  loginWithGoogle,
  blockUser,
  unblockUser,
  checkGoogleUser,
  getBlockedUsers,
  updateInterests,
  deleteEventChatMessage,
  uploadChatImage,
  deleteChatMessage,
  getVisibleUsers,
} from '../controller/usuarioController';
import {
  validateUserContent,
  validateMessageContent,
} from '../profanityMiddleware';
import {
  authenticateToken,
  authenticateadminToken,
  authenticateOwner,
  authenticateRefreshToken,
} from '../auth/middleware';
import { registerValidation } from '../userValidators';
import { uploadProfilePhoto as uploadPhotoMiddleware } from '../config/uploadConfig';
import { uploadFriendChatImage } from '../config/uploadConfig';

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
router.post('/', registerValidation, validateUserContent, createUser);

/**
 * @swagger
 * /api/user/visible:
 *   get:
 *     summary: Obtener usuarios visibles (excluye al usuario actual y admins)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de usuarios por página
 *     responses:
 *       200:
 *         description: Lista de usuarios visibles obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Usuario'
 *                 totalItems:
 *                   type: number
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *       401:
 *         description: No autenticado
 */
router.get('/visibleusers', authenticateToken, getVisibleUsers);

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

/**
 * @swagger
 * /api/user/{id}:
 *   put:
 *     summary: Actualizar usuario por ID (admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
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
 *         description: Usuario actualizado correctamente
 *       400:
 *         description: Error en los datos del usuario
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/:id', authenticateadminToken, validateUserContent, updateUserById);

/**
 * @swagger
 * /api/user/{id}/self:
 *   put:
 *     summary: Actualizar tu propio perfil
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario (debe coincidir con el token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Usuario'
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *       400:
 *         description: Error en los datos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  '/:id/self',
  authenticateOwner,
  validateUserContent,
  updateOwnProfile,
);

/**
 * @swagger
 * /api/user/{id}/profile-photo:
 *   post:
 *     summary: Subir foto de perfil
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto de perfil subida exitosamente
 *       400:
 *         description: Error en la solicitud
 *       403:
 *         description: No autorizado
 */
router.post(
  '/:id/profile-photo',
  authenticateOwner,
  uploadPhotoMiddleware.single('photo'),
  uploadProfilePhoto,
);

/**
 * @swagger
 * /api/user/{id}/profile-photo:
 *   delete:
 *     summary: Eliminar foto de perfil
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Foto de perfil eliminada exitosamente
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/:id/profile-photo', authenticateOwner, deleteProfilePhoto);

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
router.delete('/:id', authenticateadminToken, deleteUserById);

/**
 * @swagger
 * /api/user/{id}/delete-with-password:
 *   patch:
 *     summary: Eliminar usuario proporcionando contraseña (propietario)
 *     tags: [Usuarios]
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
 *               password:
 *                 type: string
 *     responses:
 *       204:
 *         description: Usuario eliminado correctamente
 *       400:
 *         description: Contraseña requerida o inválida
 *       401:
 *         description: Contraseña incorrecta
 *       404:
 *         description: Usuario no encontrado
 */
router.patch(
  '/:id/delete-with-password',
  authenticateOwner,
  deleteWithPassword,
);

/**
 * @swagger
 * /api/user/forgot-password/check:
 *   post:
 *     summary: Comprobar si existe un usuario para restablecer contraseña
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gmail:
 *                 type: string
 *                 description: Correo del usuario que quiere restablecer la contraseña
 *     responses:
 *       200:
 *         description: Usuario encontrado o mensaje indicando que no existe
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post('/forgot-password/check', checkUserExistsForReset);

/**
 * @swagger
 * /api/user/reset-password/direct:
 *   post:
 *     summary: Restablecer contraseña directamente
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gmail:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/reset-password/direct', directResetPassword);

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

router.post('/auth/google', loginWithGoogle);

router.post('/auth/google/check', checkGoogleUser);

/*
 * @swagger
 * /api/user/auth/create-admin:
 *   post:
 *     summary: Crear usuario admin (solo desarrollo)
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: Usuario admin creado/verificado
 
router.post('/auth/create-admin', createAdminUser);*/

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
router.patch('/:id/disable', authenticateadminToken, disableUser);

/**
 * @swagger
 * /api/user/{id}/events:
 *   get:
 *     summary: Obtener eventos asociados a un usuario
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
 *         description: Lista de eventos del usuario
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:id/events', getUserEvents);

/**
 * @swagger
 * /api/user/check-email:
 *   post:
 *     summary: Comprobar si un email ya está registrado
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post('/check-email', checkEmailExists);

/**
 * @swagger
 * /api/user/check-username:
 *   post:
 *     summary: Comprobar si un nombre de usuario ya está registrado
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post('/check-username', checkUsernameExists);

router.post('/refresh', authenticateRefreshToken, refreshToken);

/**
 * @swagger
 * /api/user/{id}/rol:
 *   put:
 *     summary: Actualizar el rol de un usuario
 *     tags: [Usuarios]
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
 *               rol:
 *                 type: string
 *                 enum: [admin, usuario]
 *     responses:
 *       200:
 *         description: Rol actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.put('/:id/rol', authenticateadminToken, updateUserRole);

/**
 * @swagger
 * /api/user/friend-request:
 *   post:
 *     summary: Enviar solicitud de amistad
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID del usuario que envía la solicitud
 *               targetId:
 *                 type: string
 *                 description: ID del usuario objetivo
 *     responses:
 *       200:
 *         description: Solicitud de amistad enviada
 *       400:
 *         description: Error al enviar la solicitud
 *       500:
 *         description: Error del servidor
 */
router.post('/friend-request', authenticateToken, sendFriendRequest);

/**
 * @swagger
 * /api/user/friend-accept:
 *   post:
 *     summary: Aceptar una solicitud de amistad
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID del usuario que acepta
 *               requesterId:
 *                 type: string
 *                 description: ID del usuario que envió la solicitud
 *     responses:
 *       200:
 *         description: Solicitud de amistad aceptada
 *       400:
 *         description: Error al aceptar la solicitud
 *       500:
 *         description: Error del servidor
 */
router.post('/friend-accept', authenticateToken, acceptFriendRequest);

/**
 * @swagger
 * /api/user/friend-reject:
 *   post:
 *     summary: Rechazar una solicitud de amistad
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID del usuario que rechaza
 *               requesterId:
 *                 type: string
 *                 description: ID del usuario que envió la solicitud
 *     responses:
 *       200:
 *         description: Solicitud de amistad rechazada
 *       400:
 *         description: Error al rechazar la solicitud
 *       500:
 *         description: Error del servidor
 */
router.post('/friend-reject', authenticateToken, rejectFriendRequest);

/**
 * @swagger
 * /api/user/friend-requests/{id}:
 *   get:
 *     summary: Obtener solicitudes de amistad recibidas por un usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de solicitudes de amistad
 *       400:
 *         description: Petición incorrecta
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/friend-requests/:id', authenticateOwner, getFriendRequests);

/**
 * @swagger
 * /api/user/{id}/friends/{friendId}:
 *   delete:
 *     summary: Eliminar una amistad entre dos usuarios
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Amistad eliminada correctamente
 *       400:
 *         description: Petición incorrecta
 *       404:
 *         description: Usuario o amigo no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id/friends/:friendId', authenticateOwner, removeFriendBoth);

/**
 * @swagger
 * /api/user/{id}/friends:
 *   get:
 *     summary: Listar amigos de un usuario
 *     tags: [Usuarios]
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
 *         description: Lista de amigos
 *       400:
 *         description: Petición incorrecta
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:id/friends', authenticateOwner, listFriends);

/**
 * @swagger
 * /api/user/{id}/requests/sent:
 *   get:
 *     summary: Listar solicitudes de amistad enviadas por un usuario
 *     tags: [Usuarios]
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
 *         description: Lista de solicitudes enviadas
 *       400:
 *         description: Petición incorrecta
 *       404:
 *         description: Usuario no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:id/requests/sent', authenticateOwner, getSentRequests);

/**
 * @swagger
 * /api/user/info/block:
 *   post:
 *     summary: Bloquear a un usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               blockId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario bloqueado
 */
router.post('/info/block', authenticateToken, blockUser);

/**
 * @swagger
 * /api/user/info/unblock:
 *   post:
 *     summary: Desbloquear a un usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               unblockId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario desbloqueado
 */
router.post('/info/unblock', authenticateToken, unblockUser);

/**
 * @swagger
 * /api/user/{id}/blocked:
 *   get:
 *     summary: Obtener lista de usuarios bloqueados
 *     tags: [Usuarios]
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
 *         description: Lista de bloqueados
 */
router.get('/:id/blocked', authenticateOwner, getBlockedUsers);

/**
 * @swagger
 * /api/user/{id}/heartbeat:
 *   post:
 *     summary: Registrar el heartbeat (última conexión) de un usuario
 *     tags: [Usuarios]
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
 *         description: Heartbeat registrado
 *       500:
 *         description: Error del servidor
 */
router.post('/:id/heartbeat', authenticateOwner, postHeartbeat);

/**
 * @swagger
 * /api/user/interests:
 *   post:
 *     summary: Actualizar los intereses del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Intereses actualizados
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.post('/interests/update', authenticateToken, updateInterests);

/**
 * @swagger
 * /api/user/{userId}/chat/{friendId}:
 *   get:
 *     summary: Obtener mensajes de chat entre dos usuarios
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensajes de chat
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.get('/:userId/chat/:friendId', getChatBetween);

/**
 * @swagger
 * /api/user/{userId}/chat/{friendId}:
 *   post:
 *     summary: Enviar un mensaje de chat entre dos usuarios
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Mensaje creado correctamente
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post('/:userId/chat/:friendId', validateMessageContent, postChatMessage);

/**
 * @swagger
 * /api/user/events/{eventId}/chat:
 *   get:
 *     summary: Obtener mensajes de chat de un evento
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensajes de chat del evento
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.get('/events/:eventId/chat', getEventChatForEvent);

/**
 * @swagger
 * /api/user/events/{eventId}/chat:
 *   post:
 *     summary: Enviar mensaje al chat de un evento
 *     tags: [Usuarios]
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *               userId:
 *                 type: string
 *               username:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mensaje creado correctamente
 *       400:
 *         description: Petición incorrecta
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/events/:eventId/chat',
  validateMessageContent,
  postEventChatMessage,
);

/**
 * @swagger
 * /api/user/events/chat/{messageId}:
 *   delete:
 *     summary: Eliminar un mensaje del chat de evento
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del mensaje a eliminar
 *     responses:
 *       200:
 *         description: Mensaje eliminado correctamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No tienes permiso para eliminar este mensaje
 *       404:
 *         description: Mensaje no encontrado
 */
router.delete(
  '/events/chat/:messageId',
  authenticateToken,
  deleteEventChatMessage,
);

/**
 * @swagger
 * /api/user/{userId}/chat/{friendId}/image:
 *   post:
 *     summary: Subir una imagen al chat con un amigo
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: friendId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagen subida correctamente
 *       401:
 *         description: No autenticado
 *       400:
 *         description: Error en la solicitud
 */
router.post(
  '/:userId/chat/:friendId/image',
  authenticateToken,
  uploadFriendChatImage.single('image'),
  uploadChatImage,
);

/**
 * @swagger
 * /api/user/chat/{messageId}:
 *   delete:
 *     summary: Eliminar un mensaje del chat con amigo
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del mensaje a eliminar
 *     responses:
 *       200:
 *         description: Mensaje eliminado correctamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No tienes permiso para eliminar este mensaje
 *       404:
 *         description: Mensaje no encontrado
 */
router.delete('/chat/:messageId', authenticateToken, deleteChatMessage);

export default router;
