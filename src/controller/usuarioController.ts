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
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, gmail, password, birthday, rol } = req.body as IUsuario;
    const newUser: Partial<IUsuario> = { username, gmail, password, birthday, rol: rol || 'usuario' };
    const user = await userService.createUser(newUser);
    return res.status(201).json(user);
  } catch {
    return res.status(500).json({ error: 'FALLO AL CREAR EL USUARIO' });
  }
}

export const deleteWithPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body as { password?: string };

    if (!password) {
      return res.status(400).json({ message: 'Contraseña requerida.' });
    }

    const ok = await userService.verifyPasswordAndDelete(id, password);
    if (!ok) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[deleteWithPassword] Error:', err);
    return res.status(500).json({ message: 'No se pudo eliminar la cuenta.' });
  }
};

export async function checkUserExistsForReset(req: Request, res: Response) {
  try {
    const { emailOrUsername } = req.body || {};
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
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
      res.status(400).json({ message: 'Rol inválido' });
      return;
    }

    const usuario = await Usuario.findByIdAndUpdate(id, { rol }, { new: true });
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json({ message: 'Rol actualizado correctamente', usuario });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar rol del usuario', error });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10)); // límite máximo de 50
    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.find().skip(skip).limit(limit).populate('eventos')
    ]);

    res.status(200).json({
      data: users,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error });
  }
};

export async function getUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const getUserEvents = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    return res.json({ ok: true, data: events || [] });
  } catch (err) {
    console.error('getUserEvents error:', err);
    return res.status(500).json({ ok: false, message: 'No se pudieron listar los eventos' });
  }
};

export async function updateOwnProfile(req: Request, res: Response): Promise<Response> {
  try {
    const authId = (req as any)?.user?.payload?.id;
    const { id } = req.params;

    if (!authId || authId !== id) {
      return res.status(403).json({ error: 'Solo puedes modificar tu propio perfil' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { username, gmail, password, birthday } = req.body as Partial<IUsuario>;

    const user = await Usuario.findById(id);
    if (!user) return res.status(404).json({ error: 'USUARIO NO ENCONTRADO' });

    if (typeof username === 'string') user.username = username;
    if (typeof gmail === 'string')    user.gmail = gmail;
    if (birthday !== undefined)       user.birthday = new Date(String(birthday)) as any;
    if (typeof password === 'string' && password.trim() !== '') {
      user.password = password;
    }

    const saved = await user.save();
    const userObj = saved.toObject();
    delete (userObj as any).password;

    return res.status(200).json({ ok: true, user: userObj });
  } catch (e: any) {
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, error: 'Usuario o correo ya en uso' });
    }
    return res.status(500).json({ ok: false, error: 'No se pudo actualizar el perfil' });
  }
}

export const getPlainPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const user = await mongoose.model('Usuario').findById(id).select('+plainPassword +password').lean();
    if (!user) return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });

    if ((user as any).plainPassword) {
      return res.json({ ok: true, plainPassword: (user as any).plainPassword });
    }

    return res.json({ ok: true, hashed: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'No se pudo obtener la contraseña' });
  }
};

export async function updateUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const userData: Partial<IUsuario> = req.body;
    const updatedUser = await userService.updateUserById(id, userData);
    if (!updatedUser) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function deleteUserById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const deletedUser = await userService.deleteUserById(id);
    if (!deletedUser) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(deletedUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function addEventToUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: 'Falta eventId' });
    const updated = await userService.addEventToUser(id, eventId);
    if (!updated) return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
  /* Auxiliar function to eliminate the password of the user object */
function removePassword(user: any) {
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
}

