import { Usuario, IUsuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import bcrypt from 'bcryptjs';
import {
  ChatMessageModel,
  IChatMessage,
  EventChatMessageModel,
  IEventChatMessage,
} from '../models/usuario';
import { io } from '../index';
import gamificacionService from './gamificacionServices';

function oid(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`INVALID_OBJECT_ID:${id}`);
  }
  return new Types.ObjectId(id);
}

export class UserService {
  async createUser(user: Partial<IUsuario>): Promise<IUsuario | null> {
    try {
      const newUser = new Usuario(user);
      logger.info('Usuario Creado correctamente');
      return await newUser.save();
    } catch (error) {
      logger.error('No se pudo crear el usuario');
      throw new Error((error as Error).message);
    }
  }

  async getAllUsers(): Promise<IUsuario[] | null> {
    return await Usuario.find();
  }

  async getUserById(id: string): Promise<IUsuario | null> {
    return await Usuario.findById(id);
  }

  async listUserEvents(userId: string) {
    const _id = oid(userId);

    const Evento = mongoose.models.Evento || mongoose.model('Evento');
    const evs = await Evento.find({ participants: _id })
      .select('titulo title fecha date lugar location participants')
      .lean();

    return evs;
  }

  async updateUserById(
    id: string,
    userData: Partial<IUsuario>,
  ): Promise<IUsuario | null> {
    const user = await Usuario.findById(id);
    if (!user) {
      logger.warn('El usuario no existe');
      return null;
    }
    Object.assign(user, userData);
    logger.info('Usuario actualizado');
    return user.save();
  }

  async deleteUserById(id: string): Promise<IUsuario | null> {
    return await Usuario.findByIdAndDelete(id);
  }

  async verifyPasswordAndDelete(
    id: string,
    password: string,
  ): Promise<boolean> {
    const user = await Usuario.findById(id).exec();
    if (!user) return false;

    const stored = (user as any).password;

    let match = false;
    if (stored && typeof stored === 'string') {
      if (
        stored.startsWith('$2a$') ||
        stored.startsWith('$2b$') ||
        stored.startsWith('$2y$')
      ) {
        try {
          match = await bcrypt.compare(password, stored);
        } catch {
          match = false;
        }
      } else {
        match = stored === password;
      }
    }

    if (!match) return false;
    await this.disableUser(id);
    return true;
  }

  async addEventToUser(
    userId: string,
    eventId: string,
  ): Promise<IUsuario | null> {
    const updatedUser = await Usuario.findByIdAndUpdate(
      userId,
      { $addToSet: { eventos: eventId } },
      { new: true },
    );
    if (updatedUser) {
      await Evento.findByIdAndUpdate(
        eventId,
        { $addToSet: { participantes: userId } },
        { new: true },
      );
      logger.info(
        `Evento añadido correctamente al usuario ${updatedUser.username}`,
      );
    }
    return updatedUser;
  }

