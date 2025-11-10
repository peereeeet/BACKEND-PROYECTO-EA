import { Evento, IEvento } from '../models/evento';

export class EventoService {
  async createEvento(data: Partial<IEvento>): Promise<IEvento> {
    const e = new Evento(data);
    return await e.save();
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