/* Login */
export async function loginUser(req: Request, res: Response): Promise<Response> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { username, password } = req.body;
    
    const user = await userService.loginUser(username, password);
    if (!user) {
      return res.status(401).json({ 
        message: 'CREDENCIALES INCORRECTAS' 
      });
    }
    const token = await generateToken(user!, res);
    const refreshToken = await generateRefreshToken(user!, res);

    return res.status(200).json({
      message: 'LOGIN EXITOSO',
      user: removePassword(user),
      token,
      refreshToken
    });
  } catch (error) {
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
      return res.status(400).json({ exists: false, message: "El campo 'gmail' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ gmail });

    if (!existingUser) {
      return res.status(200).json({ exists: false, message: "El correo está disponible" });
    }

    if (userId && existingUser._id.toString() === userId) {
      return res.status(200).json({ exists: false, message: "El correo pertenece al mismo usuario" });
    }

    return res.status(200).json({ exists: true, message: "El correo ya está registrado" });

  } catch (error) {
    res.status(500).json({ error: "Error al verificar el correo" });
  }
};

export const checkUsernameExists = async (req: Request, res: Response) => {
  try {
    const { username, userId } = req.body;

    if (!username) {
      return res.status(400).json({ exists: false, message: "El campo 'username' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ username });

    if (!existingUser) {
      return res.status(200).json({ exists: false, message: "Nombre disponible" });
    }

    if (userId && existingUser._id.toString() === userId) {
      return res.status(200).json({ exists: false, message: "Nombre pertenece al mismo usuario" });
    }

    return res.status(200).json({ exists: true, message: "El nombre de usuario ya está en uso" });

  } catch (error) {
    res.status(500).json({ error: "Error al verificar el nombre de usuario" });
  }
};

export async function disableUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params; // Obtenemos el ID de la URL

    // Llamamos al servicio para que haga la lógica de negocio
    const updatedUser = await userService.disableUser(id);

    // Si el servicio no encuentra el usuario, devolvemos un 404
    if (!updatedUser) {
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }

    // Si todo va bien, devolvemos el usuario actualizado
    return res.status(200).json(updatedUser);

  } catch (error) {
    // Manejo de cualquier otro error
    return res.status(500).json({ message: (error as Error).message });
  }

}
export async function refreshToken(req: Request, res: Response): Promise<Response> {
  try {
    const id = (req as any).user.payload.id;
    const user = await userService.getUserById(id);
    if (!user) {  
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }
    console.log('Usuario para refresh token:', user);

    const newToken = await generateToken(user, res);
    console.log('Nuevo token generado:', newToken);
    return res.status(200).json({
      token: newToken
    });
  } catch (error) {
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
      return res.status(400).json({ message: 'ID inválido' });
    }
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const q = String(req.query.q || '');
    const data = await userService.listFriends(id, page, limit, q);
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
}

export async function sendFriendRequest(req: Request, res:Response) {
  try {
    const { userId, targetId } = req.body;
    const result = await userService.sendFriendRequest(userId, targetId);
    res.status(200).json(result);
  } catch (error:any) {
    res.status(400).json({ error: error.message });
  }
};

export const getSentRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await userService.getSentRequests(id);
    return res.status(200).json({ ok: true, data });
  } catch (err: any) {
    return res.status(400).json({ ok: false, message: err.message || 'Error' });
  }
};

export async function acceptFriendRequest(req:Request, res:Response){
  try {
    const { userId, requesterId } = req.body;
    const result = await userService.acceptFriendRequest(userId, requesterId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export async function rejectFriendRequest(req:Request, res:Response){
  try {
    const { userId, requesterId } = req.body;
    const result = await userService.rejectFriendRequest(userId, requesterId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export async function getFriendRequests(req:Request, res: Response){
  try {
    const { userId } = req.params;
    const requests = await userService.getFriendRequests(userId);
    res.status(200).json(requests);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function removeFriend(req: Request, res: Response) {
  try {
    const { id, friendId } = req.params;
    const r = await userService.removeFriend(id, friendId);
    return res.status(200).json(r);
  } catch (e: any) {
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
      return res.status(400).json({ ok: false, message: 'Faltan parámetros id o friendId' });
    }
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ ok: false, message: 'Alguno de los IDs no es un ObjectId válido' });
    }

    const me = await userService.unlinkFriendsBothWays(id, friendId);
    return res.json({ ok: true, me });

  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Error interno';
    if (msg.startsWith('INVALID_OBJECT_ID')) {
      return res.status(400).json({ ok: false, message: 'ID no válido', detail: msg });
    }
    console.error('removeFriendBoth error:', e);
    return res.status(500).json({ ok: false, message: 'No se pudo eliminar la amistad' });
  }
};
  