  async loginUser(
    username: string,
    password: string,
  ): Promise<IUsuario | null> {
    try {
      const user = await Usuario.findOne({ username });
      if (!user) {
        logger.error('Usuario no encontrado');
        return null;
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.error('Contraseña incorrecta');
        return null;
      }

      logger.info('El usuario ha iniciado sesion');
      return user;
    } catch (error) {
      logger.error('Error al iniciar sesion');
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
          rol: 'admin',
        });
        await adminUser.save();
        logger.info('Usuario admin creado exitosamente');
      } else {
        logger.info('Usuario admin ya existe');
      }
    } catch (error) {
      logger.error({ error }, 'Error creando usuario admin');
    }
  }

  async findUserByEmailOrUsername(emailOrUsername: string) {
    if (!emailOrUsername || typeof emailOrUsername !== 'string') return null;
    return await Usuario.findOne({
      $or: [{ gmail: emailOrUsername }, { username: emailOrUsername }],
    })
      .select('_id username gmail')
      .lean();
  }

  async setPasswordByUserId(userId: string, newPassword: string) {
    if (!userId || !newPassword) throw new Error('Faltan datos');
    const user = await Usuario.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    user.password = newPassword;
    await user.save();
  }

  /**
   * Busca un usuario por su ID y actualiza su estado a inactivo.
   * @param id - El ID del usuario a deshabilitar.
   * @returns El documento del usuario actualizado o null si no se encontró.
   */
  async disableUser(id: string): Promise<IUsuario | null> {
    const user = await Usuario.findById(id);
    if (!user) {
      logger.error('El usuario no existe');
      return null;
    }
    const updatedUser = await Usuario.findByIdAndUpdate(
      id,
      { $set: { isActive: !user.isActive } },
      { new: true },
    );
    logger.info(`Usuario ${updatedUser} deshabilitado`);
    return updatedUser;
  }

  async listUsers(page = 1, limit = 20, q = '') {
    const filter: any = {};
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { gmail: { $regex: q, $options: 'i' } },
      ];
    }
    const totalItems = await Usuario.countDocuments(filter);
    const data = await Usuario.find(filter)
      .sort({ username: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id username gmail online');
    return {
      data,
      page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
    };
  }

  async listFriends(userId: string, page = 1, limit = 20, q = '') {
    if (!mongoose.Types.ObjectId.isValid(userId))
      throw new Error('ID inválido');

    const me = await Usuario.findById(userId).select('friends');
    const friendsIds = me?.friends ?? [];

    const filter: any = { _id: { $in: friendsIds } };
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { gmail: { $regex: q, $options: 'i' } },
      ];
    }

    const totalItems = await Usuario.countDocuments(filter);
    const data = await Usuario.find(filter)
      .sort({ username: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id username gmail online');

    return {
      data,
      page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
    };
  }

  async sendFriendRequest(fromId: string, toId: string) {
    if (!Types.ObjectId.isValid(fromId) || !Types.ObjectId.isValid(toId)) {
      throw new Error('Invalid user id');
    }
    if (fromId === toId)
      throw new Error('No puedes enviarte solicitud a ti mismo');

    const fromOid = new Types.ObjectId(fromId);
    const toOid = new Types.ObjectId(toId);

    const [from, to] = await Promise.all([
      Usuario.findById(fromOid).select(
        '_id username gmail friends sentRequests',
      ),
      Usuario.findById(toOid).select('_id username gmail friendRequest'),
    ]);
    if (!from || !to) throw new Error('Usuario no encontrado');

    const alreadyFriends =
      (from.friends ?? []).some((id) => String(id) === String(toId)) ||
      (to.friends ?? []).some((id) => String(id) === String(fromId));
    if (alreadyFriends) return { ok: true, message: 'Ya sois amigos' };

    const alreadyPendingIncoming = (to.friendRequest ?? []).some(
      (id) => String(id) === String(fromId),
    );
    const alreadyPendingOutgoing = (from.sentRequests ?? []).some(
      (id) => String(id) === String(toId),
    );
    if (alreadyPendingIncoming && alreadyPendingOutgoing) {
      return { ok: true, message: 'Solicitud ya enviada' };
    }

    const [r1, r2] = await Promise.all([
      Usuario.updateOne(
        { _id: toOid },
        { $addToSet: { friendRequest: fromOid } },
      ),
      Usuario.updateOne(
        { _id: fromOid },
        { $addToSet: { sentRequests: toOid } },
      ),
    ]);

    const debug = {
      toMatched: r1.matchedCount ?? (r1 as any).nMatched,
      toModified: r1.modifiedCount ?? (r1 as any).nModified,
      fromMatched: r2.matchedCount ?? (r2 as any).nMatched,
      fromModified: r2.modifiedCount ?? (r2 as any).nModified,
    };

    const [toAfter, fromAfter] = await Promise.all([
      Usuario.findById(toOid).select('_id friendRequest').lean(),
      Usuario.findById(fromOid).select('_id sentRequests').lean(),
    ]);

    io.to(`user:${toId}`).emit('friendRequest:received', {
      fromUserId: from._id.toString(),
      fromUsername: from.username,
      fromGmail: from.gmail,
    });

    return {
      ok: true,
      message: 'Solicitud enviada',
      debug,
      toFriendRequestCount: (toAfter?.friendRequest ?? []).length,
      fromSentRequestsCount: (fromAfter?.sentRequests ?? []).length,
    };
  }

  async acceptFriendRequest(userId: string, requesterId: string) {
    logger.info(userId);
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(requesterId)
    ) {
      throw new Error('Invalid user id');
    }

    const [user, requester] = await Promise.all([
      Usuario.findById(userId).select('_id friendRequest'),
      Usuario.findById(requesterId).select('_id sentRequests'),
    ]);
    if (!user || !requester) throw new Error('Usuario no encontrado');

    const requesterObjectId = new mongoose.Types.ObjectId(requesterId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (
      !(user.friendRequest ?? []).some(
        (id) => String(id) === String(requesterId),
      )
    ) {
      throw new Error('No hay solicitud pendiente de este usuario');
    }

    await Promise.all([
      Usuario.updateOne(
        { _id: userId },
        {
          $addToSet: { friends: requesterObjectId },
          $pull: { friendRequest: requesterObjectId },
        },
      ),
      Usuario.updateOne(
        { _id: requesterId },
        {
          $addToSet: { friends: userObjectId },
          $pull: { sentRequests: userObjectId },
        },
      ),
    ]);

    try {
      await Promise.all([
        gamificacionService.otorgarPuntos(userId, 'hacerAmigo'),
        gamificacionService.otorgarPuntos(requesterId, 'hacerAmigo'),
      ]);
    } catch (err) {
      logger.error(`Error al otorgar puntos por amistad: ${err}`);
    }

    return { message: 'Solicitud aceptada correctamente' };
  }

  async rejectFriendRequest(userId: string, requesterId: string) {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(requesterId)
    ) {
      throw new Error('Invalid user id');
    }

    await Promise.all([
      Usuario.updateOne(
        { _id: userId },
        { $pull: { friendRequest: requesterId } },
      ),
      Usuario.updateOne(
        { _id: requesterId },
        { $pull: { sentRequests: userId } },
      ),
    ]);

    return { message: 'Solicitud rechazada' };
  }

  async getFriendRequests(userId: string) {
    const user = await Usuario.findById(userId).populate(
      'friendRequest',
      'username gmail',
    );
    if (!user) throw new Error('Usuario no encontrado');
    logger.info('Enviando solicitudes de amistad');
    return user.friendRequest;
  }

  async getSentRequests(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }

    const user = await Usuario.findById(userId)
      .populate('sentRequests', 'username gmail online')
      .lean();

    if (!user) throw new Error('Usuario no encontrado');

    const arr = (user.sentRequests ?? []).map((u: any) => ({
      _id: String(u._id),
      username: u.username,
      gmail: u.gmail,
      isOnline: !!(u.online ?? u.isOnline),
    }));
    return arr;
  }

  async removeFriend(userId: string, friendId: string) {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(friendId)
    ) {
      throw new Error('ID inválido');
    }
    await Usuario.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    return { ok: true };
  }

  async setUserOnline(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: true, lastSeen: new Date() },
      { new: true },
    );
  }

  async setUserOffline(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: false, lastSeen: new Date() },
      { new: true },
    );
  }

  async heartbeat(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: true, lastSeen: new Date() },
      { new: true },
    );
  }

  async unlinkFriendsBothWays(userId: string, friendId: string) {
    const aId = new Types.ObjectId(userId);
    const bId = new Types.ObjectId(friendId);

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      await Usuario.updateOne(
        { _id: aId },
        { $pull: { friends: bId, friendRequest: bId, sentRequests: bId } },
        { session },
      );

      await Usuario.updateOne(
        { _id: bId },
        { $pull: { friends: aId, friendRequest: aId, sentRequests: aId } },
        { session },
      );

      await session.commitTransaction();
      await session.endSession();
      session = null;
    } catch {
      if (session) {
        try {
          await session.abortTransaction();
          await session.endSession();
        } catch (abortErr) {
          logger.error(`Error al abortar transacción: ${abortErr}`);
        }
        session = null;
      }
      await Promise.all([
        Usuario.updateOne(
          { _id: aId },
          { $pull: { friends: bId, friendRequest: bId, sentRequests: bId } },
        ),
        Usuario.updateOne(
          { _id: bId },
          { $pull: { friends: aId, friendRequest: aId, sentRequests: aId } },
        ),
      ]);
    }

    const me = await Usuario.findById(aId).lean();
    return me;
  }

  async getChatBetween(
    _userId: string,
    _friendId: string,
  ): Promise<IChatMessage[]> {
    return [];
  }

  async addChatMessage(
    from: string,
    to: string,
    text: string,
  ): Promise<IChatMessage> {
    return new ChatMessageModel({ from, to, text });
  }

  async getEventChat(_eventId: string): Promise<IEventChatMessage[]> {
    return [];
  }

  async addEventChatMessage(
    eventId: string,
    userId: string,
    username: string,
    text: string,
  ): Promise<IEventChatMessage> {
    return new EventChatMessageModel({ eventId, userId, username, text });
  }
}

export default new UserService();
