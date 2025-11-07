import { Request, Response } from 'express';
import { EventoService } from '../services/eventoServices';
import { Usuario } from '../models/usuario';
import { Evento } from '../models/evento';
import {logger} from '../config/logger';

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

export async function createEvento(req: Request, res: Response): Promise<Response> {
  try {
    const { name, schedule, address, participantes } = req.body;
    const scheduleStr = normalizeSchedule(schedule);
    const participantesIds = normalizeParticipantes(participantes);

    const created = await eventoService.createEvento({
      name,
      schedule: scheduleStr,
      address,
      participantes: participantesIds as any
    });

    if (participantesIds.length > 0) {
      await Usuario.updateMany(
        { _id: { $in: participantesIds } },
        { $addToSet: { eventos: created._id } }
      ).exec();
    }

    const populated = await Evento.findById(created._id)
      .populate('participantes', 'username gmail')
      .exec();

    return res.status(201).json(populated ?? created);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const getAllEventos = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [total, eventos] = await Promise.all([
      Evento.countDocuments(),
      Evento.find().skip(skip).limit(limit).populate('participantes')
    ]);

    res.status(200).json({
      data: eventos,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener eventos', error });
  }
};

export async function getEventoById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const evento = await eventoService.getEventoById(id);
    if (!evento) return res.status(404).json({ message: 'EVENTO NO ENCONTRADO' });
    return res.status(200).json(evento);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export async function deleteEventoById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const toDelete = await Evento.findById(id).lean().exec();
    if (!toDelete) return res.status(404).json({ message: 'EVENTO NO ENCONTRADO' });

    if (Array.isArray(toDelete.participantes) && toDelete.participantes.length > 0) {
      await Usuario.updateMany(
        { _id: { $in: toDelete.participantes } },
        { $pull: { eventos: toDelete._id } }
      ).exec();
    }

    const deleted = await eventoService.deleteEventoById(id);
    return res.status(200).json(deleted);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

export const updateEventoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updatedEvento = await Evento.findByIdAndUpdate(id, req.body, {
      new: true
    }).populate('participantes');

    if (!updatedEvento) {
      res.status(404).json({ message: 'Evento no encontrado' });
      return;
    }

    res.status(200).json(updatedEvento);
  } catch (error) {
    logger.error(`Error al actualizar evento:, ${error}`);
    res.status(500).json({ message: 'Error al actualizar evento', error });
  }
};

export const checkEventNameExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({
        exists: false,
        message: "El campo 'name' es obligatorio"
      });
      return;
    }

    const existingEvent = await Evento.findOne({ name });
    if (existingEvent) {
      res.status(200).json({
        exists: true,
        message: 'Ya existe un evento con este título'
      });
      return;
    }

    res.status(200).json({
      exists: false,
      message: 'El título está disponible'
    });
  } catch (error) {
    res.status(500).json({
      exists: false,
      error: 'Error al verificar el título del evento',
      details: error instanceof Error ? error.message : error
    });
  }
};