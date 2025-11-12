import { Evento, IEvento } from '../models/evento';
import { Types } from 'mongoose';

export class EventoService {
  async createEvento(data: Partial<IEvento>): Promise<IEvento> {
    const e = new Evento(data);
    return await e.save();
  }
  async createEventoWithCreator(input: {
    name: string;
    address?: string;
    schedule?: string | Date | null;
    participantes?: string[];
    creador: string;
  }) {
    const participantes = Array.from(
      new Set((input.participantes || []).filter(Boolean))
    ).map((id) => new Types.ObjectId(id));

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
}