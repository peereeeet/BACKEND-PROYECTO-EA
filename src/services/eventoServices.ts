import { Evento, IEvento } from '../models/evento';
import { Types } from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger';
import gamificacionService from './gamificacionServices';
import notificacionService from './notificacionServices';
import Usuario from '../models/usuario';

export class EventoService {
  async createEvento(data: Partial<IEvento>): Promise<IEvento> {
    const participantes = Array.from(
      new Set(
        (data.participantes || []).map((id: string | Types.ObjectId) =>
          id.toString(),
        ),
      ),
    ).map((id) => new Types.ObjectId(id));

    const payload: Partial<IEvento> = {
      ...data,
      participantes: participantes as Types.ObjectId[],
    };

    if (data.lat !== undefined) {
      const latNum =
        typeof data.lat === 'string' ? parseFloat(data.lat) : data.lat;
      if (!Number.isNaN(latNum as number)) payload.lat = latNum as number;
    }

    if (data.lng !== undefined) {
      const lngNum =
        typeof data.lng === 'string' ? parseFloat(data.lng) : data.lng;
      if (!Number.isNaN(lngNum as number)) payload.lng = lngNum as number;
    }

    if (data.maxParticipantes !== undefined) {
      const maxNum =
        typeof data.maxParticipantes === 'string'
          ? parseInt(data.maxParticipantes, 10)
          : data.maxParticipantes;
      payload.maxParticipantes = maxNum && maxNum > 0 ? maxNum : undefined;
    }

    const e = new Evento(payload);
    const evento = await e.save();

    if (data.creador) {
      try {
        await gamificacionService.otorgarPuntos(
          data.creador.toString(),
          'crearEvento',
        );
      } catch (err) {
        logger.error(`Error al otorgar puntos por crear evento: ${err}`);
      }
    }

    return evento;
  }

  async createEventoWithCreator(input: {
    name: string;
    address?: string;
    lat?: number | string;
    lng?: number | string;
    schedule?: string | Date | null;
    participantes?: string[];
    creador: string;
    categoria?: string;
    maxParticipantes?: number | string | null;
  }) {
    const uniqueIds = new Set<string>(
      [input.creador, ...(input.participantes || [])].filter(Boolean),
    );

    const participantes = Array.from(uniqueIds).map(
      (id) => new Types.ObjectId(id),
    );

    const payload: Partial<IEvento> = {
      name: input.name.trim(),
      address: input.address || '',
      creador: new Types.ObjectId(input.creador),
      participantes,
    };

    if (input.categoria) {
      payload.categoria = input.categoria;
    }

    if (input.schedule) {
      const d = new Date(input.schedule as string | number | Date);
      payload.schedule = isNaN(d.getTime()) ? undefined : d;
    }

    if (input.lat !== undefined && input.lat !== null && input.lat !== '') {
      const latNum =
        typeof input.lat === 'string' ? parseFloat(input.lat) : input.lat;
      if (!Number.isNaN(latNum as number)) payload.lat = latNum;
    }

    if (input.lng !== undefined && input.lng !== null && input.lng !== '') {
      const lngNum =
        typeof input.lng === 'string' ? parseFloat(input.lng) : input.lng;
      if (!Number.isNaN(lngNum as number)) payload.lng = lngNum;
    }

    if (
      input.maxParticipantes !== undefined &&
      input.maxParticipantes !== null
    ) {
      const maxNum =
        typeof input.maxParticipantes === 'string'
          ? parseInt(input.maxParticipantes, 10)
          : input.maxParticipantes;
      payload.maxParticipantes = maxNum && maxNum > 0 ? maxNum : undefined;
    }

    const created = await Evento.create(payload);

    try {
      await gamificacionService.otorgarPuntos(input.creador, 'crearEvento');
    } catch (err) {
      logger.error(`Error al otorgar puntos por crear evento: ${err}`);
    }

    return Evento.findById(created._id)
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .lean();
  }

  async getAllEventos(): Promise<IEvento[]> {
    return await Evento.find();
  }

  async getEventoById(id: string): Promise<IEvento | null> {
    return await Evento.findById(id)
      .populate('creador', 'username gmail profilePhoto')
      .populate('participantes', 'username gmail profilePhoto online')
      .populate('listaEspera', 'username gmail profilePhoto online');
  }

