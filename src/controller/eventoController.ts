import { Request, Response } from 'express';
import { EventoService } from '../services/eventoServices';
import { Usuario } from '../models/usuario';
import { Evento } from '../models/evento';
import { logger } from '../config/logger';
import { Types } from 'mongoose';

const eventoService = new EventoService();

function normalizeSchedule(s: any): string {
  if (Array.isArray(s)) return s[0] || '';
  return s || '';
}

function normalizeParticipantes(p: any): string[] {
  if (Array.isArray(p)) return p.filter(Boolean);
  if (Array.isArray((p || {}).participants))
    return (p.participants as any[]).filter(Boolean) as string[];
  return [];
}

function canModifyEvento(
  userRol: string,
  userId: string,
  creadorId: string,
): boolean {
  return userRol === 'admin' || userId === creadorId;
}

export async function createEvento(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const {
      name,
      schedule,
      address,
      lat,
      lng,
      categoria,
      isPrivate,
      invitados,
      maxParticipantes,
    } = req.body;
    const creadorId = (req as any).user?.id;

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
      ]),
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

    const invitadosIds: string[] = [];
    let invitacionesPendientesIds: string[] = [];

    if (isPrivate && Array.isArray(invitados) && invitados.length > 0) {
      invitacionesPendientesIds = invitados.map((id: string) => id.toString());
    }

    // Procesar maxParticipantes
    let maxParticipantesNum: number | null = null;
    if (
      maxParticipantes !== undefined &&
      maxParticipantes !== null &&
      maxParticipantes !== ''
    ) {
      const parsed = parseInt(String(maxParticipantes), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        maxParticipantesNum = parsed;
      }
    }

    const created = await eventoService.createEvento({
      name,
      schedule: new Date(scheduleStr) as any,
      address,
      categoria,
      lat: latNum,
      lng: lngNum,
      participantes: allParticipantesIds as any,
      creador: creadorId,
      isPrivate: isPrivate || false,
      invitados: invitadosIds as any,
      invitacionesPendientes: invitacionesPendientesIds as any,
      maxParticipantes: maxParticipantesNum,
    });

    if (allParticipantesIds.length > 0) {
      await Usuario.updateMany(
        { _id: { $in: allParticipantesIds } },
        { $addToSet: { eventos: created._id } },
      ).exec();
    }

    const populated = await Evento.findById(created._id)
      .populate('participantes', 'username gmail')
      .populate('creador', 'username gmail')
      .populate('invitados', 'username gmail')
      .populate('invitacionesPendientes', 'username gmail')
      .exec();

    logger.info(
      `Evento creado con ID: ${created._id} por usuario ${creadorId}, privado: ${isPrivate}, maxParticipantes: ${maxParticipantesNum}`,
    );

    return res.status(201).json(populated ?? created);
  } catch (error) {
    logger.error(`Error al crear evento: ${(error as Error).message}`);
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const getEventosByBounds = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const north = parseFloat(req.query.north as string);
    const south = parseFloat(req.query.south as string);
    const east = parseFloat(req.query.east as string);
    const west = parseFloat(req.query.west as string);

    if ([north, south, east, west].some((v) => Number.isNaN(v))) {
      res.status(400).json({ message: 'Parámetros de mapa inválidos' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 10),
    );

    const userId = (req as any).user?.id;
    const result = await eventoService.getEventosWithinBounds(
      north,
      south,
      east,
      west,
      page,
      limit,
      userId,
    );

    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error al obtener eventos por área de mapa: ${error}`);
    res
      .status(500)
      .json({ message: 'Error al obtener eventos por área de mapa', error });
  }
};

export async function createEventoFromPanel(req: Request, res: Response) {
  try {
    const { name, creador, address, schedule, participantes, lat, lng } =
      req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      logger.warn('Nombre del evento no proporcionado o inválido');
      return res
        .status(400)
        .json({ message: 'El nombre del evento es obligatorio.' });
    }
    if (!creador || typeof creador !== 'string') {
      logger.warn('ID del creador no proporcionado o inválido');
      return res
        .status(400)
        .json({ message: 'Debes indicar el ID del creador del evento.' });
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
    logger.info(
      `Evento creado desde panel con ID: ${evento!._id} por creador: ${creador}`,
    );
    return res.status(201).json(evento);
  } catch (err: any) {
    logger.error(`Error al crear evento desde panel: ${err?.message || err}`);
    return res
      .status(500)
      .json({ message: err?.message || 'No se pudo crear el evento (panel).' });
  }
}

export const getAllEventos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 6),
    );
    const skip = (page - 1) * limit;

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(),
      Evento.find()
        .skip(skip)
        .limit(limit)
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail'),
    ]);
    logger.info(`Obteniendo eventos - Página: ${page}, Límite: ${limit}`);
    res.status(200).json({
      data: eventos,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });
  } catch (error) {
    logger.error(`Error al obtener eventos: ${(error as Error).message}`);
    res.status(500).json({ message: 'Error al obtener eventos', error });
  }
};

export const getUpcomingEventos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 10),
    );
    const skip = (page - 1) * limit;
    const now = new Date();
    const filter: any = { schedule: { $gte: now } };

    const userId = (req as any).user?.id;
    if (userId) {
      const userObjectId = new Types.ObjectId(userId);
      filter.$or = [
        { isPrivate: false },
        { isPrivate: true, creador: userObjectId },
        { isPrivate: true, invitados: userObjectId },
        { isPrivate: true, invitacionesPendientes: userObjectId },
        { isPrivate: true, participantes: userObjectId },
      ];
    } else {
      filter.isPrivate = false;
    }

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(filter),
      Evento.find(filter)
        .sort({ schedule: 1 })
        .skip(skip)
        .limit(limit)
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail'),
    ]);

    logger.info(
      `Obteniendo eventos futuros - Página: ${page}, Límite: ${limit}`,
    );
    res.status(200).json({
      data: eventos,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });
  } catch (error) {
    logger.error(
      `Error al obtener eventos futuros: ${(error as Error).message}`,
    );
    res
      .status(500)
      .json({ message: 'Error al obtener eventos futuros', error });
  }
};

export async function getEventoById(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id } = req.params;
    const evento = await eventoService.getEventoById(id);
    if (!evento) {
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

export async function deleteEventoById(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRol = (req as any).user?.rol;

    if (!userId) {
      logger.warn('No autenticado al eliminar evento');
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await Evento.findById(id).lean().exec();
    if (!evento) {
      logger.warn(`Evento no encontrado para eliminar con ID: ${id}`);
      return res.status(404).json({ message: 'EVENTO NO ENCONTRADO' });
    }

    const creadorId = (evento.creador as any)?._id
      ? String((evento.creador as any)._id)
      : String(evento.creador);
    if (!canModifyEvento(userRol, userId, creadorId)) {
      logger.warn(
        `Usuario ${userId} (${userRol}) no tiene permiso para eliminar evento ${id}`,
      );
      return res.status(403).json({
        message:
          'Solo el creador o un administrador pueden eliminar este evento',
      });
    }

    if (
      Array.isArray(evento.participantes) &&
      evento.participantes.length > 0
    ) {
      logger.info(`Eliminando referencias del evento ${id} de participantes`);
      await Usuario.updateMany(
        { _id: { $in: evento.participantes } },
        { $pull: { eventos: evento._id } },
      ).exec();
    }

    const deleted = await eventoService.deleteEventoById(id);
    logger.info(`Evento ${id} eliminado por usuario ${userId} (${userRol})`);
    return res.status(200).json(deleted);
  } catch (error) {
    logger.error(
      `Error al eliminar evento por ID: ${(error as Error).message}`,
    );
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const updateEventoById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRol = (req as any).user?.rol;

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

    const creadorId = (evento.creador as any)?._id
      ? String((evento.creador as any)._id)
      : String(evento.creador);
    if (!canModifyEvento(userRol, userId, creadorId)) {
      logger.warn(
        `Usuario ${userId} (${userRol}) no tiene permiso para actualizar evento ${id}`,
      );
      res.status(403).json({
        message: 'Solo el creador o un administrador pueden editar este evento',
      });
      return;
    }

    const bodyUpdate: any = { ...req.body };

    if (
      bodyUpdate.lat !== undefined &&
      bodyUpdate.lat !== null &&
      bodyUpdate.lat !== ''
    ) {
      const parsed = parseFloat(bodyUpdate.lat);
      bodyUpdate.lat = Number.isNaN(parsed) ? undefined : parsed;
    }
    if (
      bodyUpdate.lng !== undefined &&
      bodyUpdate.lng !== null &&
      bodyUpdate.lng !== ''
    ) {
      const parsed = parseFloat(bodyUpdate.lng);
      bodyUpdate.lng = Number.isNaN(parsed) ? undefined : parsed;
    }

    const updatedEvento = await Evento.findByIdAndUpdate(id, req.body, {
      new: true,
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

export const joinEvento = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const resultado = await eventoService.joinEvento(id, userId);

    if (resultado.enListaEspera) {
      return res.status(200).json({
        message: resultado.mensaje,
        evento: resultado.evento,
        enListaEspera: true,
      });
    }

    return res.status(200).json({
      message: resultado.mensaje,
      evento: resultado.evento,
      enListaEspera: false,
    });
  } catch (error: any) {
    logger.error('[joinEvento]', error);
    return res
      .status(500)
      .json({ message: error.message || 'Error al unirse al evento' });
  }
};

export const leaveEvento = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { io } = await import('../index');
    const evento = await eventoService.leaveEvento(id, userId, io);

    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    return res.status(200).json({
      message: 'Has salido del evento',
      evento,
    });
  } catch (error: any) {
    logger.error('[leaveEvento]', error);
    return res
      .status(500)
      .json({ message: error.message || 'Error al salir del evento' });
  }
};

export const leaveWaitlist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await eventoService.leaveWaitlist(id, userId);

    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    return res.status(200).json({
      message: 'Has salido de la lista de espera',
      evento,
    });
  } catch (error: any) {
    logger.error('[leaveWaitlist]', error);
    return res
      .status(500)
      .json({ message: error.message || 'Error al salir de lista de espera' });
  }
};

export const getWaitlistPosition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const position = await eventoService.getWaitlistPosition(id, userId);

    return res.status(200).json({
      position,
      enListaEspera: position > 0,
    });
  } catch (error: any) {
    logger.error('[getWaitlistPosition]', error);
    return res
      .status(500)
      .json({ message: error.message || 'Error al obtener posición' });
  }
};

export const getMisEventos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

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
        .populate('creador', 'username gmail'),
    ]);
    logger.info(`Obtenidos eventos para el usuario ${userId}`);
    res.status(200).json({
      eventosCreados,
      eventosInscritos,
    });
  } catch (error) {
    logger.error(`Error al obtener mis eventos: ${error}`);
    res.status(500).json({ message: 'Error al obtener mis eventos', error });
  }
};

export const checkEventNameExists = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      logger.warn("El campo 'name' es obligatorio para verificar existencia");
      res.status(400).json({
        exists: false,
        message: "El campo 'name' es obligatorio",
      });
      return;
    }

    const existingEvent = await Evento.findOne({ name });
    if (existingEvent) {
      logger.info(`Evento con nombre '${name}' ya existe`);
      res.status(200).json({
        exists: true,
        message: 'Ya existe un evento con este título',
      });
      return;
    }
    logger.info(`Nombre de evento '${name}' está disponible`);
    res.status(200).json({
      exists: false,
      message: 'El título está disponible',
    });
  } catch (error) {
    logger.error(
      `Error al verificar existencia del título del evento: ${error}`,
    );
    res.status(500).json({
      exists: false,
      error: 'Error al verificar el título del evento',
      details: error instanceof Error ? error.message : error,
    });
  }
};

export const searchEventos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 10),
    );
    const skip = (page - 1) * limit;

    const searchTerm = (req.query.search as string) || '';
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const categoria = req.query.categoria as string;

    const filter: any = {};

    if (categoria && categoria.trim()) {
      filter.categoria = categoria.trim();
      logger.info(`🏷️ Aplicando filtro por categoría: "${categoria.trim()}"`);
    }

    if (searchTerm && searchTerm.trim()) {
      filter.name = { $regex: searchTerm.trim(), $options: 'i' };
      logger.info(`🔍 Aplicando filtro por nombre: "${searchTerm.trim()}"`);
    }

    if (dateFrom || dateTo) {
      if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom + 'T00:00:00.000Z');
        const toDate = new Date(dateTo + 'T23:59:59.999Z');

        filter.schedule = {
          $gte: fromDate,
          $lte: toDate,
        };
        logger.info(
          `📅 Filtro por rango: ${fromDate.toISOString()} hasta ${toDate.toISOString()}`,
        );
      } else if (dateFrom) {
        const fromDate = new Date(dateFrom + 'T00:00:00.000Z');
        filter.schedule = { $gte: fromDate };
        logger.info(`📅 Filtro desde: ${fromDate.toISOString()}`);
      } else if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59.999Z');
        filter.schedule = { $lte: toDate };
        logger.info(`📅 Filtro hasta: ${toDate.toISOString()}`);
      }
    }

    const userId = (req as any).user?.id;
    if (userId) {
      const userObjectId = new Types.ObjectId(userId);
      filter.$or = [
        { isPrivate: false },
        { isPrivate: true, creador: userObjectId },
        { isPrivate: true, invitados: userObjectId },
        { isPrivate: true, invitacionesPendientes: userObjectId },
        { isPrivate: true, participantes: userObjectId },
      ];
    } else {
      filter.isPrivate = false;
    }
    const [total, eventos] = await Promise.all([
      Evento.countDocuments(filter),
      Evento.find(filter)
        .skip(skip)
        .limit(limit)
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail')
        .sort({ schedule: 1 }),
    ]);

    logger.info(
      `✅ Búsqueda completada - Total: ${total}, Devueltos: ${eventos.length}`,
    );

    res.status(200).json({
      data: eventos,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalItems: total,
    });
  } catch (error) {
    logger.error(
      `❌ Error en búsqueda de eventos: ${(error as Error).message}`,
    );
    res.status(500).json({
      message: 'Error en búsqueda de eventos',
      error: (error as Error).message,
    });
  }
};

export async function inviteUsersToPrivateEvent(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id: eventoId } = req.params;
    const { userIds } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ message: 'Debe proporcionar una lista de IDs de usuarios' });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    if (!evento.isPrivate) {
      return res.status(400).json({ message: 'El evento no es privado' });
    }

    const creadorIdInvite = (evento.creador as any)?._id
      ? String((evento.creador as any)._id)
      : String(evento.creador);
    if (creadorIdInvite !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Solo el creador puede invitar usuarios' });
    }

    const eventoActualizado = await eventoService.inviteUsersToEvent(
      eventoId,
      userIds,
    );

    return res.status(200).json({
      message: 'Invitaciones enviadas correctamente',
      evento: eventoActualizado,
    });
  } catch (error) {
    logger.error(`Error invitando usuarios: ${error}`);
    return res.status(500).json({
      message: 'Error invitando usuarios',
      error: (error as Error).message,
    });
  }
}

export async function acceptPrivateEventInvitation(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id: eventoId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const isPending = evento.invitacionesPendientes.some(
      (id) => id.toString() === userId.toString(),
    );
    if (!isPending) {
      return res
        .status(400)
        .json({ message: 'No tienes invitación pendiente para este evento' });
    }

    const resultado = await eventoService.acceptInvitation(eventoId, userId);

    await Usuario.findByIdAndUpdate(userId, {
      $addToSet: { eventos: eventoId },
    });

    return res.status(200).json({
      message: resultado.mensaje,
      evento: resultado.evento,
      enListaEspera: resultado.enListaEspera,
    });
  } catch (error) {
    logger.error(`Error aceptando invitación: ${error}`);
    return res.status(500).json({
      message: 'Error aceptando invitación',
      error: (error as Error).message,
    });
  }
}

export async function rejectPrivateEventInvitation(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id: eventoId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const isPending = evento.invitacionesPendientes.some(
      (id) => id.toString() === userId.toString(),
    );
    if (!isPending) {
      return res
        .status(400)
        .json({ message: 'No tienes invitación pendiente para este evento' });
    }

    const eventoActualizado = await eventoService.rejectInvitation(
      eventoId,
      userId,
    );

    return res.status(200).json({
      message: 'Invitación rechazada',
      evento: eventoActualizado,
    });
  } catch (error) {
    logger.error(`Error rechazando invitación: ${error}`);
    return res.status(500).json({
      message: 'Error rechazando invitación',
      error: (error as Error).message,
    });
  }
}

export async function getMyPendingInvitations(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const invitaciones = await eventoService.getPendingInvitations(userId);

    return res.status(200).json({
      count: invitaciones.length,
      invitaciones,
    });
  } catch (error) {
    logger.error(`Error obteniendo invitaciones: ${error}`);
    return res.status(500).json({
      message: 'Error obteniendo invitaciones',
      error: (error as Error).message,
    });
  }
}

export async function removeInvitedUserFromEvent(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { id: eventoId, userId: targetUserId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const creadorIdRemove = (evento.creador as any)?._id
      ? String((evento.creador as any)._id)
      : String(evento.creador);
    if (creadorIdRemove !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Solo el creador puede eliminar invitados' });
    }

    const eventoActualizado = await eventoService.removeInvitedUser(
      eventoId,
      targetUserId,
    );

    await Usuario.findByIdAndUpdate(targetUserId, {
      $pull: { eventos: eventoId },
    });

    return res.status(200).json({
      message: 'Usuario eliminado del evento',
      evento: eventoActualizado,
    });
  } catch (error) {
    logger.error(`Error eliminando invitado: ${error}`);
    return res.status(500).json({
      message: 'Error eliminando invitado',
      error: (error as Error).message,
    });
  }
}

export async function getEventosVisibles(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit as string) || 6),
    );

    logger.info(
      `[EventoController] Request page: ${req.query.page} -> parsed: ${page}, limit: ${req.query.limit} -> parsed: ${limit}`,
    );

    const result = await eventoService.getEventosVisiblesParaUsuario(
      userId,
      page,
      limit,
    );

    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error obteniendo eventos visibles: ${error}`);
    return res.status(500).json({
      message: 'Error obteniendo eventos visibles',
      error: (error as Error).message,
    });
  }
}

