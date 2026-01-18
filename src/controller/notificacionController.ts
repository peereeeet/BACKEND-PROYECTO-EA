import { Request, Response } from 'express';
import notificacionService from '../services/notificacionServices';
import { logger } from '../config/logger';

export const getUserNotificaciones = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const notificaciones = await notificacionService.getUserNotificaciones(
      userId,
      limit,
    );

    return res.status(200).json({ ok: true, data: notificaciones });
  } catch (error) {
    logger.error(`Error en getUserNotificaciones: ${error}`);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al obtener notificaciones' });
  }
};

export const getUnreadNotificaciones = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const notificaciones =
      await notificacionService.getUnreadNotificaciones(userId);

    return res.status(200).json({ ok: true, data: notificaciones });
  } catch (error) {
    logger.error(`Error en getUnreadNotificaciones: ${error}`);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al obtener notificaciones' });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = await notificacionService.getUnreadCount(userId);

    return res.status(200).json({ ok: true, count });
  } catch (error) {
    logger.error(`Error en getUnreadCount: ${error}`);
    return res.status(500).json({ ok: false, count: 0 });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { notificacionId } = req.params;

    const success = await notificacionService.markAsRead(notificacionId);

    if (success) {
      return res
        .status(200)
        .json({ ok: true, message: 'Notificación marcada como leída' });
    } else {
      return res
        .status(404)
        .json({ ok: false, message: 'Notificación no encontrada' });
    }
  } catch (error) {
    logger.error(`Error en markAsRead: ${error}`);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al marcar notificación' });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = await notificacionService.markAllAsRead(userId);

    return res.status(200).json({
      ok: true,
      message: `${count} notificaciones marcadas como leídas`,
    });
  } catch (error) {
    logger.error(`Error en markAllAsRead: ${error}`);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al marcar notificaciones' });
  }
};

export const markRelatedAsRead = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { relatedId, type } = req.body;

    if (!relatedId || !type || (type !== 'user' && type !== 'event')) {
      return res.status(400).json({
        ok: false,
        message:
          'Parámetros inválidos. Se requiere relatedId y type (user o event)',
      });
    }

    const count = await notificacionService.markRelatedAsRead(
      userId,
      relatedId,
      type,
    );

    return res.status(200).json({
      ok: true,
      message: `${count} notificaciones marcadas como leídas automáticamente`,
      count,
    });
  } catch (error) {
    logger.error(`Error en markRelatedAsRead: ${error}`);
    return res.status(500).json({
      ok: false,
      message: 'Error al marcar notificaciones relacionadas',
    });
  }
};

export const deleteNotificacion = async (req: Request, res: Response) => {
  try {
    const { notificacionId } = req.params;

    const success =
      await notificacionService.deleteNotificacion(notificacionId);

    if (success) {
      return res
        .status(200)
        .json({ ok: true, message: 'Notificación eliminada' });
    } else {
      return res
        .status(404)
        .json({ ok: false, message: 'Notificación no encontrada' });
    }
  } catch (error) {
    logger.error(`Error en deleteNotificacion: ${error}`);
    return res
      .status(500)
      .json({ ok: false, message: 'Error al eliminar notificación' });
  }
};
