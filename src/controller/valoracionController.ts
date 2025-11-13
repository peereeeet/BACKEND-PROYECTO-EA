import { Request, Response } from 'express';
import { ValoracionService } from '../services/valoracionServices';

const service = new ValoracionService();

export async function createValoracion(req: Request, res: Response) {
  try {
    const { eventoId } = req.params;
    const { puntuacion, comentario } = req.body;
    if (!eventoId) return res.status(400).json({ message: 'Falta eventoId' });
    if (typeof puntuacion !== 'number' || puntuacion < 1 || puntuacion > 5)
      return res.status(400).json({ message: 'puntuacion debe ser 1..5' });

    const doc = await service.createValoracion(eventoId, { puntuacion, comentario });
    return res.status(201).json(doc);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: 'Conflicto por índice único antiguo (evento/usuario). Elimínalo en MongoDB y reintenta.',
        hint: 'db.valoracions.dropIndex("evento_1_usuario_1")'
      });
    }
    return res.status(500).json({ message: 'Error al guardar la valoración', error: err });
  }
}

export async function updateValoracion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { puntuacion, comentario } = req.body;
    const data: any = {};
    if (typeof puntuacion === 'number') {
      if (puntuacion < 1 || puntuacion > 5) return res.status(400).json({ message: 'puntuacion debe ser 1..5' });
      data.puntuacion = puntuacion;
    }
    if (typeof comentario === 'string') data.comentario = comentario;

    const doc = await service.updateValoracion(id, data);
    if (!doc) return res.status(404).json({ message: 'No encontrada' });
    res.status(200).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar la valoración', error: err });
  }
}

export async function listValoracionesEvento(req: Request, res: Response) {
  try {
    const { eventoId } = req.params;

    const page = parseInt(req.query.page as string) || 1;
    const limit = 6;

    const q = (req.query.q as string) || '';

    const result = await service.listByEvento(eventoId, { page, limit, q });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error cargando valoraciones', error: err });
  }
}

export async function getValoracionById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await service.getById(id);
    if (!doc) return res.status(404).json({ message: 'No encontrada' });
    res.status(200).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener la valoración', error: err });
  }
}

export async function deleteValoracion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await service.deleteValoracion(id);
    if (!doc) return res.status(404).json({ message: 'No encontrada' });
    res.status(200).json({ message: 'Valoración eliminada', id });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la valoración', error: err });
  }
}
