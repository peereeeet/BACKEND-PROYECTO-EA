import { Request, Response } from 'express';
import { AiServices } from '../services/aiServices';
import { EventoService } from '../services/eventoServices';
import { logger } from '../config/logger';

const aiService = new AiServices();
const eventoService = new EventoService();

export async function searchEventsWithAi(req: Request, res: Response) {
  try {
    const { query, userId } = req.body;
    logger.info(`AI Controller: Recibida query -> "${query}", userId -> "${userId}"`);

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'La consulta (query) és obligatòria.' });
    }

    const mongoFilter = await aiService.generateMongoQuery(query, userId);


    const events = await eventoService.getEventosByAiFilter(mongoFilter);

    return res.status(200).json({
      originalQuery: query,
      interpretedFilter: mongoFilter,
      count: events.length,
      data: events
    });

  } catch (error) {
    logger.error(`Error al controlador AI Search: ${error}`);
    return res.status(500).json({ message: 'Error processant la cerca intel·ligent.' });
  }
}