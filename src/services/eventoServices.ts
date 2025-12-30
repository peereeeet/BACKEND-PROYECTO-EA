import { Evento, IEvento } from '../models/evento';
import { Types } from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger';
import gamificacionService from './gamificacionServices';

export class EventoService {
  async createEvento(data: Partial<IEvento>): Promise<IEvento> {
    const participantes = Array.from(
      new Set((data.participantes || []).map((id: any) => id.toString())),
    ).map((id) => new Types.ObjectId(id));

    const payload: Partial<IEvento> = {
      ...data,
      participantes: participantes as any,
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

    const payload: any = {
      name: input.name.trim(),
      address: input.address || '',
      creador: new Types.ObjectId(input.creador),
      participantes,
    };

    if (input.categoria) {
      payload.categoria = input.categoria;
    }

    if (input.schedule) {
      const d = new Date(input.schedule as any);
      payload.schedule = isNaN(d.getTime()) ? null : d;
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
    return await Evento.findById(id);
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
    }

    return {
      evento: eventoActualizado,
      enListaEspera: false,
      mensaje: 'Te has unido al evento correctamente',
    };
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
    const filter: any = {
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
      data: eventos as any,
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
  ): Promise<IEvento | null> {
    const evento = await Evento.findById(eventoId);
    if (!evento) return null;

    const objectIds = userIds.map((id) => new Types.ObjectId(id));

    return await Evento.findByIdAndUpdate(
      eventoId,
      { $addToSet: { invitacionesPendientes: { $each: objectIds } } },
      { new: true },
    )
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

    if (
      evento.maxParticipantes &&
      evento.participantes.length >= evento.maxParticipantes
    ) {
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

      return {
        evento: eventoActualizado,
        enListaEspera: true,
        mensaje: `Evento completo. Has sido añadido a la lista de espera.`,
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

    return {
      evento: eventoActualizado,
      enListaEspera: false,
      mensaje: 'Invitación aceptada correctamente',
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
}
