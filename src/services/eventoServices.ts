import { Evento, IEvento } from '../models/evento';
import { Types } from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger';
import gamificacionService from './gamificacionServices';

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
    const evento = await e.save();

    if (data.creador) {
      try {
        await gamificacionService.otorgarPuntos(data.creador.toString(), 'crearEvento');
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

  async joinEvento(eventoId: string, userId: string): Promise<IEvento | null> {
    const evento = await Evento.findByIdAndUpdate(
      eventoId,
      { $addToSet: { participantes: userId } },
      { new: true }
    ).populate('creador', 'username gmail');

    if (evento) {
      try {
        await gamificacionService.otorgarPuntos(userId, 'unirseEvento');
      } catch (err) {
        logger.error(`Error al otorgar puntos por unirse a evento: ${err}`);
      }
    }

    return evento;
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
      schedule: { $gte: now }
    };

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
}