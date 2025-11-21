import { Request, Response } from 'express';
import { IUsuario } from '../models/usuario';
import { UserService } from '../services/usuarioServices';
import { validationResult } from 'express-validator';
import Usuario from '../models/usuario';
import { generateToken, generateRefreshToken } from '../auth/token';
import mongoose from 'mongoose';
import {logger } from '../config/logger';

const userService = new UserService();
const Evento = mongoose.model('Evento');

export async function createUser(req: Request, res: Response): Promise<Response> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error(`Errores de validación al crear usuario:${errors.array()}`);
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, gmail, password, birthday, rol } = req.body as IUsuario;
    const newUser: Partial<IUsuario> = { username, gmail, password, birthday, rol: rol || 'usuario' };
    const user = await userService.createUser(newUser);
    logger.info(`Usuario creado: ${user!.username}`);
    return res.status(201).json(user);
  } catch {
    logger.error(`Fallo al crear el usuario`);
    return res.status(500).json({ error: 'FALLO AL CREAR EL USUARIO' });
  }
}

export const deleteWithPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body as { password?: string };

    if (!password) {
      logger.warn('Intento de eliminacion de usuario sin proporcionar contraseña');
      return res.status(400).json({ message: 'Contraseña requerida.' });
    }

    const ok = await userService.verifyPasswordAndDelete(id, password);
    if (!ok) {
      logger.warn(`Contraseña incorrecta para eliminar el usuario con ID: ${id}`);
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }
    logger.info(`Usuario con ID: ${id} eliminado correctamente`);
    return res.status(204).send();
  } catch (err) {
    logger.error(`deleteWithPassword error al eliminar usuario:${err}`);
    console.error('[deleteWithPassword] Error:', err);
    return res.status(500).json({ message: 'No se pudo eliminar la cuenta.' });
  }
};
export async function getUserByEmailOrUsername(req: Request, res: Response) {
  try {
    const { emailOrUsername } = req.body;
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      logger.warn('Falta email o usuario en findUserByEmailOrUsername');  
      return res.status(400).json({ message: 'Falta email o usuario.' });
    }
    const user = await userService.findUserByEmailOrUsername(emailOrUsername);
    if (!user) return res.json({ exists: false });
    return res.json({
      user: user,
      exists: true
    });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Error al comprobar usuario.' });
  }
}
export async function checkUserExistsForReset(req: Request, res: Response) {
  try {
    const { emailOrUsername } = req.body || {};
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      logger.warn('Falta email o usuario en checkUserExistsForReset');  
      return res.status(400).json({ message: 'Falta email o usuario.' });
    }

    const user = await userService.findUserByEmailOrUsername(emailOrUsername); // { _id, username, gmail } | null
    if (!user) return res.json({ exists: false });

    return res.json({
      exists: true,
      userId: String(user._id),
      username: user.username,
      gmail: user.gmail,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Error al comprobar usuario.' });
  }
}

export async function directResetPassword(req: Request, res: Response) {
  try {
    const { userId, newPassword } = req.body || {};
    if (!userId || !newPassword) {
      return res.status(400).json({ message: 'Faltan datos.' });
    }
    await userService.setPasswordByUserId(userId, newPassword);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || 'No se pudo actualizar la contraseña.' });
  }
}

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    if (!['admin', 'usuario'].includes(rol)) {
      logger.warn(`Intento de actualizacion de rol con valor invalido: ${rol}`);
      res.status(400).json({ message: 'Rol invalido' });
      return;
    }

    const usuario = await Usuario.findByIdAndUpdate(id, { rol }, { new: true });
    if (!usuario) {
      logger.warn(`Usuario no encontrado para actualizar rol con ID: ${id}`);
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    logger.info(`Rol del usuario con ID: ${id} actualizado a ${rol}`);
    res.status(200).json({ message: 'Rol actualizado correctamente', usuario });
  } catch (error) {
    logger.error(`Error al actualizar rol del usuario: ${error}`);
    res.status(500).json({ message: 'Error al actualizar rol del usuario', error });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.find().skip(skip).limit(limit).populate('eventos')
    ]);
    logger.info(`Usuarios obtenidos: pagina ${page}, limite ${limit}`);
    res.status(200).json({
      data: users,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    logger.error(`Error al obtener usuarios: ${error}`);
    res.status(500).json({ message: 'Error al obtener usuarios', error });
  }
};

