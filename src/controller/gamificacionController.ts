import { Request, Response } from 'express';
import { GamificacionService } from '../services/gamificacionServices';
import { logger } from '../config/logger';

const service = new GamificacionService();

export async function obtenerMiProgreso(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const progreso = await service.obtenerProgreso(userId);
    logger.info(`Progreso obtenido para usuario ${userId}`);

    return res.status(200).json(progreso);
  } catch (err) {
    logger.error(`Error al obtener progreso: ${err}`);
    return res
      .status(500)
      .json({ message: 'Error al obtener progreso', error: err });
  }
}

export async function obtenerProgresoUsuario(req: Request, res: Response) {
  try {
    const { usuarioId } = req.params;

    if (!usuarioId) {
      return res.status(400).json({ message: 'Falta usuarioId' });
    }

    const progreso = await service.obtenerProgreso(usuarioId);
    logger.info(`Progreso obtenido para usuario ${usuarioId}`);

    return res.status(200).json(progreso);
  } catch (err) {
    logger.error(`Error al obtener progreso de usuario: ${err}`);
    return res
      .status(500)
      .json({ message: 'Error al obtener progreso', error: err });
  }
}

export async function obtenerRanking(req: Request, res: Response) {
  try {
    const limite = parseInt(req.query.limite as string) || 10;

    const ranking = await service.obtenerRanking(limite);
    logger.info(`Ranking obtenido con ${ranking.length} usuarios`);

    return res.status(200).json(ranking);
  } catch (err) {
    logger.error(`Error al obtener ranking: ${err}`);
    return res
      .status(500)
      .json({ message: 'Error al obtener ranking', error: err });
  }
}

export async function obtenerInsignias(req: Request, res: Response) {
  try {
    const insignias = await service.obtenerTodasInsignias();
    logger.info(`Obtenidas ${insignias.length} insignias`);

    return res.status(200).json(insignias);
  } catch (err) {
    logger.error(`Error al obtener insignias: ${err}`);
    return res
      .status(500)
      .json({ message: 'Error al obtener insignias', error: err });
  }
}

export async function inicializarInsignias(req: Request, res: Response) {
  try {
    await service.inicializarInsignias();
    logger.info('Insignias inicializadas correctamente');

    return res
      .status(200)
      .json({ message: 'Insignias inicializadas correctamente' });
  } catch (err) {
    logger.error(`Error al inicializar insignias: ${err}`);
    return res
      .status(500)
      .json({ message: 'Error al inicializar insignias', error: err });
  }
}
