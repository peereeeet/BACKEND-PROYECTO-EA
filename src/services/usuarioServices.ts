import { Usuario, IUsuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { logger } from '../config/logger';

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
      logger.info("Usuario Creado correctamente");
      return await newUser.save();
    } catch (error) {
      logger.error("No se pudo crear el usuario");
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
    if (!user){ 
      logger.warn("El usuario no existe");
      return null;}
    Object.assign(user, userData);
    logger.info ("Usuario actualizado");
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
      logger.info(`Evento añadido correctamente al usuario ${updatedUser.username}`);
    }
    return updatedUser;
  }

  /* Login */
  async loginUser(username: string, password: string): Promise<IUsuario | null> {
    try {
      const user = await Usuario.findOne({ username });
      if (!user) {
        logger.error("Usuario no encontrado");
        return null;
      }
      
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.error("Contraseña incorrecta")
        return null;
      }
    
      logger.info("El usuario ha iniciado sesion");
      return user;
    } catch (error) {
      logger.error("Error al iniciar sesion");
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
    logger.error("El usuario no existe");
    return null;
  } 
  const updatedUser = await Usuario.findByIdAndUpdate(
    id,
    { $set: { isActive: !user.isActive } },
    { new: true }
  );

  logger.info(`Usuario ${updatedUser} deshabilitado`);
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

  async sendFriendRequest(fromId: string, toId: string) {
    if (!Types.ObjectId.isValid(fromId) || !Types.ObjectId.isValid(toId)) {
      throw new Error('Invalid user id');
    }
    if (fromId === toId) throw new Error('No puedes enviarte solicitud a ti mismo');

    const fromOid = new Types.ObjectId(fromId);
    const toOid   = new Types.ObjectId(toId);

    // Carga básica para evitar duplicados/amistad existente
    const [from, to] = await Promise.all([
      Usuario.findById(fromOid).select('_id friends sentRequests'),
      Usuario.findById(toOid).select('_id friends friendRequest')
    ]);
    if (!from || !to) throw new Error('Usuario no encontrado');

    const alreadyFriends =
      (from.friends ?? []).some(id => String(id) === String(toId)) ||
      (to.friends ?? []).some(id => String(id) === String(fromId));
    if (alreadyFriends) return { ok: true, message: 'Ya sois amigos' };

    const alreadyPendingIncoming = (to.friendRequest ?? []).some(id => String(id) === String(fromId));
    const alreadyPendingOutgoing = (from.sentRequests ?? []).some(id => String(id) === String(toId));
    if (alreadyPendingIncoming && alreadyPendingOutgoing) {
      return { ok: true, message: 'Solicitud ya enviada' };
    }

    // ——— PARTE CRÍTICA: usar ObjectId y comprobar matched/modified ———
    const [r1, r2] = await Promise.all([
      // receptor (B): añade A a friendRequest
      Usuario.updateOne(
        { _id: toOid },
        { $addToSet: { friendRequest: fromOid } }
      ),
      // emisor (A): añade B a sentRequests
      Usuario.updateOne(
        { _id: fromOid },
        { $addToSet: { sentRequests: toOid } }
      )
    ]);

    // Pequeña verificación (útil para detectar filtros que no matchean)
    const debug = {
      toMatched: r1.matchedCount ?? (r1 as any).nMatched,
      toModified: r1.modifiedCount ?? (r1 as any).nModified,
      fromMatched: r2.matchedCount ?? (r2 as any).nMatched,
      fromModified: r2.modifiedCount ?? (r2 as any).nModified,
    };

    // Recuperar arrays tras la operación para asegurarnos de que quedó persistido
    const [toAfter, fromAfter] = await Promise.all([
      Usuario.findById(toOid).select('_id friendRequest').lean(),
      Usuario.findById(fromOid).select('_id sentRequests').lean()
    ]);

    return {
      ok: true,
      message: 'Solicitud enviada',
      debug,
      toFriendRequestCount: (toAfter?.friendRequest ?? []).length,
      fromSentRequestsCount: (fromAfter?.sentRequests ?? []).length
    };
  }

  async acceptFriendRequest(userId: string, requesterId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requesterId)) {
      throw new Error('Invalid user id');
    }

    // userId = quien ACEPTA; requesterId = quien ENVIÓ
    const [user, requester] = await Promise.all([
      Usuario.findById(userId).select('_id friendRequest'),
      Usuario.findById(requesterId).select('_id sentRequests'),
    ]);
    if (!user || !requester) throw new Error('Usuario no encontrado');

    const requesterObjectId = new mongoose.Types.ObjectId(requesterId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Comprobamos que realmente había solicitud pendiente
    if (!(user.friendRequest ?? []).some(id => String(id) === String(requesterId))) {
      throw new Error('No hay solicitud pendiente de este usuario');
    }

    await Promise.all([
      // A: acepta → añade B a amigos y borra la solicitud entrante
      Usuario.updateOne(
        { _id: userId },
        { $addToSet: { friends: requesterObjectId }, $pull: { friendRequest: requesterObjectId } }
      ),
      // B: emisor → añade A a amigos y borra la solicitud enviada
      Usuario.updateOne(
        { _id: requesterId },
        { $addToSet: { friends: userObjectId }, $pull: { sentRequests: userObjectId } }
      ),
    ]);

    return { message: 'Solicitud aceptada correctamente' };
  }

  async rejectFriendRequest(userId: string, requesterId: string) {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(requesterId)) {
      throw new Error('Invalid user id');
    }

    await Promise.all([
      // El que RECHAZA: elimina la solicitud entrante
      Usuario.updateOne(
        { _id: userId },
        { $pull: { friendRequest: requesterId } }
      ),
      // El EMISOR: elimina su solicitud enviada
      Usuario.updateOne(
        { _id: requesterId },
        { $pull: { sentRequests: userId } }
      ),
    ]);

    return { message: 'Solicitud rechazada' };
  }

  async getFriendRequests(userId: string) {
    const user = await Usuario.findById(userId).populate('friendRequest', 'username gmail');
    if (!user) throw new Error('Usuario no encontrado');
    return user.friendRequest;
  };

  async getSentRequests(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user id');
    }

    // Devolvemos la lista de usuarios a los que YO he enviado solicitud
    const user = await Usuario.findById(userId)
      .populate('sentRequests', 'username gmail online')
      .lean();

    if (!user) throw new Error('Usuario no encontrado');

    const arr = (user.sentRequests ?? []).map((u: any) => ({
      _id: String(u._id),
      username: u.username,
      gmail: u.gmail,
      isOnline: !!(u.online ?? u.isOnline)
    }));
    return arr;
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

    async setUserOnline(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: true, lastSeen: new Date() },
      { new: true }
    );
  }

  async setUserOffline(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: false, lastSeen: new Date() },
      { new: true }
    );
  }

  async heartbeat(userId: string) {
    return await Usuario.findByIdAndUpdate(
      userId,
      { online: true, lastSeen: new Date() },
      { new: true }
    );
  }

  async unlinkFriendsBothWays(userId: string, friendId: string) {
    const aId = oid(userId);
    const bId = oid(friendId);

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      await Usuario.updateOne(
        { _id: aId },
        { $pull: { friends: bId, friendRequest: bId, sentRequests: bId } },
        { session }
      );

      await Usuario.updateOne(
        { _id: bId },
        { $pull: { friends: aId, friendRequest: aId, sentRequests: aId } },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();
      session = null;

    } catch (err) {
      if (session) {
        try { await session.abortTransaction(); await session.endSession(); } catch {}
        session = null;
      }
      await Promise.all([
        Usuario.updateOne(
          { _id: aId },
          { $pull: { friends: bId, friendRequest: bId, sentRequests: bId } }
        ),
        Usuario.updateOne(
          { _id: bId },
          { $pull: { friends: aId, friendRequest: aId, sentRequests: aId } }
        )
      ]);
    }

    const me = await Usuario.findById(aId).lean();
    return me;
  }
}

export default new UserService();