export async function getUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`ID invalido en getUserById: ${id}`);
      return res.status(400).json({ message: 'ID invalido' });
    }
    const user = await userService.getUserById(id);
    if (!user){ 
      logger.warn(`Usuario no encontrado en getUserById con ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    logger.info(`Usuario obtenido con ID: ${id}`);  
    return res.status(200).json(user);
  } catch (error) {
    logger.error(`Error en getUserById: ${error}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const getUserEvents = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`ID invalido en getUserEvents: ${id}`);
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const userId = new mongoose.Types.ObjectId(id);

    const events = await Evento.find({
      $or: [
        { participantes: userId },
        { 'participantes.user': userId },
        { asistentes: userId },
        { 'asistentes.user': userId },
        { participants: userId },
        { 'participants.user': userId },
        { members: userId },
        { 'members.user': userId },
      ]
    })
    .select('name schedule address titulo title fecha date lugar location') 
    .lean();
    logger.info(`Eventos obtenidos para el usuario con ID: ${id}`);
    return res.json({ ok: true, data: events || [] });
  } catch (err) {
    logger.error(`getUserEvents error: ${err}`);
    console.error('getUserEvents error:', err);
    return res.status(500).json({ ok: false, message: 'No se pudieron listar los eventos' });
  }
};

export async function updateOwnProfile(req: Request, res: Response): Promise<Response> {
  try {
    const authId = (req as any)?.user?.payload?.id;
    const { id } = req.params;

    if (!authId || authId !== id) {
      logger.warn(`Intento no autorizado de modificar perfil: authId=${authId}, targetId=${id}`);
      return res.status(403).json({ error: 'Solo puedes modificar tu propio perfil' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`ID invalido en updateOwnProfile: ${id}`);
      return res.status(400).json({ error: 'ID invalido' });
    }

    const { username, gmail, password, birthday } = req.body as Partial<IUsuario>;

    const user = await Usuario.findById(id);
    if (!user){ 
      logger.warn(`Usuario no encontrado en updateOwnProfile con ID: ${id}`);
      return res.status(404).json({ error: 'USUARIO NO ENCONTRADO' });
    }

    if (typeof username === 'string') user.username = username;
    if (typeof gmail === 'string')    user.gmail = gmail;
    if (birthday !== undefined)       user.birthday = new Date(String(birthday)) as any;
    if (typeof password === 'string' && password.trim() !== '') {
      user.password = password;
    }

    const saved = await user.save();
    const userObj = saved.toObject();
    delete (userObj as any).password;
    logger.info(`Perfil actualizado para el usuario con ID: ${id}`);
    return res.status(200).json({ ok: true, user: userObj });
  } catch (e: any) {
    if (e?.code === 11000) {
      logger.warn(`Conflicto al actualizar perfil: usuario o correo ya en uso`);
      return res.status(409).json({ ok: false, error: 'Usuario o correo ya en uso' });
    }
    logger.error(`Error en updateOwnProfile: ${e}`);
    return res.status(500).json({ ok: false, error: 'No se pudo actualizar el perfil' });
  }
}

export async function updateUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const userData: Partial<IUsuario> = req.body;
    const updatedUser = await userService.updateUserById(id, userData);
    if (!updatedUser){
      logger.warn(`Usuario no encontrado en updateUserById con ID: ${id}`); 
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
  }
  logger.info(`Usuario actualizado con ID: ${id}`);
    return res.status(200).json(updatedUser);
  } catch (error) {
    logger.error(`Error en updateUserById: ${error}`);  
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function deleteUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const deletedUser = await userService.deleteUserById(id);
    if (!deletedUser){
      logger.warn(`Usuario no encontrado en deleteUserById con ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    logger.info(`Usuario eliminado con ID: ${id}`);
    return res.status(200).json(deletedUser);
  } catch (error) {
    logger.error(`Error en deleteUserById: ${error}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function addEventToUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { eventId } = req.body;
    if (!eventId){ 
      logger.warn(`Falta eventId en addEventToUser para el usuario con ID: ${id}`);
      return res.status(400).json({ message: 'Falta eventId' });
  }
    const updated = await userService.addEventToUser(id, eventId);
    if (!updated){ 
      logger.warn(`Usuario no encontrado en addEventToUser con ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    logger.info(`Evento ${eventId} agregado al usuario con ID: ${id}`);
    return res.status(200).json(updated);
  } catch (error) {
    logger.error(`Error en addEventToUser: ${error}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}
function removePassword(user: any) {
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
}

export async function loginUser(req: Request, res: Response): Promise<Response> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error(`Errores de validación en loginUser: ${errors.array()}`);
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, password } = req.body;
    
    const user = await userService.loginUser(username, password);
    if (!user) {
      logger.warn(`Credenciales incorrectas para el usuario: ${username}`);
      return res.status(401).json({ 
        message: 'CREDENCIALES INCORRECTAS' 
      });
    }
    const token = await generateToken(user!, res);
    const refreshToken = await generateRefreshToken(user!, res);

    logger.info(`Usuario logueado exitosamente: ${username}`);
    return res.status(200).json({
      message: 'LOGIN EXITOSO',
      user: removePassword(user),
      token,
      refreshToken
    });
  } catch (error) {
    logger.error(`Error en loginUser: ${error}`);
    return res.status(500).json({ error: 'ERROR EN EL LOGIN' });
  }
}

/* Create admin only development */
export async function createAdminUser(req: Request, res: Response): Promise<Response> {
  try {
    await userService.createAdminUser();
    return res.status(200).json({ message: 'Usuario admin verificado/creado' });
  } catch (error) {
    return res.status(500).json({ error: 'Error con usuario admin' });
  }
}

export const checkEmailExists = async (req: Request, res: Response) => {
  try {
    const { gmail, userId } = req.body;

    if (!gmail) {
      logger.warn("Falta gmail en checkEmailExists");
      return res.status(400).json({ exists: false, message: "El campo 'gmail' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ gmail });

    if (!existingUser) {
      logger.info(`Correo disponible: ${gmail}`);
      return res.status(200).json({ exists: false, message: "El correo está disponible" });
    }

    if (userId && existingUser._id.toString() === userId) {
      logger.info(`El correo pertenece al mismo usuario: ${gmail}`);
      return res.status(200).json({ exists: false, message: "El correo pertenece al mismo usuario" });
    }
    logger.info(`El correo ya está registrado: ${gmail}`);
    return res.status(200).json({ exists: true, message: "El correo ya está registrado" });

  } catch (error) {
    logger.error(`Error en checkEmailExists: ${error}`);
    return res.status(500).json({ error: "Error al verificar el correo" });
  }
};

export const checkUsernameExists = async (req: Request, res: Response) => {
  try {
    const { username, userId } = req.body;

    if (!username) {
      logger.warn("Falta username en checkUsernameExists");
      return res.status(400).json({ exists: false, message: "El campo 'username' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ username });

    if (!existingUser) {
      logger.info(`Nombre de usuario disponible: ${username}`);
      return res.status(200).json({ exists: false, message: "Nombre disponible" });
    }

    if (userId && existingUser._id.toString() === userId) {
      logger.info(`El nombre de usuario pertenece al mismo usuario: ${username}`);
      return res.status(200).json({ exists: false, message: "Nombre pertenece al mismo usuario" });
    }
    logger.info(`El nombre de usuario ya está en uso: ${username}`);
    return res.status(200).json({ exists: true, message: "El nombre de usuario ya está en uso" });

  } catch (error) {
    logger.error(`Error en checkUsernameExists: ${error}`);
    return res.status(500).json({ error: "Error al verificar el nombre de usuario" });
  }
};

export async function disableUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const updatedUser = await userService.disableUser(id);

    if (!updatedUser) {
      logger.warn(`Usuario no encontrado en disableUser con ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    logger.info(`Usuario deshabilitado con ID: ${id}`);
    return res.status(200).json(updatedUser);

  } catch (error) {
    logger.error(`Error en disableUser: ${error}`);
    return res.status(500).json({ message: (error as Error).message });
  }

}
export async function refreshToken(req: Request, res: Response): Promise<Response> {
  try {
    const id = (req as any).user.payload.id;
    const user = await userService.getUserById(id);
    if (!user) {  
      logger.warn(`Usuario no encontrado en refreshToken con ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    console.log('Usuario para refresh token:', user);

    const newToken = await generateToken(user, res);
    logger.info(`Nuevo token generado para el usuario con ID: ${id}`);
    console.log('Nuevo token generado:', newToken);
    return res.status(200).json({
      token: newToken
    });
  } catch (error) {
    logger.error(`Error en refreshToken: ${error}`);
    return res.status(500).json({ error: 'ERROR AL ACTUALIZAR EL TOKEN' });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const q = String(req.query.q || '');
    const data = await userService.listUsers(page, limit, q);
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
}

export async function listFriends(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`ID invalido en listFriends: ${id}`);
      return res.status(400).json({ message: 'ID inválido' });
    }
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const q = String(req.query.q || '');
    const data = await userService.listFriends(id, page, limit, q);
    logger.info(`Lista de amigos obtenida para el usuario ${id}`);
    return res.status(200).json(data);
  } catch (e: any) {
    logger.error("Error en listFriends:", e);
    return res.status(400).json({ message: e.message });
  }
}

export async function sendFriendRequest(req: Request, res:Response) {
  try {
    const { id, targetId } = req.body;
    const result = await userService.sendFriendRequest(id, targetId);
    logger.info(`Solicitud de amistad enviada: from: ${id}, to: ${targetId}`); 
    res.status(200).json(result);
  } catch (error:any) {
    logger.error("Error en sendFriendRequest:", error);
    res.status(400).json({ error: error.message });
  }
};

export const getSentRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await userService.getSentRequests(id);
    logger.info(`Lista de solicitudes enviadas obtenida para el usuario ${id}`);
    return res.status(200).json({ ok: true, data });
  } catch (err: any) {
    logger.error("Error en getSentRequests:", err);
    return res.status(400).json({ ok: false, message: err.message || 'Error' });
  }
};

export async function acceptFriendRequest(req:Request, res:Response){
  try {
    const { id, requesterId } = req.body;
    const result = await userService.acceptFriendRequest(id, requesterId);
    logger.info(`Solicitud de amistad aceptada: by: ${id}, from: ${requesterId}`);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error("Error en acceptFriendRequest:", error);
    res.status(400).json({ error: error.message });
  }
};

export async function rejectFriendRequest(req:Request, res:Response){
  try {
    const { id, requesterId } = req.body;
    const result = await userService.rejectFriendRequest(id, requesterId);
    logger.info(`Solicitud de amistad rechazada: by: ${id}, from: ${requesterId}`);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error("Error en rejectFriendRequest:", error);
    res.status(400).json({ error: error.message });
  }
};

export async function getFriendRequests(req:Request, res: Response){
  try {
    const { id } = req.params;
    const requests = await userService.getFriendRequests(id);
    logger.info(`Solicitudes de amistad obtenidas para el usuario ${id}`);
    res.status(200).json(requests);
  } catch (error: any) {
    logger.error("Error en getFriendRequests:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function removeFriend(req: Request, res: Response) {
  try {
    const { id, friendId } = req.params;
    const r = await userService.removeFriend(id, friendId);
    logger.info(`Amigo eliminado: user: ${id}, friend: ${friendId}`); 
    return res.status(200).json(r);
  } catch (e: any) {
    logger.error("Error en removeFriend:", e);
    return res.status(400).json({ message: e.message });
  }
}

export const putOnline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const u = await userService.setUserOnline(id);
    return res.json({ ok: true, online: u?.online === true, lastSeen: u?.lastSeen });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'No se pudo poner online' });
  }
};

export const putOffline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const u = await userService.setUserOffline(id);
    return res.json({ ok: true, online: u?.online === true, lastSeen: u?.lastSeen });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'No se pudo poner offline' });
  }
};

