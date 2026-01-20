import { Request, Response } from 'express';
import { AiServices } from '../services/aiServices';
import { EventoService } from '../services/eventoServices';
import { logger } from '../config/logger';

const aiService = new AiServices();
const eventoService = new EventoService();

export async function searchEventsWithAi(req: Request, res: Response) {
  try {
    const { query, userId, language } = req.body;
    logger.info(
      `AI Controller: Recibida query -> "${query}", userId -> "${userId}", language -> "${language}"`,
    );

    if (!query || typeof query !== 'string') {
      return res
        .status(400)
        .json({ message: 'La consulta (query) es obligatoria.' });
    }

    const result = await eventoService.getEventosVisiblesParaUsuario(
      userId,
      1,
      0,
    );
    const events = result.data;

    const aiResult = await aiService.askWithContext(
      query,
      events,
      userId,
      language || 'es',
    );

    const relatedEvents = events.filter((e) =>
      aiResult.relatedEventIds.includes(e._id.toString()),
    );

    return res.status(200).json({
      answer: aiResult.answer,
      count: relatedEvents.length,
      data: relatedEvents,
    });
  } catch (error) {
    logger.error(`Error al controlador AI Search: ${error}`);
    return res
      .status(500)
      .json({ message: 'Error procesando la búsqueda inteligente.' });
  }
}
