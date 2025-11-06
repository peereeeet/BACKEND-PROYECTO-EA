import { FilterQuery, Types } from 'mongoose';
import { Valoracion, IValoracion } from '../models/valoracion';
import { Evento } from '../models/evento';

export class ValoracionService {
  async createValoracion(eventoId: string, data: { puntuacion: number; comentario?: string }) {
  const doc = await Valoracion.create({
    evento: new Types.ObjectId(eventoId),
    puntuacion: data.puntuacion,
    comentario: data.comentario
  });
  await this.recalcularAggregatesEvento(eventoId);
  return doc;
}

  async updateValoracion(
    id: string,
    data: { puntuacion?: number; comentario?: string }
  ): Promise<IValoracion | null> {
    const doc = await Valoracion.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).exec();
    if (doc) await this.recalcularAggregatesEvento(String(doc.evento));
    return doc;
  }

  async getById(id: string): Promise<IValoracion | null> {
    return await Valoracion.findById(id).exec();
  }

  async listByEvento(
    eventoId: string,
    opts: { page?: number; limit?: number; q?: string }
  ) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(opts.limit) || 10));
    const skip = (page - 1) * limit;

    const filtro: FilterQuery<IValoracion> = { evento: new Types.ObjectId(eventoId) };
    if (opts.q && opts.q.trim()) {
      const rx = new RegExp(opts.q.trim(), 'i');
      (filtro as any).comentario = rx;
    }

    const [data, total] = await Promise.all([
      Valoracion.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Valoracion.countDocuments(filtro).exec()
    ]);

    return {
      data,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      totalItems: total
    };
  }

  async deleteValoracion(id: string): Promise<IValoracion | null> {
    const doc = await Valoracion.findByIdAndDelete(id).exec();
    if (doc) await this.recalcularAggregatesEvento(String(doc.evento));
    return doc;
  }

  async recalcularAggregatesEvento(eventoId: string) {
    const res = await Valoracion.aggregate([
      { $match: { evento: new Types.ObjectId(eventoId) } },
      { $group: { _id: '$evento', avg: { $avg: '$puntuacion' }, count: { $sum: 1 } } }
    ]).exec();

    const avg = res[0]?.avg ?? 0;
    const count = res[0]?.count ?? 0;

    await Evento.findByIdAndUpdate(
      eventoId,
      { $set: { avgRating: avg, ratingsCount: count } },
      { new: false }
    ).exec();
  }
}
