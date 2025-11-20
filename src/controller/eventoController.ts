import { Request, Response } from 'express';
import { EventoService } from '../services/eventoServices';
import { Usuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { logger } from '../config/logger';

const eventoService = new EventoService();

function normalizeSchedule(s: any): string {
  if (Array.isArray(s)) return s[0] || '';
  return s || '';
}

function normalizeParticipantes(p: any): string[] {
  if (Array.isArray(p)) return p.filter(Boolean);
  if (Array.isArray((p || {}).participants)) return (p.participants as any[]).filter(Boolean) as string[];
  return [];
}

function canModifyEvento(userRol: string, userId: string, creadorId: string): boolean {
  return userRol === 'admin' || userId === creadorId.toString();
}

export async function createEvento(req: Request, res: Response): Promise<Response> {
  try {
    const { name, schedule, address, lat, lng } = req.body;
    const creadorId = (req as any).user?.payload?.id; 

    if (!creadorId) {
      logger.warn('No autenticado al crear evento');
      return res.status(401).json({ message: 'No autenticado' });
    }

    const scheduleStr = normalizeSchedule(schedule);
    const participantesIdsRaw = normalizeParticipantes(req.body);

    const allParticipantesIds = Array.from(
      new Set([
        ...participantesIdsRaw.map((id) => id.toString()),
        creadorId.toString(),
      ])
    );

    let latNum: number | undefined;
    let lngNum: number | undefined;

    if (lat !== undefined && lat !== null && lat !== '') {
      const parsed = parseFloat(lat);
      if (!Number.isNaN(parsed)) latNum = parsed;
    }

    if (lng !== undefined && lng !== null && lng !== '') {
      const parsed = parseFloat(lng);
      if (!Number.isNaN(parsed)) lngNum = parsed;
    }

    if (address && (latNum === undefined || lngNum === undefined)) {
      const geo = await eventoService.geocodeAddress(address);
      if (geo) {
        if (latNum === undefined) latNum = geo.lat;
        if (lngNum === undefined) lngNum = geo.lng;
      }
    }

    const created = await eventoService.createEvento({
      name,
      schedule: scheduleStr,
      address,
      lat: latNum,
      lng: lngNum,
      participantes: allParticipantesIds as any,
      creador: creadorId 
    });

    if (allParticipantesIds.length > 0) {
      await Usuario.updateMany(
        { _id: { $in: allParticipantesIds } },
        { $addToSet: { eventos: created._id } }
      ).exec();
    }

    const populated = await Evento.findById(created._id)
      .populate('participantes', 'username gmail')
      .populate('creador', 'username gmail')
      .exec();
    logger.info(`Evento creado con ID: ${created._id} por usuario ${creadorId}`);
    return res.status(201).json(populated ?? created);
  } catch (error) {
    logger.error(`Error al crear evento: ${(error as Error).message}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function createEventoFromPanel(req: Request, res: Response) {
  try {
    const { name, creador, address, schedule, participantes, lat, lng } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      logger.warn('Nombre del evento no proporcionado o inválido');
      return res.status(400).json({ message: 'El nombre del evento es obligatorio.' });
    }
    if (!creador || typeof creador !== 'string') {
      logger.warn('ID del creador no proporcionado o inválido');
      return res.status(400).json({ message: 'Debes indicar el ID del creador del evento.' });
    }

    let latNum: number | undefined;
    let lngNum: number | undefined;

    if (lat !== undefined && lat !== null && lat !== '') {
      const parsed = parseFloat(lat);
      if (!Number.isNaN(parsed)) latNum = parsed;
    }

    if (lng !== undefined && lng !== null && lng !== '') {
      const parsed = parseFloat(lng);
      if (!Number.isNaN(parsed)) lngNum = parsed;
    }

    if (address && (latNum === undefined || lngNum === undefined)) {
      const geo = await eventoService.geocodeAddress(address);
      if (geo) {
        if (latNum === undefined) latNum = geo.lat;
        if (lngNum === undefined) lngNum = geo.lng;
      }
    }

    const evento = await eventoService.createEventoWithCreator({
      name,
      creador,
      address,
      lat: latNum,
      lng: lngNum,
      schedule,
      participantes: Array.isArray(participantes) ? participantes : [],
    });
    logger.info(`Evento creado desde panel con ID: ${evento!._id} por creador: ${creador}`);
    return res.status(201).json(evento);
  } catch (err: any) {
    logger.error(`Error al crear evento desde panel: ${err?.message || err}`);
    console.error('createEventoFromPanel', err);
    return res.status(500).json({ message: err?.message || 'No se pudo crear el evento (panel).' });
  }
}

export const getAllEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(),
      Evento.find()
        .skip(skip)
        .limit(limit)
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail')  
    ]);
    logger.info(`Obteniendo eventos - Página: ${page}, Límite: ${limit}`);
    res.status(200).json({
      data: eventos,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    logger.error(`Error al obtener eventos: ${(error as Error).message}`);
    res.status(500).json({ message: 'Error al obtener eventos', error });
  }
};

export async function getEventoById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const evento = await eventoService.getEventoById(id);
    if (!evento){ 
      logger.warn(`Evento no encontrado con ID: ${id}`);
      return res.status(404).json({ message: 'EVENTO NO ENCONTRADO' });
    }
    logger.info(`Evento obtenido con ID: ${id}`);
    return res.status(200).json(evento);
  } catch (error) {
    logger.error(`Error al obtener evento por ID: ${(error as Error).message}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function deleteEventoById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.payload?.id;
    const userRol = (req as any).user?.payload?.rol;

    if (!userId) {
      logger.warn('No autenticado al eliminar evento');
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await Evento.findById(id).lean().exec();
    if (!evento){ 
      logger.warn(`Evento no encontrado para eliminar con ID: ${id}`);
      return res.status(404).json({ message: 'EVENTO NO ENCONTRADO' });
    }

    if (!canModifyEvento(userRol, userId, evento.creador.toString())) {
      logger.warn(`Usuario ${userId} (${userRol}) no tiene permiso para eliminar evento ${id}`);
      return res.status(403).json({ 
        message: 'Solo el creador o un administrador pueden eliminar este evento' 
      });
    }

    if (Array.isArray(evento.participantes) && evento.participantes.length > 0) {
      logger.info(`Eliminando referencias del evento ${id} de participantes`);
      await Usuario.updateMany(
        { _id: { $in: evento.participantes } },
        { $pull: { eventos: evento._id } }
      ).exec();
    }

    const deleted = await eventoService.deleteEventoById(id);
    logger.info(`Evento ${id} eliminado por usuario ${userId} (${userRol})`);
    return res.status(200).json(deleted);
  } catch (error) {
    logger.error(`Error al eliminar evento por ID: ${(error as Error).message}`); 
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const updateEventoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.payload?.id;
    const userRol = (req as any).user?.payload?.rol;

    if (!userId) {
      logger.warn('No autenticado al actualizar evento');
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const evento = await Evento.findById(id);
    if (!evento) {
      logger.warn(`Evento no encontrado para actualizar con ID: ${id}`);  
      res.status(404).json({ message: 'Evento no encontrado' });
      return;
    }

    if (!canModifyEvento(userRol, userId, evento.creador.toString())) {
      logger.warn(`Usuario ${userId} (${userRol}) no tiene permiso para actualizar evento ${id}`);
      res.status(403).json({ 
        message: 'Solo el creador o un administrador pueden editar este evento' 
      });
      return;
    }

    const bodyUpdate: any = { ...req.body };

    if (bodyUpdate.lat !== undefined && bodyUpdate.lat !== null && bodyUpdate.lat !== '') {
      const parsed = parseFloat(bodyUpdate.lat);
      bodyUpdate.lat = Number.isNaN(parsed) ? undefined : parsed;
    }
    if (bodyUpdate.lng !== undefined && bodyUpdate.lng !== null && bodyUpdate.lng !== '') {
      const parsed = parseFloat(bodyUpdate.lng);
      bodyUpdate.lng = Number.isNaN(parsed) ? undefined : parsed;
    }

    const updatedEvento = await Evento.findByIdAndUpdate(id, req.body, {
      new: true
    })
      .populate('participantes')
      .populate('creador', 'username gmail');

    logger.info(`Evento ${id} actualizado por usuario ${userId} (${userRol})`);
    res.status(200).json(updatedEvento);
  } catch (error) {
    logger.error(`Error al actualizar evento:, ${error}`);
    res.status(500).json({ message: 'Error al actualizar evento', error });
  }
};

export const joinEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.payload?.id;

    if (!userId) {
      logger.warn('No autenticado al unirse al evento');
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const evento = await Evento.findById(id);
    if (!evento) {
      logger.warn(`Evento no encontrado para unirse con ID: ${id}`);
      res.status(404).json({ message: 'Evento no encontrado' });
      return;
    }

    if (evento.participantes.some(p => p.toString() === userId)) {
      logger.warn(`Usuario ${userId} ya está inscrito en el evento ${id}`);
      res.status(400).json({ message: 'Ya estás inscrito en este evento' });
      return;
    }

    const updatedEvento = await eventoService.joinEvento(id, userId);
    
    await Usuario.findByIdAndUpdate(userId, { $addToSet: { eventos: id } });

    logger.info(`Usuario ${userId} se unió al evento ${id}`);
    res.status(200).json(updatedEvento);
  } catch (error) {
    logger.error(`Error al unirse al evento: ${error}`);
    res.status(500).json({ message: 'Error al unirse al evento', error });
  }
};

export const leaveEvento = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.payload?.id;

    if (!userId) {
      logger.warn('No autenticado al salir del evento');  
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const evento = await Evento.findById(id);
    if (!evento) {
      logger.warn(`Evento no encontrado para salir con ID: ${id}`);
      res.status(404).json({ message: 'Evento no encontrado' });
      return;
    }

    if (!evento.participantes.some(p => p.toString() === userId)) {
      logger.warn(`Usuario ${userId} no está inscrito en el evento ${id}`);
      res.status(400).json({ message: 'No estás inscrito en este evento' });
      return;
    }

    const updatedEvento = await eventoService.leaveEvento(id, userId);
    
    await Usuario.findByIdAndUpdate(userId, { $pull: { eventos: id } });

    logger.info(`Usuario ${userId} salió del evento ${id}`);
    res.status(200).json(updatedEvento);
  } catch (error) {
    logger.error(`Error al salir del evento: ${error}`);
    res.status(500).json({ message: 'Error al salir del evento', error });
  }
};

export const getMisEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.payload?.id;

    if (!userId) {
      logger.warn('No autenticado al obtener mis eventos');
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const [eventosCreados, eventosInscritos] = await Promise.all([
      Evento.find({ creador: userId })
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail'),
      Evento.find({ participantes: userId })
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail')
    ]);
    logger.info(`Obtenidos eventos para el usuario ${userId}`);
    res.status(200).json({
      eventosCreados,
      eventosInscritos
    });
  } catch (error) {
    logger.error(`Error al obtener mis eventos: ${error}`);
    res.status(500).json({ message: 'Error al obtener mis eventos', error });
  }
};

export const checkEventNameExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      logger.warn("El campo 'name' es obligatorio para verificar existencia");
      res.status(400).json({
        exists: false,
        message: "El campo 'name' es obligatorio"
      });
      return;
    }

    const existingEvent = await Evento.findOne({ name });
    if (existingEvent) {
      logger.info(`Evento con nombre '${name}' ya existe`);
      res.status(200).json({
        exists: true,
        message: 'Ya existe un evento con este título'
      });
      return;
    }
    logger.info(`Nombre de evento '${name}' está disponible`);
    res.status(200).json({
      exists: false,
      message: 'El título está disponible'
    });
  } catch (error) {
    logger.error(`Error al verificar existencia del título del evento: ${error}`);
    res.status(500).json({
      exists: false,
      error: 'Error al verificar el título del evento',
      details: error instanceof Error ? error.message : error
    });
  }
};