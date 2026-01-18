import OpenAI from 'openai';
import { logger } from '../config/logger';

const languageInstructions: Record<string, string> = {
  es: 'Responde SIEMPRE en español',
  en: 'Respond ALWAYS in English',
  cat: 'Respon SEMPRE en català',
  fr: 'Réponds TOUJOURS en français',
};

export class AiServices {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async askWithContext(
    userPrompt: string,
    events: any[],
    userId?: string,
    language: string = 'es',
  ): Promise<{ answer: string; relatedEventIds: string[] }> {
    logger.info(
      `AI Service: Preguntando con contexto de ${events.length} eventos para usuario: ${userId} en idioma: ${language}`,
    );

    const eventsContext = JSON.stringify(
      events.map((e) => ({
        id: e._id.toString(),
        name: e.name,
        categoria: e.categoria,
        address: e.address,
        schedule: e.schedule,
        participantesCount: e.participantes?.length || 0,
        maxParticipantes: e.maxParticipantes,
        avgRating: e.avgRating || 0,
        isUserParticipating: userId
          ? e.participantes?.some((p: any) =>
              p._id ? p._id.toString() === userId : p.toString() === userId,
            )
          : false,
      })),
      null,
      2,
    );

    const langInstruction =
      languageInstructions[language] || languageInstructions['es'];
    const nowISO = new Date().toISOString();

    const systemPrompt = `
      Eres un asistente experto en eventos y ocio local. Tu objetivo es ayudar al usuario a descubrir las mejores experiencias basadas en sus preferencias individuales.
      
      CONTEXTO TEMPORAL:
      - Fecha y Hora actual (ISO): ${nowISO} (Usa esto para calcular "hoy", "mañana", "este mes", "el mes que viene", etc.)
      - Idioma preferido: ${language}
      - Instrucción de idioma: ${langInstruction}

      DATOS DE EVENTOS DISPONIBLES (JSON):
      ${eventsContext}

      REGLAS DE RAZONAMIENTO Y RESPUESTA:
      1. ANALIZA LAS FECHAS: Antes de responder, verifica cuidadosamente el campo "schedule" de cada evento. Ejemplos: 
         - Si el usuario pregunta por "el mes que viene" y estamos en Enero, busca ÚNICAMENTE eventos en Febrero.
         - No sugieras eventos de este mes si preguntan por el próximo, ni viceversa.
      2. EXCLUSIVIDAD: Usa EXCLUSIVAMENTE la información proporcionada arriba. No inventes eventos.
      3. PARTICIPACIÓN: Si el usuario ya está participando (isUserParticipating: true), reconócelo y no se lo recomiendes.
      4. TONO: Sé entusiasta pero profesional. Destaca valoraciones altas (avgRating) o plazas limitadas.
      
      FORMATO DE SALIDA (JSON PURO):
      Debes responder ÚNICAMENTE con un objeto JSON (sin bloques markdown):
      {
        "answer": "Tu respuesta amigable en ${language}",
        "relatedEventIds": ["id1", "id2"] // IDs de los eventos que REALMENTE cumplen el criterio
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message?.content || '';
      try {
        const cleanedContent = content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        return JSON.parse(cleanedContent);
      } catch (_e) {
        logger.error(`Error parseando respuesta JSON de IA: ${content}`);
        return {
          answer: content,
          relatedEventIds: [],
        };
      }
    } catch (error) {
      logger.error(`Error en askWithContext: ${error}`);

      const errorMessages: Record<string, string> = {
        es: 'Error al procesar la respuesta con IA.',
        en: 'Error processing the response with AI.',
        cat: 'Error al processar la resposta amb IA.',
        fr: "Erreur lors du traitement de la réponse avec l'IA.",
      };

      return {
        answer: errorMessages[language] || errorMessages['es'],
        relatedEventIds: [],
      };
    }
  }
}
