import { Usuario, IUsuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import {
  ChatMessageModel,
  IChatMessage,
  EventChatMessageModel,
  IEventChatMessage,
} from '../models/usuario';
import { io } from '../index';
import gamificacionService from './gamificacionServices';
import notificacionService from './notificacionServices';

function oid(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`INVALID_OBJECT_ID:${id}`);
  }
  return new Types.ObjectId(id);
}

function transformProfilePhotoUrl(
  photoPath: string | null | undefined,
): string | null {
  if (!photoPath) return null;
  // Retorna la ruta relativa tal como está almacenada
  // El frontend/cliente construirá la URL completa con el dominio apropiado
  return photoPath;
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

  async getVisibleUsers(
    currentUserId: string,
    page: number = 1,
    limit: number = 10,
    q: string = '',
  ): Promise<{
    data: IUsuario[];
    totalItems: number;
    totalPages: number;
    page: number;
  }> {
    if (!Types.ObjectId.isValid(currentUserId)) {
      throw new Error('Invalid user id');
    }

    const user = await Usuario.findById(currentUserId);
    if (!user) {
      throw new Error('User not found');
    }

    // Excluir a uno mismo, amigos actuales y solicitudes pendientes (enviadas o recibidas)
    const excludedIds = [
      new Types.ObjectId(currentUserId),
      ...(user.friends || []),
      ...(user.friendRequest || []),
      ...(user.sentRequests || []),
    ];

    const filter: any = {
      _id: { $nin: excludedIds },
      rol: { $ne: 'admin' },
    };

    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { gmail: { $regex: q, $options: 'i' } },
      ];
    }

    const totalItems = await Usuario.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);
    const skip = (page - 1) * limit;

    const users = await Usuario.find(filter).skip(skip).limit(limit);

    return {
      data: users,
      totalItems,
      totalPages,
      page,
    };
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

  /*async createAdminUser(): Promise<void> {
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
      logger.error(`Error creando usuario admin: ${error}`);
    }
  }*/

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
    const rawData = await Usuario.find(filter)
      .sort({ username: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id username gmail online profilePhoto')
      .lean();

    const data = rawData.map((user: any) => ({
      ...user,
      profilePhoto: transformProfilePhotoUrl(user.profilePhoto),
    }));

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
    const rawData = await Usuario.find(filter)
      .sort({ username: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id username gmail online profilePhoto')
      .lean();

    const data = rawData.map((user: any) => ({
      ...user,
      profilePhoto: transformProfilePhotoUrl(user.profilePhoto),
    }));

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

    await notificacionService.notifyFriendRequest(toId, fromId, from.username);

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

    let rewardDataUser = null;
    let rewardDataRequester = null;

    try {
      const results = await Promise.all([
        gamificacionService.otorgarPuntosConRecompensa(userId, 'hacerAmigo'),
        gamificacionService.otorgarPuntosConRecompensa(
          requesterId,
          'hacerAmigo',
        ),
      ]);
      rewardDataUser = results[0];
      rewardDataRequester = results[1];
    } catch (err) {
      logger.error(`Error al otorgar puntos por amistad: ${err}`);
    }

    const userInfo = await Usuario.findById(userId).select('username').lean();
    await notificacionService.notifyFriendAccepted(
      requesterId,
      userId,
      userInfo?.username || 'Usuario',
    );

    return {
      message: 'Solicitud aceptada correctamente',
      rewardDataUser,
      rewardDataRequester,
    };
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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID inválido');
    }
    const user = await Usuario.findById(userId).select('friendRequest');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    const requestersIds = user.friendRequest;
    const rawRequesters = await Usuario.find({ _id: { $in: requestersIds } })
      .select('_id username gmail online profilePhoto')
      .lean();

    const requesters = rawRequesters.map((user: any) => ({
      ...user,
      profilePhoto: transformProfilePhotoUrl(user.profilePhoto),
    }));

    return requesters;
  }

  async getSentRequests(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }

    const user = await Usuario.findById(userId)
      .populate('sentRequests', 'username gmail online profilePhoto')
      .lean();

    if (!user) throw new Error('Usuario no encontrado');

    const arr = (user.sentRequests ?? []).map((u: any) => ({
      _id: String(u._id),
      username: u.username,
      gmail: u.gmail,
      isOnline: !!(u.online ?? u.isOnline),
      profilePhoto: transformProfilePhotoUrl(u.profilePhoto),
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
    userId: string,
    friendId: string,
  ): Promise<IChatMessage[]> {
    try {
      const messages = await ChatMessageModel.find({
        $or: [
          { from: userId, to: friendId },
          { from: friendId, to: userId },
        ],
      })
        .sort({ createdAt: 1 })
        .lean();

      logger.info(
        `Chat entre ${userId} y ${friendId}: ${messages.length} mensajes`,
      );
      return messages;
    } catch (error) {
      logger.error(`Error al obtener chat: ${error}`);
      return [];
    }
  }

  async addChatMessage(
    from: string,
    to: string,
    text: string,
    imageUrl?: string,
  ): Promise<IChatMessage> {
    try {
      const message = new ChatMessageModel({
        from,
        to,
        text,
        imageUrl,
        createdAt: new Date(),
      });

      await message.save();

      logger.info(
        `Mensaje guardado: ${from} → ${to}${imageUrl ? ' (con imagen)' : ''}`,
      );
      return message;
    } catch (error) {
      logger.error(`Error al guardar mensaje: ${error}`);
      throw error;
    }
  }

  async getEventChat(eventId: string): Promise<IEventChatMessage[]> {
    try {
      const messages = await EventChatMessageModel.find({ eventId })
        .sort({ createdAt: 1 })
        .lean();

      logger.info(`Chat del evento ${eventId}: ${messages.length} mensajes`);
      return messages;
    } catch (error) {
      logger.error(`Error al obtener chat del evento: ${error}`);
      return [];
    }
  }

  async addEventChatMessage(
    eventId: string,
    userId: string,
    username: string,
    text: string,
    imageUrl?: string,
  ): Promise<IEventChatMessage> {
    try {
      const message = new EventChatMessageModel({
        eventId,
        userId,
        username,
        text,
        imageUrl,
        createdAt: new Date(),
      });

      await message.save();

      logger.info(
        `Mensaje de evento guardado: ${username} en ${eventId}${imageUrl ? ' (con imagen)' : ''}`,
      );
      return message;
    } catch (error) {
      logger.error(`Error al guardar mensaje de evento: ${error}`);
      logger.error(`Error al guardar mensaje de evento: ${error}`);
      throw error;
    }
  }

  async blockUser(userId: string, blockId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(blockId)) {
      throw new Error('Invalid user id');
    }
    if (userId === blockId) throw new Error('No puedes bloquearte a ti mismo');

    await this.unlinkFriendsBothWays(userId, blockId);

    await Usuario.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: new Types.ObjectId(blockId) },
    });

    logger.info(`Usuario ${userId} bloqueó a ${blockId}`);
    return { ok: true, message: 'Usuario bloqueado correctamente' };
  }

  async unblockUser(userId: string, unblockId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(unblockId)) {
      throw new Error('Invalid user id');
    }

    await Usuario.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: new Types.ObjectId(unblockId) },
    });

    logger.info(`Usuario ${userId} desbloqueó a ${unblockId}`);
    return { ok: true, message: 'Usuario desbloqueado correctamente' };
  }

  async getBlockedUsers(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('ID inválido');
    }
    const user = await Usuario.findById(userId).select('blockedUsers');
    if (!user) throw new Error('Usuario no encontrado');

    const blockedIds = user.blockedUsers || [];
    const rawBlocked = await Usuario.find({ _id: { $in: blockedIds } })
      .select('_id username gmail online profilePhoto')
      .lean();

    const data = rawBlocked.map((u: any) => ({
      ...u,
      profilePhoto: transformProfilePhotoUrl(u.profilePhoto),
    }));

    return data;
  }

  async deleteEventChatMessage(messageId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(messageId)) {
        return {
          success: false,
          status: 400,
          message: 'ID de mensaje inválido',
        };
      }

      const message = await EventChatMessageModel.findById(messageId);

      if (!message) {
        return {
          success: false,
          status: 404,
          message: 'Mensaje no encontrado',
        };
      }

      if (message.userId !== userId) {
        return {
          success: false,
          status: 403,
          message: 'No tienes permiso para eliminar este mensaje',
        };
      }

      let deletedImage = false;
      if (message.imageUrl) {
        try {
          const filename = message.imageUrl.split('/').pop();
          if (filename) {
            const filePath = path.join(
              __dirname,
              '..',
              'public',
              'uploads',
              'event-chat',
              filename,
            );

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deletedImage = true;
              logger.info(`Imagen eliminada: ${filePath}`);
            }
          }
        } catch (error) {
          logger.error(`Error al eliminar imagen: ${error}`);
        }
      }

      await EventChatMessageModel.findByIdAndDelete(messageId);

      const eventRoomId = `event:${message.eventId}`;
      io.to(eventRoomId).emit('eventChat:messageDeleted', {
        messageId: messageId,
        eventId: message.eventId,
      });

      logger.info(
        `Mensaje eliminado: ${messageId} del evento ${message.eventId} por usuario ${userId}`,
      );

      return {
        success: true,
        message: 'Mensaje eliminado correctamente',
        deletedImage,
      };
    } catch (error) {
      logger.error(`Error en deleteEventChatMessage: ${error}`);
      return {
        success: false,
        status: 500,
        message: 'Error al eliminar el mensaje',
      };
    }
  }

  async addChatMessageWithImage(
    from: string,
    to: string,
    text: string,
    imageUrl?: string,
  ): Promise<IChatMessage> {
    try {
      const message = new ChatMessageModel({
        from,
        to,
        text,
        imageUrl,
        createdAt: new Date(),
      });

      await message.save();

      logger.info(
        `Mensaje guardado: ${from} → ${to}${imageUrl ? ' (con imagen)' : ''}`,
      );
      return message;
    } catch (error) {
      logger.error(`Error al guardar mensaje: ${error}`);
      throw error;
    }
  }

  async deleteChatMessage(messageId: string, userId: string) {
    try {
      if (!Types.ObjectId.isValid(messageId)) {
        return {
          success: false,
          status: 400,
          message: 'ID de mensaje inválido',
        };
      }

      const message = await ChatMessageModel.findById(messageId);

      if (!message) {
        return {
          success: false,
          status: 404,
          message: 'Mensaje no encontrado',
        };
      }

      if (message.from !== userId) {
        return {
          success: false,
          status: 403,
          message: 'No tienes permiso para eliminar este mensaje',
        };
      }

      let deletedImage = false;
      if ((message as any).imageUrl) {
        try {
          const filename = (message as any).imageUrl.split('/').pop();
          if (filename) {
            const filePath = path.join(
              __dirname,
              '..',
              'public',
              'uploads',
              'friend-chat',
              filename,
            );

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              deletedImage = true;
              logger.info(`Imagen de chat eliminada: ${filePath}`);
            }
          }
        } catch (error) {
          logger.error(`Error al eliminar imagen de chat: ${error}`);
        }
      }

      await ChatMessageModel.findByIdAndDelete(messageId);

      const chatRoomId = [message.from, message.to].sort().join(':');
      io.to(chatRoomId).emit('chat:messageDeleted', {
        messageId: messageId,
        from: message.from,
        to: message.to,
      });

      logger.info(
        `Mensaje de chat eliminado: ${messageId} por usuario ${userId}`,
      );

      return {
        success: true,
        message: 'Mensaje eliminado correctamente',
        deletedImage,
      };
    } catch (error) {
      logger.error(`Error en deleteChatMessage: ${error}`);
      return {
        success: false,
        status: 500,
        message: 'Error al eliminar el mensaje',
      };
    }
  }
}

export default new UserService();
