import { Usuario, IUsuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

export class UserService {
  async createUser(user: Partial<IUsuario>): Promise<IUsuario | null> {
    try {
      const newUser = new Usuario(user);
      return await newUser.save();
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  async getAllUsers(): Promise<IUsuario[] | null> {
    return await Usuario.find();
  }

  async getUserById(id: string): Promise<IUsuario | null> {
    return await Usuario.findById(id);
  }

  async updateUserById(id: string, userData: Partial<IUsuario>): Promise<IUsuario | null> {
    const user = await Usuario.findById(id);
    if (!user) return null;
    Object.assign(user, userData);
    return user.save();
  }

  async deleteUserById(id: string): Promise<IUsuario | null> {
    return await Usuario.findByIdAndDelete(id);
  }

  async addEventToUser(userId: string, eventId: string): Promise<IUsuario | null> {
    const updatedUser = await Usuario.findByIdAndUpdate(
      userId,
      { $addToSet: { eventos: eventId } },
      { new: true }
    );
    if (updatedUser) {
      await Evento.findByIdAndUpdate(eventId, { $addToSet: { participantes: userId } }, { new: true });
    }
    return updatedUser;
  }

  /* Login */
  async loginUser(username: string, password: string): Promise<IUsuario | null> {
    try {
      const user = await Usuario.findOne({ username });
      if (!user) {
        return null;
      }
      
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return null;
      }
    
      
      return user;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  /* Create default admin user */
  async createAdminUser(): Promise<void> {
    try {
      const adminExists = await Usuario.findOne({ username: 'admin' });
      if (!adminExists) {
        const adminUser = new Usuario({
          username: 'admin',
          gmail: 'admin@example.com',
          password: 'admin',
          birthday: new Date('2000-01-01'),
          rol: 'admin'
        });
        await adminUser.save();
        console.log('Usuario admin creado exitosamente');
      } else {
        console.log('Usuario admin ya existe');
      }
    } catch (error) {
      console.error('Error creando usuario admin:', error);
    }
  }

  /**
  * Busca un usuario por su ID y actualiza su estado a inactivo.
  * @param id - El ID del usuario a deshabilitar.
  * @returns El documento del usuario actualizado o null si no se encontró.
  */
  async disableUser(id: string): Promise<IUsuario | null> {
  const user = await Usuario.findById(id);
  if (!user) {
    return null;
  } 
  const updatedUser = await Usuario.findByIdAndUpdate(
    id,
    { $set: { isActive: !user.isActive } },
    { new: true }
  );

  return updatedUser;
  }

  async listUsers(page = 1, limit = 20, q = '') {
  const filter: any = {};
  if (q) {
    filter.$or = [
      { username: { $regex: q, $options: 'i' } },
      { gmail: { $regex: q, $options: 'i' } }
    ];
  }
  const totalItems = await Usuario.countDocuments(filter);
  const data = await Usuario.find(filter)
    .sort({ username: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('_id username gmail online');
  return { data, page, totalPages: Math.ceil(totalItems / limit), totalItems };
}

async listFriends(userId: string, page = 1, limit = 20, q = '') {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error('ID inválido');

  const me = await Usuario.findById(userId).select('friends');
  const friendsIds = me?.friends ?? [];

  const filter: any = { _id: { $in: friendsIds } };
  if (q) {
    filter.$or = [
      { username: { $regex: q, $options: 'i' } },
      { gmail: { $regex: q, $options: 'i' } }
    ];
  }

  const totalItems = await Usuario.countDocuments(filter);
  const data = await Usuario.find(filter)
    .sort({ username: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('_id username gmail online');

  return { data, page, totalPages: Math.ceil(totalItems / limit), totalItems };
}

async addFriend(userId: string, friendId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
    throw new Error('ID inválido');
  }
  if (userId === friendId) throw new Error('No puedes agregarte a ti mismo');

  // agrega si no existe
  await Usuario.findByIdAndUpdate(userId, { $addToSet: { friends: friendId } });
  // opcional: agrega recíproco
  // await Usuario.findByIdAndUpdate(friendId, { $addToSet: { friends: userId } });

  return { ok: true };
}

async removeFriend(userId: string, friendId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
    throw new Error('ID inválido');
  }
  await Usuario.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
  // opcional: recíproco
  // await Usuario.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
  return { ok: true };
}

  async setStatus(userId: string, online: boolean) {
    const update: any = { online };
    if (!online) update.lastSeen = new Date();
    const doc = await Usuario.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select('_id username online lastSeen')
      .lean();
    if (!doc) throw new Error('Usuario no encontrado');
    return doc;
  }

  // “Heartbeat”: marca online y actualiza lastSeen cada X minutos
  async  heartbeat(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('ID inválido');
  }
  return await Usuario.findByIdAndUpdate(
    userId,
    { online: true, lastSeen: new Date() },
    { new: true, select: '_id username online lastSeen' }
  );
}
}

export default new UserService();