export async function getCalendarEvents(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      return res
        .status(400)
        .json({ message: 'Se requieren parámetros dateFrom y dateTo' });
    }

    const start = new Date(dateFrom as string);
    const end = new Date(dateTo as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Fechas inválidas' });
    }

    const eventos = await eventoService.getCalendarEvents(userId, start, end);

    return res.status(200).json(eventos);
  } catch (error) {
    logger.error(`Error obteniendo eventos de calendario: ${error}`);
    return res.status(500).json({
      message: 'Error obteniendo eventos de calendario',
      error: (error as Error).message,
    });
  }
}

const INTEREST_TO_CATEGORIES: Record<string, string[]> = {
  Deportes: [
    'Fútbol',
    'Baloncesto',
    'Tenis',
    'Pádel',
    'Running',
    'Ciclismo',
    'Natación',
    'Yoga',
    'Gimnasio',
    'Senderismo',
  ],
  Música: [
    'Concierto Rock',
    'Concierto Pop',
    'Concierto Clásica',
    'Jazz',
    'Electrónica',
    'Hip Hop',
    'Karaoke',
    'Festival Musical',
    'Discoteca',
  ],
  Tecnología: [
    'Gaming',
    'eSports',
    'Programación',
    'Inteligencia Artificial',
    'Blockchain',
    'Startups',
    'Hackathon',
    'Meetup Tech',
  ],
  Gastronomía: [
    'Restaurante',
    'Tapas',
    'Cocina Internacional',
    'Vinos',
    'Cerveza Artesanal',
    'Repostería',
    'Brunch',
    'Food Truck',
  ],
  Cultura: [
    'Exposición Arte',
    'Teatro',
    'Cine',
    'Museo',
    'Literatura',
    'Fotografía',
    'Pintura',
    'Danza',
  ],
  Social: [
    'Discoteca',
    'After Work',
    'Networking',
    'Speed Dating',
    'Fiesta Temática',
    'Cumpleaños',
    'Fiesta Privada',
  ],
  Salud: ['Meditación', 'Spa', 'Wellness', 'Mindfulness', 'Salud Mental'],
  'Aire Libre': ['Camping', 'Montañismo', 'Playa', 'Barbacoa', 'Picnic'],
};