  async deleteEventoById(id: string): Promise<IEvento | null> {
    return await Evento.findByIdAndDelete(id);
  }

  async joinEvento(
    eventoId: string,
    userId: string,
  ): Promise<{
    evento: IEvento | null;
    enListaEspera: boolean;
    mensaje: string;
  }> {
    const evento = await Evento.findById(eventoId);

    if (!evento) {
      throw new Error('Evento no encontrado');
    }

    const yaParticipa = evento.participantes.some(
      (p) => p.toString() === userId,
    );

    if (yaParticipa) {
      const eventoPopulado = await evento.populate('creador', 'username gmail');
      return {
        evento: eventoPopulado,
        enListaEspera: false,
        mensaje: 'Ya estás inscrito en este evento',
      };
    }

    const yaEnListaEspera = evento.listaEspera.some(
      (p) => p.toString() === userId,
    );

    if (yaEnListaEspera) {
      const eventoPopulado = await evento.populate('creador', 'username gmail');
      return {
        evento: eventoPopulado,
        enListaEspera: true,
        mensaje: 'Ya estás en la lista de espera',
      };
    }

    if (
      evento.maxParticipantes &&
      evento.participantes.length >= evento.maxParticipantes
    ) {
      const eventoActualizado = await Evento.findByIdAndUpdate(
        eventoId,
        { $addToSet: { listaEspera: userId } },
        { new: true },
      )
        .populate('creador', 'username gmail')
        .populate('participantes', 'username gmail')
        .populate('listaEspera', 'username gmail');

      logger.info(
        `Usuario ${userId} añadido a lista de espera del evento ${eventoId}`,
      );

      return {
        evento: eventoActualizado,
        enListaEspera: true,
        mensaje: `Evento completo (${evento.participantes.length}/${evento.maxParticipantes}). Has sido añadido a la lista de espera.`,
      };
    }

    const eventoActualizado = await Evento.findByIdAndUpdate(
      eventoId,
      { $addToSet: { participantes: userId } },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .populate('listaEspera', 'username gmail');

    if (eventoActualizado) {
      try {
        await gamificacionService.otorgarPuntos(userId, 'unirseEvento');
      } catch (err) {
        logger.error(`Error al otorgar puntos por unirse a evento: ${err}`);
      }

      try {
        await this.notificarCreadorSiEsAmigo(eventoActualizado, userId);
      } catch (err) {
        logger.error(`Error al enviar notificación al creador: ${err}`);
      }
    }

    return {
      evento: eventoActualizado,
      enListaEspera: false,
      mensaje: 'Te has unido al evento correctamente',
    };
  }

  private async notificarCreadorSiEsAmigo(
    evento: IEvento,
    userId: string,
  ): Promise<void> {
    try {
      let creadorId: string;
      if (
        evento.creador &&
        typeof evento.creador === 'object' &&
        '_id' in evento.creador
      ) {
        creadorId = (evento.creador as { _id: Types.ObjectId })._id.toString();
      } else {
        creadorId = (evento.creador as Types.ObjectId).toString();
      }

      if (creadorId === userId) {
        logger.info(
          `Usuario ${userId} es el creador, no se envía notificación`,
        );
        return;
      }

      const creador = await Usuario.findById(creadorId)
        .select('friends')
        .lean();

      if (!creador) {
        logger.warn(`Creador ${creadorId} no encontrado para notificación`);
        return;
      }

      const sonAmigos = creador.friends?.some(
        (friendId: string | Types.ObjectId | { _id: Types.ObjectId }) => {
          const id =
            typeof friendId === 'object' && '_id' in friendId
              ? (friendId as { _id: Types.ObjectId })._id.toString()
              : friendId.toString();
          return id === userId;
        },
      );

      if (!sonAmigos) {
        logger.info(
          `Usuario ${userId} no es amigo del creador ${creadorId}, no se envía notificación`,
        );
        return;
      }

      const usuario = await Usuario.findById(userId).select('username').lean();

      if (!usuario) {
        logger.warn(`Usuario ${userId} no encontrado para notificación`);
        return;
      }

      await notificacionService.notifyFriendJoinedEvent(
        creadorId,
        userId,
        usuario.username,
        evento._id.toString(),
        evento.name,
      );

      logger.info(
        `✅ Notificación enviada: ${usuario.username} se unió al evento "${evento.name}" de su amigo`,
      );
    } catch (error) {
      logger.error(`Error en notificarCreadorSiEsAmigo: ${error}`);
    }
  }

  async leaveEvento(
    eventoId: string,
    userId: string,
    io?: any,
  ): Promise<IEvento | null> {
    const evento = await Evento.findById(eventoId);

    if (!evento) {
      throw new Error('Evento no encontrado');
    }

    const eventoActualizado = await Evento.findByIdAndUpdate(
      eventoId,
      { $pull: { participantes: userId } },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .populate('listaEspera', 'username gmail');

    if (!eventoActualizado) return null;

    await this.procesarListaEspera(eventoActualizado, io);

    return eventoActualizado;
  }

  async procesarListaEspera(evento: IEvento, io?: any): Promise<void> {
    if (!evento.maxParticipantes) return;
    if (evento.participantes.length >= evento.maxParticipantes) return;
    if (evento.listaEspera.length === 0) return;

    const siguienteUserId = evento.listaEspera[0];

    logger.info(
      `Procesando lista de espera. Moviendo usuario ${siguienteUserId} a participantes`,
    );

    const eventoActualizado = await Evento.findByIdAndUpdate(
      evento._id,
      {
        $pull: { listaEspera: siguienteUserId },
        $addToSet: { participantes: siguienteUserId },
      },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .populate('listaEspera', 'username gmail');

    if (eventoActualizado) {
      try {
        await gamificacionService.otorgarPuntos(
          siguienteUserId.toString(),
          'unirseEvento',
        );
      } catch (err) {
        logger.error(`Error al otorgar puntos: ${err}`);
      }

      try {
        await notificacionService.notifySpotAvailable(
          siguienteUserId.toString(),
          evento._id.toString(),
          evento.name,
        );
        logger.info(
          `✅ Notificación de plaza disponible enviada a ${siguienteUserId}`,
        );
      } catch (err) {
        logger.error(
          `Error al enviar notificación de plaza disponible: ${err}`,
        );
      }

      if (io) {
        io.to(`user:${siguienteUserId}`).emit('evento:plazaDisponible', {
          eventoId: evento._id.toString(),
          eventoName: evento.name,
          mensaje: `¡Buenas noticias! Ahora puedes participar en "${evento.name}"`,
        });
      }

      logger.info(
        `Usuario ${siguienteUserId} movido de lista de espera a participantes`,
      );
    }
  }
  async leaveWaitlist(
    eventoId: string,
    userId: string,
  ): Promise<IEvento | null> {
    return await Evento.findByIdAndUpdate(
      eventoId,
      { $pull: { listaEspera: userId } },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .populate('listaEspera', 'username gmail');
  }

  async getWaitlistPosition(eventoId: string, userId: string): Promise<number> {
    const evento = await Evento.findById(eventoId);

    if (!evento) return -1;

    const position = evento.listaEspera.findIndex(
      (id) => id.toString() === userId,
    );

    return position + 1;
  }

  async getEventosByCreador(creadorId: string): Promise<IEvento[]> {
    return await Evento.find({ creador: creadorId }).populate(
      'creador',
      'username gmail',
    );
  }

  async getEventosWithinBounds(
    north: number,
    south: number,
    east: number,
    west: number,
    page: number,
    limit: number,
    userId?: string,
  ): Promise<{
    data: IEvento[];
    page: number;
    totalPages: number;
    totalItems: number;
  }> {
    const now = new Date();
    const filter: Record<string, unknown> = {
      lat: { $gte: south, $lte: north },
      lng: { $gte: west, $lte: east },
      schedule: { $gte: now },
    };

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

    const skip = (page - 1) * limit;

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(filter),
      Evento.find(filter)
        .sort({ schedule: 1 })
        .skip(skip)
        .limit(limit)
        .populate('participantes', 'username gmail')
        .populate('creador', 'username gmail'),
    ]);

    return {
      data: eventos as unknown as IEvento[],
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalItems: total,
    };
  }

  async geocodeAddress(
    address: string,
  ): Promise<{ lat: number; lng: number } | null> {
    try {
      const resp = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: address,
            format: 'json',
            limit: 1,
          },
          headers: {
            'User-Agent': 'ea-proyecto-tfg/1.0 (perejs17@ejemplo.com)',
          },
        },
      );

      const data = resp.data;
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn(
          `[EventoService] Geocoding sin resultados para:, ${address}`,
        );
        return null;
      }

