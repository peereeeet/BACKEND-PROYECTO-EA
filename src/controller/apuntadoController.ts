import { Request, Response } from "express";
import Apuntado from "../models/apuntado";
import {
  addApuntado,
  removeApuntado,
  getApuntadosByEvento,
  getEventosByUser,
  getAllApuntados,
}  from '../services/apuntadoService';

export const addApuntadoHandler = async (req: Request, res: Response) => {
  try {
    const { userId, eventoId } = req.body;
    const data = await addApuntado(userId, eventoId);
    return res.status(201).json(data);
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "El usuario ya está apuntado a ese evento" });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const listarApuntados = async (req: Request, res: Response) => {
  try {
    const page = Math.max(
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
      1
    );
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit ?? "10"), 10) || 10, 1),
      100
    );
    const sort = String(req.query.sort ?? "-createdAt"); // admite "createdAt" o "-createdAt"

    // Filtros opcionales
    const filter: Record<string, any> = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.eventoId) filter.eventoId = req.query.eventoId;

    const opciones = {
      page,
      limit,
      sort,
      populate: [
        { path: "userId", select: "_id nombre email" },
        { path: "eventoId", select: "_id titulo fecha" },
      ],
      lean: true,
    };

    const resultado = await (Apuntado as any).paginate(filter, opciones);
    return res.json(resultado);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Error al obtener los apuntados" });
  }
};

export const removeApuntadoHandler = async (req: Request, res: Response) => {
  try {
    const { userId, eventoId } = req.body;
    const deleted = await removeApuntado(userId, eventoId);
    // asumiendo que tu service devuelve el doc borrado o null
    if (!deleted) return res.status(404).json({ message: "No encontrado" });
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getApuntadosByEventoHandler = async (req: Request, res: Response) => {
  try {
    const { eventoId } = req.params;
    const data = await getApuntadosByEvento(eventoId);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEventosByUserHandler = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const data = await getEventosByUser(userId);
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllApuntadosHandler = async (_req: Request, res: Response) => {
  try {
    const data = await getAllApuntados();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