export const postHeartbeat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const u = await userService.heartbeat(id);
    return res.json({ ok: true, online: u?.online === true, lastSeen: u?.lastSeen });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'No se pudo registrar heartbeat' });
  }
};

export const removeFriendBoth = async (req: Request, res: Response) => {
  try {
    const { id, friendId } = req.params;

    if (!id || !friendId) {
      logger.warn('Faltan parametros id o friendId en removeFriendBoth');
      return res.status(400).json({ ok: false, message: 'Faltan parametros id o friendId' });
    }
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(friendId)) {
      logger.warn(`IDs inválidos en removeFriendBoth: id=${id}, friendId=${friendId}`);
      return res.status(400).json({ ok: false, message: 'Alguno de los IDs no es un ObjectId válido' });
    }

    const me = await userService.unlinkFriendsBothWays(id, friendId);
    logger.info(`Amistad eliminada entre usuarios: ${id} y ${friendId}`);
    return res.json({ ok: true, me });

  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Error interno';
    if (msg.startsWith('INVALID_OBJECT_ID')) {
      logger.error(`IDs invalidos en removeFriendBoth: ${msg}`);
      return res.status(400).json({ ok: false, message: 'ID no valido', detail: msg });
    }
    console.error('removeFriendBoth error:', e);
    logger.error(`Error en removeFriendBoth: ${msg}`);
    return res.status(500).json({ ok: false, message: 'No se pudo eliminar la amistad' });
  }
};
  
