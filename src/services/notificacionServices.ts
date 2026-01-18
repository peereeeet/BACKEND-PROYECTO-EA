import { Notificacion, INotificacion } from '../models/notificacion';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
import { io } from '../index';

export class NotificacionService {
  private async checkRateLimit(
    userId: string,
    type: string,
    maxPerHour: number = 10,
  ): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentCount = await Notificacion.countDocuments({
        userId: new Types.ObjectId(userId),
        type: type,
        createdAt: { $gte: oneHourAgo },
      });

      return recentCount < maxPerHour;
    } catch (error) {
      logger.error(`Error verificando rate limit: ${error}`);
      return true;
    }
  }

  async createNotificacion(data: {
    userId: string;
    type:
      | 'friend_request'
      | 'friend_accepted'
      | 'event_join'
      | 'event_reminder'
      | 'new_message'
      | 'event_spot_available'
      | 'event_invitation';
    title: string;
    message: string;
    relatedUserId?: string;
    relatedEventId?: string;
    relatedUsername?: string;
    relatedEventName?: string;
    actionUrl?: string;
    skipRateLimit?: boolean;
  }): Promise<INotificacion | null> {
    try {
      if (!data.skipRateLimit && data.type !== 'event_reminder') {
        const allowed = await this.checkRateLimit(data.userId, data.type);
        if (!allowed) {
          logger.warn(
            `Rate limit excedido para usuario ${data.userId}, tipo ${data.type}`,
          );
          return null;
        }
      }

      const notificacion = new Notificacion({
        userId: new Types.ObjectId(data.userId),
        type: data.type,
        title: data.title,
        message: data.message,
        relatedUserId: data.relatedUserId
          ? new Types.ObjectId(data.relatedUserId)
          : undefined,
        relatedEventId: data.relatedEventId
          ? new Types.ObjectId(data.relatedEventId)
          : undefined,
        relatedUsername: data.relatedUsername,
        relatedEventName: data.relatedEventName,
        actionUrl: data.actionUrl,
        read: false,
        createdAt: new Date(),
      });

      const saved = await notificacion.save();

      io.to(`user:${data.userId}`).emit('notification:new', {
        _id: saved._id.toString(),
        type: saved.type,
        title: saved.title,
        message: saved.message,
        read: saved.read,
        createdAt: saved.createdAt,
        relatedUserId: data.relatedUserId,
        relatedEventId: data.relatedEventId,
        relatedUsername: data.relatedUsername,
        relatedEventName: data.relatedEventName,
        actionUrl: data.actionUrl,
      });

      logger.info(
        `Notificación creada para usuario ${data.userId}: ${data.type}`,
      );
      return saved;
    } catch (error) {
      logger.error(`Error al crear notificación: ${error}`);
      return null;
    }
  }

  async getUserNotificaciones(
    userId: string,
    limit = 50,
  ): Promise<INotificacion[]> {
    try {
      return await Notificacion.find({ userId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error(`Error al obtener notificaciones: ${error}`);
      return [];
    }
  }

  async getUnreadNotificaciones(userId: string): Promise<INotificacion[]> {
    try {
      return await Notificacion.find({
        userId: new Types.ObjectId(userId),
        read: false,
      })
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      logger.error(`Error al obtener notificaciones no leídas: ${error}`);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await Notificacion.countDocuments({
        userId: new Types.ObjectId(userId),
        read: false,
      });
    } catch (error) {
      logger.error(`Error al contar notificaciones no leídas: ${error}`);
      return 0;
    }
  }

  async markAsRead(notificacionId: string): Promise<boolean> {
    try {
      const result = await Notificacion.updateOne(
        { _id: new Types.ObjectId(notificacionId) },
        { $set: { read: true } },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error(`Error al marcar notificación como leída: ${error}`);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await Notificacion.updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { $set: { read: true } },
      );
      return result.modifiedCount;
    } catch (error) {
      logger.error(
        `Error al marcar todas las notificaciones como leídas: ${error}`,
      );
      return 0;
    }
  }

  async deleteNotificacion(notificacionId: string): Promise<boolean> {
    try {
      const result = await Notificacion.deleteOne({
        _id: new Types.ObjectId(notificacionId),
      });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error al eliminar notificación: ${error}`);
      return false;
    }
  }

  async deleteOldNotificaciones(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Notificacion.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        read: true,
      });

      logger.info(`Eliminadas ${result.deletedCount} notificaciones antiguas`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error al eliminar notificaciones antiguas: ${error}`);
      return 0;
    }
  }

  async markRelatedAsRead(
    userId: string,
    relatedId: string,
    type: 'user' | 'event',
  ): Promise<number> {
    try {
      const query: any = {
        userId: new Types.ObjectId(userId),
        read: false,
      };

      if (type === 'user') {
        query.relatedUserId = new Types.ObjectId(relatedId);
      } else if (type === 'event') {
        query.relatedEventId = new Types.ObjectId(relatedId);
      }

      const result = await Notificacion.updateMany(query, {
        $set: { read: true },
      });

      if (result.modifiedCount > 0) {
        logger.info(
          `${result.modifiedCount} notificaciones marcadas como leídas automáticamente`,
        );
      }

      return result.modifiedCount;
    } catch (error) {
      logger.error(`Error al marcar notificaciones relacionadas: ${error}`);
      return 0;
    }
  }

  async notifyFriendRequest(
    targetUserId: string,
    fromUserId: string,
    fromUsername: string,
  ) {
    return this.createNotificacion({
      userId: targetUserId,
      type: 'friend_request',
      title: 'Nueva solicitud de amistad',
      message: `${fromUsername} te ha enviado una solicitud de amistad`,
      relatedUserId: fromUserId,
      relatedUsername: fromUsername,
      actionUrl: '/menu',
    });
  }

  async notifyFriendAccepted(
    targetUserId: string,
    acceptedByUserId: string,
    acceptedByUsername: string,
  ) {
    return this.createNotificacion({
      userId: targetUserId,
      type: 'friend_accepted',
      title: 'Solicitud aceptada',
      message: `${acceptedByUsername} ha aceptado tu solicitud de amistad`,
      relatedUserId: acceptedByUserId,
      relatedUsername: acceptedByUsername,
      actionUrl: '/menu',
    });
  }

  async notifyFriendJoinedEvent(
    eventCreatorId: string,
    friendId: string,
    friendUsername: string,
    eventId: string,
    eventName: string,
  ) {
    return this.createNotificacion({
      userId: eventCreatorId,
      type: 'event_join',
      title: 'Amigo se unió a tu evento',
      message: `${friendUsername} se ha unido a tu evento "${eventName}"`,
      relatedUserId: friendId,
      relatedUsername: friendUsername,
      relatedEventId: eventId,
      relatedEventName: eventName,
      actionUrl: `/evento/${eventId}`,
    });
  }

  async notifyEventReminder(
    userId: string,
    eventId: string,
    eventName: string,
    eventDate: Date,
  ) {
    return this.createNotificacion({
      userId: userId,
      type: 'event_reminder',
      title: 'Recordatorio de evento',
      message: `Tu evento "${eventName}" comienza mañana a las ${eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`,
      relatedEventId: eventId,
      relatedEventName: eventName,
      actionUrl: `/evento/${eventId}`,
      skipRateLimit: true,
    });
  }

  async notifyNewMessage(
    targetUserId: string,
    fromUserId: string,
    fromUsername: string,
  ) {
    return this.createNotificacion({
      userId: targetUserId,
      type: 'new_message',
      title: 'Nuevo mensaje',
      message: `${fromUsername} te ha enviado un mensaje`,
      relatedUserId: fromUserId,
      relatedUsername: fromUsername,
      actionUrl: '/menu',
    });
  }

  async notifySpotAvailable(
    userId: string,
    eventId: string,
    eventName: string,
  ) {
    return this.createNotificacion({
      userId: userId,
      type: 'event_spot_available',
      title: 'Plaza disponible',
      message: `Hay una plaza disponible en "${eventName}". ¡Ya estás inscrito!`,
      relatedEventId: eventId,
      relatedEventName: eventName,
      actionUrl: `/evento/${eventId}`,
      skipRateLimit: true,
    });
  }

  async notifyEventInvitation(
    targetUserId: string,
    fromUserId: string,
    fromUsername: string,
    eventId: string,
    eventName: string,
  ) {
    return this.createNotificacion({
      userId: targetUserId,
      type: 'event_invitation',
      title: 'Invitación a evento privado',
      message: `${fromUsername} te ha invitado a "${eventName}"`,
      relatedUserId: fromUserId,
      relatedUsername: fromUsername,
      relatedEventId: eventId,
      relatedEventName: eventName,
      actionUrl: '/menu',
    });
  }
}

export default new NotificacionService();