      const first = data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);

      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        logger.warn(
          `[EventoService] Geocoding: lat/lon inválidos para: ${address}`,
        );
        return null;
      }

      return { lat, lng: lon };
    } catch (err) {
      logger.error(
        `[EventoService] Error geocodificando dirección (Nominatim): ${err}`,
      );
      return null;
    }
  }

  async inviteUsersToEvent(
    eventoId: string,
    userIds: string[],
    creadorId: string,
  ): Promise<IEvento | null> {
    if (!Types.ObjectId.isValid(eventoId)) {
      throw new Error('ID de evento inválido');
    }

    const evento = await Evento.findById(eventoId).populate(
      'creador',
      '_id username gmail',
    );

    if (!evento) {
      throw new Error('Evento no encontrado');
    }

    if (!evento.isPrivate) {
      throw new Error('Solo se pueden enviar invitaciones a eventos privados');
    }

    if (evento.maxParticipantes) {
      const totalActual = evento.participantes.length;
      const totalInvitacionesPendientes = evento.invitacionesPendientes.length;
      const nuevosInvitados = userIds.length;
      const totalPotencial =
        totalActual + totalInvitacionesPendientes + nuevosInvitados;

      if (totalPotencial > evento.maxParticipantes) {
        logger.warn(
          `Intento de invitar ${nuevosInvitados} usuarios al evento ${eventoId} excedería límite (${totalPotencial} > ${evento.maxParticipantes})`,
        );
        throw new Error(
          `No se pueden invitar a ${nuevosInvitados} usuarios. ` +
            `El evento tiene un límite de ${evento.maxParticipantes} participantes. ` +
            `Actualmente hay ${totalActual} participantes y ${totalInvitacionesPendientes} invitaciones pendientes.`,
        );
      }
    }

    const creadorIdStr = (evento.creador as any)?._id
      ? String((evento.creador as any)._id)
      : String(evento.creador);

    if (creadorIdStr !== creadorId) {
      throw new Error('Solo el creador puede invitar usuarios');
    }

    const creadorUsername = (evento.creador as any)?.username || 'Usuario';

    for (const userId of userIds) {
      if (!Types.ObjectId.isValid(userId)) {
        logger.warn(`ID de usuario inválido: ${userId}`);
        continue;
      }

      const userObjectId = new Types.ObjectId(userId);

      const yaInvitado = evento.invitacionesPendientes.some(
        (id) => String(id) === userId,
      );
      const yaParticipante = evento.participantes.some(
        (id) => String(id) === userId,
      );

      if (yaInvitado || yaParticipante) {
        logger.info(`Usuario ${userId} ya está invitado o es participante`);
        continue;
      }

      await Evento.updateOne(
        { _id: eventoId },
        { $addToSet: { invitacionesPendientes: userObjectId } },
      );

      logger.info(
        `✅ Usuario ${userId} agregado a invitacionesPendientes del evento ${eventoId}`,
      );

      const { io } = await import('../index');
      io.to(`user:${userId}`).emit('eventInvitation:received', {
        fromUserId: creadorId,
        fromUsername: creadorUsername,
        eventId: eventoId,
        eventName: evento.name,
      });

      logger.info(
        `🔔 Evento eventInvitation:received enviado a user:${userId}`,
      );

      await notificacionService.notifyEventInvitation(
        userId,
        creadorId,
        creadorUsername,
        eventoId,
        evento.name,
      );

      logger.info(`📧 Notificación persistente creada para usuario ${userId}`);
    }

    return await Evento.findById(eventoId)
      .populate('creador', 'username gmail')
      .populate('invitados', 'username gmail')
      .populate('invitacionesPendientes', 'username gmail');
  }

  async acceptInvitation(
    eventoId: string,
    userId: string,
  ): Promise<{
    evento: IEvento | null;
    enListaEspera: boolean;
    mensaje: string;
  }> {
    const userObjectId = new Types.ObjectId(userId);

    const evento = await Evento.findById(eventoId);

    if (!evento) {
      throw new Error('Evento no encontrado');
    }

    const tieneInvitacion = evento.invitacionesPendientes.some(
      (id) => id.toString() === userId,
    );

    if (!tieneInvitacion) {
      throw new Error('No tienes una invitación pendiente para este evento');
    }

    const yaParticipa = evento.participantes.some(
      (p) => p.toString() === userId,
    );

    if (yaParticipa) {
      const eventoActualizado = await Evento.findByIdAndUpdate(
        eventoId,
        {
          $pull: { invitacionesPendientes: userObjectId },
        },
        { new: true },
      )
        .populate('creador', 'username gmail')
        .populate('invitados', 'username gmail')
        .populate('participantes', 'username gmail')
        .populate('listaEspera', 'username gmail');

      logger.info(
        `Usuario ${userId} ya estaba en participantes del evento ${eventoId}`,
      );

      return {
        evento: eventoActualizado,
        enListaEspera: false,
        mensaje: 'Ya estás inscrito en este evento',
      };
    }

    const hayEspacio =
      !evento.maxParticipantes ||
      evento.participantes.length < evento.maxParticipantes;

    if (!hayEspacio) {
      const eventoActualizado = await Evento.findByIdAndUpdate(
        eventoId,
        {
          $pull: { invitacionesPendientes: userObjectId },
          $addToSet: {
            invitados: userObjectId,
            listaEspera: userObjectId,
          },
        },
        { new: true },
      )
        .populate('creador', 'username gmail')
        .populate('invitados', 'username gmail')
        .populate('participantes', 'username gmail')
        .populate('listaEspera', 'username gmail');

      logger.info(
        `⏳ Usuario ${userId} aceptó invitación pero el evento ${eventoId} está lleno (${evento.participantes.length}/${evento.maxParticipantes}). Añadido a lista de espera.`,
      );

      return {
        evento: eventoActualizado,
        enListaEspera: true,
        mensaje: `Evento completo (${evento.participantes.length}/${evento.maxParticipantes}). Has sido añadido a la lista de espera.`,
      };
    }

    const eventoActualizado = await Evento.findByIdAndUpdate(
      eventoId,
      {
        $pull: { invitacionesPendientes: userObjectId },
        $addToSet: {
          invitados: userObjectId,
          participantes: userObjectId,
        },
      },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('invitados', 'username gmail')
      .populate('participantes', 'username gmail')
      .populate('listaEspera', 'username gmail');

    await Usuario.findByIdAndUpdate(userId, {
      $addToSet: { eventos: eventoId },
    });

    try {
      await gamificacionService.otorgarPuntos(userId, 'unirseEvento');
    } catch (err) {
      logger.error(`Error al otorgar puntos por unirse a evento: ${err}`);
    }

    logger.info(
      `✅ Usuario ${userId} aceptó invitación y se unió al evento ${eventoId} correctamente`,
    );

    return {
      evento: eventoActualizado,
      enListaEspera: false,
      mensaje: 'Invitación aceptada. Te has unido al evento correctamente.',
    };
  }

  async rejectInvitation(
    eventoId: string,
    userId: string,
  ): Promise<IEvento | null> {
    const userObjectId = new Types.ObjectId(userId);

    return await Evento.findByIdAndUpdate(
      eventoId,
      { $pull: { invitacionesPendientes: userObjectId } },
      { new: true },
    ).populate('creador', 'username gmail');
  }

  async getPendingInvitations(userId: string): Promise<IEvento[]> {
    const userObjectId = new Types.ObjectId(userId);

    return await Evento.find({
      invitacionesPendientes: userObjectId,
      schedule: { $gte: new Date() },
    })
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .sort({ schedule: 1 });
  }

  async removeInvitedUser(
    eventoId: string,
    userId: string,
  ): Promise<IEvento | null> {
    const userObjectId = new Types.ObjectId(userId);

    return await Evento.findByIdAndUpdate(
      eventoId,
      {
        $pull: {
          invitados: userObjectId,
          invitacionesPendientes: userObjectId,
          participantes: userObjectId,
        },
      },
      { new: true },
    )
      .populate('creador', 'username gmail')
      .populate('invitados', 'username gmail')
      .populate('participantes', 'username gmail');
  }

  async getEventosVisiblesParaUsuario(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: IEvento[];
    page: number;
    totalPages: number;
    totalItems: number;
  }> {
    const userObjectId = new Types.ObjectId(userId);
    logger.info(
      `[EventoService] Obteniendo eventos visibles para el usuario: ${userId}`,
    );
    const now = new Date();
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { isPrivate: false },
        { creador: userObjectId },
        { invitados: userObjectId },
        { invitacionesPendientes: userObjectId },
        { participantes: userObjectId },
      ],
      schedule: { $gte: now },
    };

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(query),
      Evento.find(query)
        .populate('creador', 'username gmail')
        .populate('participantes', 'username gmail')
        .sort({ schedule: 1 })
        .skip(skip)
        .limit(limit),
    ]);
    logger.info(`[EventoService] Fecha filtro (now): ${now.toISOString()}`);
    logger.info(`[EventoService] Eventos encontrados: ${eventos.length}`);

    return {
      data: eventos,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      totalItems: total,
    };
  }

  async getCalendarEvents(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<IEvento[]> {
    const userObjectId = new Types.ObjectId(userId);

    return await Evento.find({
      $and: [
        {
          $or: [
            { isPrivate: false },
            { creador: userObjectId },
            { invitados: userObjectId },
            { invitacionesPendientes: userObjectId },
            { participantes: userObjectId },
          ],
        },
        {
          schedule: { $gte: dateFrom, $lte: dateTo },
        },
      ],
    })
      .populate('creador', 'username gmail')
      .populate('participantes', 'username gmail')
      .sort({ schedule: 1 });
  }

  async getUpcomingEventos(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: IEvento[];
    page: number;
    totalPages: number;
    totalItems: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      const now = new Date();

      const query = {
        schedule: { $gte: now },
        isPrivate: false,
      };

      const [total, eventos] = await Promise.all([
        Evento.countDocuments(query),
        Evento.find(query)
          .populate('creador', '_id username gmail')
          .populate('participantes', '_id username gmail')
          .populate('invitados', '_id username gmail')
          .populate('listaEspera', '_id username gmail')
          .sort({ schedule: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      logger.info(
        `📅 Eventos próximos obtenidos: ${eventos.length} eventos (página ${page}/${Math.ceil(total / limit)})`,
      );

      return {
        data: eventos as IEvento[],
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      };
    } catch (error) {
      logger.error(`Error al obtener eventos próximos: ${error}`);
      throw new Error('No se pudieron obtener eventos próximos');
    }
  }

  async getRecommendedEventos(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: IEvento[];
    page: number;
    totalPages: number;
    totalItems: number;
  }> {
    try {
      const user = await Usuario.findById(userId).select('interests');

      if (!user || !user.interests || user.interests.length === 0) {
        return this.getUpcomingEventos(page, limit);
      }

      const userInterests = user.interests;
      const skip = (page - 1) * limit;

      const now = new Date();

      const query: Record<string, unknown> = {
        schedule: { $gte: now },
        categoria: { $in: userInterests },
        $or: [
          { isPrivate: false },
          { isPrivate: true, invitados: new Types.ObjectId(userId) },
        ],
      };

      const [total, eventos] = await Promise.all([
        Evento.countDocuments(query),
        Evento.find(query)
          .populate('creador', '_id username gmail')
          .populate('participantes', '_id username gmail')
          .populate('invitados', '_id username gmail')
          .populate('listaEspera', '_id username gmail')
          .sort({ schedule: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      logger.info(
        `✨ Eventos recomendados obtenidos para usuario ${userId}: ${eventos.length} eventos basados en ${userInterests.length} intereses`,
      );

      return {
        data: eventos as IEvento[],
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      };
    } catch (error) {
      logger.error(`Error al obtener eventos recomendados: ${error}`);
      throw new Error('No se pudieron obtener eventos recomendados');
    }
  }
}
