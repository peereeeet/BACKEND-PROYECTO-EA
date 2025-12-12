import { Evento, IEvento } from '../models/evento';
import { Types } from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger';

export class EventoService {
  async createEvento(data: Partial<IEvento>): Promise<IEvento> {
    const participantes = Array.from(
      new Set((data.participantes || []).map((id: any) => id.toString()))
    ).map((id) => new Types.ObjectId(id));

    const payload: Partial<IEvento> = {
      ...data,
      participantes: participantes as any,
    };

    if (data.lat !== undefined) {
      const latNum = typeof data.lat === 'string' ? parseFloat(data.lat) : data.lat;
      if (!Number.isNaN(latNum as number)) payload.lat = latNum as number;
    }

    if (data.lng !== undefined) {
      const lngNum = typeof data.lng === 'string' ? parseFloat(data.lng) : data.lng;
      if (!Number.isNaN(lngNum as number)) payload.lng = lngNum as number;
    }

    const e = new Evento(payload);
    return await e.save();
  }
  async createEventoWithCreator(input: {
    name: string;
    address?: string;
    lat?: number | string;
    lng?: number | string;
    schedule?: string | Date | null;
    participantes?: string[];
    creador: string;
  }) {
    const uniqueIds = new Set<string>([
      input.creador,
      ...(input.participantes || []),
    ].filter(Boolean));

    const participantes = Array.from(uniqueIds).map(
      (id) => new Types.ObjectId(id)
    );

    const payload: any = {
      name: input.name.trim(),
      address: input.address || '',
      creador: new Types.ObjectId(input.creador),
      participantes,
    };

    if (input.schedule) {
      const d = new Date(input.schedule as any);
      payload.schedule = isNaN(d.getTime()) ? null : d;
    }

    if (input.lat !== undefined && input.lat !== null && input.lat !== '') {
      const latNum = typeof input.lat === 'string' ? parseFloat(input.lat) : input.lat;
      if (!Number.isNaN(latNum as number)) payload.lat = latNum;
    }

    if (input.lng !== undefined && input.lng !== null && input.lng !== '') {
      const lngNum = typeof input.lng === 'string' ? parseFloat(input.lng) : input.lng;
      if (!Number.isNaN(lngNum as number)) payload.lng = lngNum;
    }

    const created = await Evento.create(payload);

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

   async joinEvento(eventoId: string, userId: string): Promise<IEvento | null> {
    return await Evento.findByIdAndUpdate(
      eventoId,
      { $addToSet: { participantes: userId } },
      { new: true }
    ).populate('creador', 'username gmail');
  }

   async leaveEvento(eventoId: string, userId: string): Promise<IEvento | null> {
    return await Evento.findByIdAndUpdate(
      eventoId,
      { $pull: { participantes: userId } },
      { new: true }
    ).populate('creador', 'username gmail');
  }

  async getEventosByCreador(creadorId: string): Promise<IEvento[]> {
    return await Evento.find({ creador: creadorId }).populate('creador', 'username gmail');
  }

  async getEventosWithinBounds(
    north: number,
    south: number,
    east: number,
    west: number,
    page: number,
    limit: number
  ): Promise<{ data: IEvento[]; page: number; totalPages: number; totalItems: number }> {
    const now = new Date();
    const filter: any = {
      lat: { $gte: south, $lte: north },
      lng: { $gte: west, $lte: east },
      schedule: { $gte: now } // Solo eventos futuros
    };

    const skip = (page - 1) * limit;

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(filter),
      Evento.find(filter)
        .sort({ schedule: 1 }) // Ordenar por fecha
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
    address: string
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
        }
      );

      const data = resp.data;
      if (!Array.isArray(data) || data.length === 0) {
        logger.warn(`[EventoService] Geocoding sin resultados para:, ${address}`);
        return null;
      }

      const first = data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);

      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        logger.warn(`[EventoService] Geocoding: lat/lon inválidos para: ${address}`);
        return null;
      }

      return { lat, lng: lon };
    } catch (err) {
      logger.error(`[EventoService] Error geocodificando dirección (Nominatim): ${err}`);
      return null;
    }
  }

  // ==================== MÉTODOS DE EVENTOS PRIVADOS ====================

  /**
   * Invitar usuarios a un evento privado
   */
  async inviteUsersToEvent(eventoId: string, userIds: string[]): Promise<IEvento | null> {
    const evento = await Evento.findById(eventoId);
    if (!evento) return null;

    const objectIds = userIds.map(id => new Types.ObjectId(id));
    
    return await Evento.findByIdAndUpdate(
      eventoId,
      { $addToSet: { invitacionesPendientes: { $each: objectIds } } },
      { new: true }
    ).populate('creador', 'username gmail')
     .populate('invitados', 'username gmail')
     .populate('invitacionesPendientes', 'username gmail');
  }

  /**
   * Aceptar invitación a un evento privado
   */
  async acceptInvitation(eventoId: string, userId: string): Promise<IEvento | null> {
    const userObjectId = new Types.ObjectId(userId);
    
    const evento = await Evento.findByIdAndUpdate(
      eventoId,
      {
        $pull: { invitacionesPendientes: userObjectId },
        $addToSet: { 
          invitados: userObjectId,
          participantes: userObjectId
        }
      },
      { new: true }
    ).populate('creador', 'username gmail')
     .populate('invitados', 'username gmail')
     .populate('participantes', 'username gmail');

    return evento;
  }

  /**
   * Rechazar invitación a un evento privado
   */
  async rejectInvitation(eventoId: string, userId: string): Promise<IEvento | null> {
    const userObjectId = new Types.ObjectId(userId);
    
    return await Evento.findByIdAndUpdate(
      eventoId,
      { $pull: { invitacionesPendientes: userObjectId } },
      { new: true }
    ).populate('creador', 'username gmail');
  }

  /**
   * Obtener invitaciones pendientes de un usuario
   */
  async getPendingInvitations(userId: string): Promise<IEvento[]> {
    const userObjectId = new Types.ObjectId(userId);
    
    return await Evento.find({
      invitacionesPendientes: userObjectId,
      schedule: { $gte: new Date() }
    })
    .populate('creador', 'username gmail')
    .populate('participantes', 'username gmail')
    .sort({ schedule: 1 });
  }

  /**
   * Eliminar invitado de un evento privado (solo creador)
   */
  async removeInvitedUser(eventoId: string, userId: string): Promise<IEvento | null> {
    const userObjectId = new Types.ObjectId(userId);
    
    return await Evento.findByIdAndUpdate(
      eventoId,
      { 
        $pull: { 
          invitados: userObjectId,
          invitacionesPendientes: userObjectId,
          participantes: userObjectId
        } 
      },
      { new: true }
    ).populate('creador', 'username gmail')
     .populate('invitados', 'username gmail')
     .populate('participantes', 'username gmail');
  }

  /**
   * Obtener eventos visibles para un usuario (públicos + privados donde está invitado)
   */
  async getEventosVisiblesParaUsuario(userId: string): Promise<IEvento[]> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    return await Evento.find({
      $or: [
        { isPrivate: false },
        { creador: userObjectId },
        { invitados: userObjectId },
        { invitacionesPendientes: userObjectId },
        { participantes: userObjectId }
      ],
      schedule: { $gte: now }
    })
    .populate('creador', 'username gmail')
    .populate('participantes', 'username gmail')
    .sort({ schedule: 1 });
  }
}