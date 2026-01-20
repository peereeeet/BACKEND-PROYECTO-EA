import { Request, Response } from 'express';
import { ValoracionService } from '../services/valoracionServices';
import { GamificacionService } from '../services/gamificacionServices';
import {logger} from "../config/logger";

const service = new ValoracionService();
const gamificacionService = new GamificacionService();

export async function createValoracion(req: Request, res: Response) {
  try {
    const { eventoId } = req.params;
    const { puntuacion, comentario } = req.body;
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      logger.warn('Usuario no autenticado al crear valoración');
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!eventoId){
      logger.warn('Falta eventoId al crear valoración');
      return res.status(400).json({ message: 'Falta eventoId' });
    }
    
    if (typeof puntuacion !== 'number' || puntuacion < 1 || puntuacion > 5){
      logger.warn('puntuacion inválida al crear valoración');
      return res.status(400).json({ message: 'puntuacion debe ser 1..5' });
    }

    const doc = await service.createValoracion(eventoId, { puntuacion, comentario }, usuarioId);
    logger.info(`Valoración creada para el evento ${eventoId} por usuario ${usuarioId}`);
    
    let gamificacionData = null;
    try {
      const progreso = await gamificacionService.obtenerProgreso(usuarioId);
      gamificacionData = {
        puntos: progreso.puntos,
        nivel: progreso.nivel,
        insignias: progreso.insignias,
        estadisticas: progreso.estadisticas
      };
    } catch (err) {
      logger.error(`Error al obtener progreso de gamificación: ${err}`);
    }
    
    return res.status(201).json({
      valoracion: doc,
      gamificacion: gamificacionData
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      logger.warn('Usuario ya ha valorado este evento');
      return res.status(409).json({
        message: 'Ya has valorado este evento anteriormente',
        code: 'DUPLICATE_RATING'
      });
    }
    logger.error(`Error al guardar la valoración: ${err}`);
    return res.status(500).json({ message: 'Error al guardar la valoración', error: err });
  }
}

export async function getUserValoracion(req: Request, res: Response) {
  try {
    const { eventoId } = req.params;
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const valoracion = await service.getUserValoracionForEvento(eventoId, usuarioId);
    
    if (!valoracion) {
      return res.status(404).json({ message: 'No has valorado este evento aún' });
    }

    return res.status(200).json(valoracion);
  } catch (err) {
    logger.error(`Error al obtener valoración del usuario: ${err}`);
    return res.status(500).json({ message: 'Error al obtener valoración', error: err });
  }
}

export async function updateValoracion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { puntuacion, comentario } = req.body;
    const data: any = {};
    
    if (typeof puntuacion === 'number') {
      if (puntuacion < 1 || puntuacion > 5) {
        logger.warn('puntuacion inválida al actualizar valoración');
        return res.status(400).json({ message: 'puntuacion debe ser 1..5' });
      }
      data.puntuacion = puntuacion;
    }
    if (typeof comentario === 'string') data.comentario = comentario;

    const doc = await service.updateValoracion(id, data);
    if (!doc){
      logger.warn(`Valoración con ID ${id} no encontrada para actualizar`);
      return res.status(404).json({ message: 'No encontrada' });
    }
    logger.info(`Valoración con ID ${id} actualizada`);
    res.status(200).json(doc);
  } catch (err) {
    logger.error(`Error al actualizar la valoración: ${err}`);
    res.status(500).json({ message: 'Error al actualizar la valoración', error: err });
  }
}

export async function listValoracionesEvento(req: Request, res: Response) {
  try {
    const { eventoId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 6;
    const q = (req.query.q as string) || '';

    const result = await service.listByEvento(eventoId, { page, limit, q });
    logger.info(`Listado de valoraciones para el evento ${eventoId} obtenido`);
    res.status(200).json(result);
  } catch (err) {
    logger.error(`Error al cargar las valoraciones: ${err}`);
    res.status(500).json({ message: 'Error cargando valoraciones', error: err });
  }
}

export async function getValoracionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await service.getById(id);
    if (!doc){
      logger.warn(`Valoración con ID ${id} no encontrada`);
      return res.status(404).json({ message: 'No encontrada' });
    }
    logger.info(`Valoración con ID ${id} obtenida`);
    res.status(200).json(doc);
  } catch (err) {
    logger.error(`Error al obtener la valoración: ${err}`);
    res.status(500).json({ message: 'Error al obtener la valoración', error: err });
  }
}

export async function deleteValoracion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await service.deleteValoracion(id);
    if (!doc){ 
      logger.warn(`Valoración con ID ${id} no encontrada para eliminar`);
      return res.status(404).json({ message: 'No encontrada' });
    }
    logger.info(`Valoración con ID ${id} eliminada`);
    res.status(200).json({ message: 'Valoración eliminada', id });
  } catch (err) {
    logger.error(`Error al eliminar la valoración: ${err}`);
    res.status(500).json({ message: 'Error al eliminar la valoración', error: err });
  }
}