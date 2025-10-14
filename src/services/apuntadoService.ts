import Apuntado, { IApuntado } from "../models/apuntado";
import { FilterQuery } from "mongoose";


// Añadir un nuevo usuario a un evento
export const addApuntado = async (userId: string, eventoId: string) => {
  const apuntado = new Apuntado({ userId, eventoId });
  return await apuntado.save();
};

// Quitar un usuario de un evento
export const removeApuntado = async (userId: string, eventoId: string) => {
  return await Apuntado.findOneAndDelete({ userId, eventoId });
};

// Listar todos los usuarios apuntados a un evento
export const getApuntadosByEvento = async (eventoId: string) => {
  return await Apuntado.find({ eventoId }).populate('userId');
};

// Listar todos los eventos a los que un usuario está apuntado 
export const getEventosByUser = async (userId: string) => {
  return await Apuntado.find({ userId }).populate('eventoId');
};

// Listar todos los apuntados (populate user y evento)
export const getAllApuntados = async () => {
  return await Apuntado.find({}).populate('userId').populate('eventoId');
};

// >>> Paginación <<<
export async function listApuntadosService(
  { userId, eventoId }: { userId?: string; eventoId?: string },
  { page = 1, limit = 10, sort = "-createdAt" }: { page?: number; limit?: number; sort?: string }
) {
  const q: FilterQuery<IApuntado> = {};
  if (userId) q.userId = userId as any;
  if (eventoId) q.eventoId = eventoId as any;

  // Si tu modelo NO exporta PaginateModel tipado, castea como any:
  return (Apuntado as any).paginate(q, {
    page,
    limit,
    sort,
    populate: [
      { path: "userId", select: "_id nombre email" },
      { path: "eventoId", select: "_id titulo fecha" },
    ],
    lean: true,
  });
}