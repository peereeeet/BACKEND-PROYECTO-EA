import OpenAI from 'openai';
import { logger } from '../config/logger';

const languageInstructions: Record<string, string> = {
  'es': 'Responde SIEMPRE en español',
  'en': 'Respond ALWAYS in English',
  'cat': 'Respon SEMPRE en català',
  'fr': 'Réponds TOUJOURS en français'
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
    language: string = 'es'
  ): Promise<{ answer: string; relatedEventIds: string[] }> {
    logger.info(`AI Service: Preguntando con contexto de ${events.length} eventos para usuario: ${userId} en idioma: ${language}`);
    
    const eventsContext = JSON.stringify(events.map(e => ({
      id: e._id.toString(),
      name: e.name,
      categoria: e.categoria,
      address: e.address,
      schedule: e.schedule,
      participantesCount: e.participantes?.length || 0,
      isUserParticipating: userId ? e.participantes?.some((p: any) => p._id ? p._id.toString() === userId : p.toString() === userId) : false
    })), null, 2);

    const langInstruction = languageInstructions[language] || languageInstructions['es'];

    const systemPrompt = `
      You are an expert event assistant. The user will ask you questions about available events.
      I will provide you with a list of events in JSON format.
      
      IMPORTANT LANGUAGE INSTRUCTION:
      ${langInstruction}
      
      Instructions:
      1. Use ONLY the information provided to respond.
      2. If the user is already registered for an event (isUserParticipating: true), take that into account in your response.
      3. ALWAYS respond in JSON format with the following structure:
         {
           "answer": "Your friendly and concise answer here IN THE SPECIFIED LANGUAGE",
           "relatedEventIds": ["id1", "id2"] // The IDs of events that are relevant to the answer
         }
      4. Do not include markdown (like \`\`\`json) in your response, just the pure JSON object.
      5. The "answer" field MUST be in the language specified above (${language}).

      Available events:
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
      
      const errorMessages: Record<string, string> = {
        'es': 'Error al procesar la respuesta con IA.',
        'en': 'Error processing the response with AI.',
        'cat': 'Error al processar la resposta amb IA.',
        'fr': 'Erreur lors du traitement de la réponse avec l\'IA.'
      };
      
      return { 
        answer: errorMessages[language] || errorMessages['es'], 
        relatedEventIds: [] 
      };
    }
  }
}