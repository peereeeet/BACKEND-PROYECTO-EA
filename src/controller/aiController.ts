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

    // Obtenim TOTS els esdeveniments per enviar-los com a context a ChatGPT
    const events = await eventoService.getAllEventos();
    
    // Passem la query, els esdeveniments i el userId (si existeix) a la IA
    const aiResult = await aiService.askWithContext(query, events, userId);

    // Filtrem els esdeveniments per retornar només els que la IA considera rellevants
    const relatedEvents = events.filter(e => 
      aiResult.relatedEventIds.includes(e._id.toString())
    );

    return res.status(200).json({
      answer: aiResult.answer,
      count: relatedEvents.length,
      data: relatedEvents 
    });

  } catch (error) {
    logger.error(`Error al controlador AI Search: ${error}`);
    return res.status(500).json({ message: 'Error processant la cerca intel·ligent.' });
  }
}