export async function getRecommendedEventos(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const userId = (req as any).user?.id;
    logger.info(`[getRecommendedEventos] INICIO - userId: ${userId}`);
    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await Usuario.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!user.interests || user.interests.length === 0) {
      return res
        .status(200)
        .json({ data: [], message: 'No tienes intereses definidos' });
    }

    logger.info(
      `[getRecommendedEventos] User ${userId} interests: ${user.interests}`,
    );

    const expandedCategories = new Set<string>();
    user.interests.forEach((interest) => {
      expandedCategories.add(interest);
      const subCategories = INTEREST_TO_CATEGORIES[interest];
      if (subCategories) {
        subCategories.forEach((cat) => expandedCategories.add(cat));
      }
    });

    logger.info(
      `[getRecommendedEventos] Expanded categories: ${Array.from(expandedCategories)}`,
    );

    const now = new Date();
    const filter: any = {
      schedule: { $gte: now },
      categoria: { $in: Array.from(expandedCategories) },
      isPrivate: false,
    };

    const userObjectId = new Types.ObjectId(userId);
    filter.participantes = { $ne: userObjectId };

    logger.info(
      `[getRecommendedEventos] Filter built: ${JSON.stringify(filter)}`,
    );

    const total = await Evento.countDocuments(filter);
    logger.info(`[getRecommendedEventos] Total found: ${total}`);
    const eventos = await Evento.find(filter)
      .sort({ schedule: 1 })
      .skip(skip)
      .limit(limit)
      .populate('participantes', 'username gmail')
      .populate('creador', 'username gmail');

    logger.info(
      `[getRecommendedEventos] Found ${eventos.length} events out of ${total} total`,
    );

    return res.status(200).json({
      data: eventos,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error obteniendo recomendaciones: ${error}`);
    return res
      .status(500)
      .json({ message: 'Error obteniendo recomendaciones' });
  }
}

