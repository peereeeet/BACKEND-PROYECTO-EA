import OpenAI from 'openai';
import { logger } from '../config/logger';

export class AiServices {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async askWithContext(userPrompt: string, events: any[], userId?: string): Promise<{ answer: string; relatedEventIds: string[] }> {
    logger.info(`AI Service: Preguntando con contexto de ${events.length} eventos para usuario: ${userId}`);
    
    // Simplificamos los datos para la IA e incluimos si el usuario ya participa
    const eventsContext = JSON.stringify(events.map(e => ({
      id: e._id.toString(),
      name: e.name,
      categoria: e.categoria,
      address: e.address,
      schedule: e.schedule,
      participantesCount: e.participantes?.length || 0,
      isUserParticipating: userId ? e.participantes?.some((p: any) => p._id ? p._id.toString() === userId : p.toString() === userId) : false
    })), null, 2);

    const systemPrompt = `
      Eres un asistente experto en eventos. El usuario te hará preguntas sobre los eventos disponibles.
      Te proporcionaré una lista de eventos en formato JSON.
      
      Instrucciones:
      1. Usa SOLAMENTE la información proporcionada para responder.
      2. Si el usuario ya está apuntado a un evento (isUserParticipating: true), tenlo en cuenta en tu respuesta.
      3. Responde SIEMPRE en formato JSON con la siguiente estructura:
         {
           "answer": "Tu respuesta amable y concisa aquí",
           "relatedEventIds": ["id1", "id2"] // Los IDs de los eventos que son relevantes para la respuesta
         }
      4. No incluyas markdown (como \`\`\`json) en tu respuesta, solo el objeto JSON puro.

      Eventos actuales:
      ${eventsContext}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message?.content || "";
      try {
        // Limpiamos posibles bloques de markdown si la IA los pone por error
        const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedContent);
      } catch (e) {
        logger.error(`Error parseando respuesta JSON de IA: ${content}`);
        return { 
          answer: content, 
          relatedEventIds: [] 
        };
      }
    } catch (error) {
      logger.error(`Error en askWithContext: ${error}`);
      return { 
        answer: "Error al processar la resposta amb IA.", 
        relatedEventIds: [] 
      };
    }
  }
}