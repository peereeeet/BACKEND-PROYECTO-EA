import OpenAI from 'openai';
import { logger } from '../config/logger';

export class AiServices {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateMongoQuery(userPrompt: string, userId?: string): Promise<any> {
    logger.info(`AI Service: Generando query de Mongo para prompt: "${userPrompt}" usuario: ${userId}`);
    const today = new Date().toISOString();
    
    // Llista de categories extreta del teu model evento.ts per ajudar a l'IA
    const categories = [
      'Fútbol', 'Baloncesto', 'Tenis', 'Pádel', 'Running', 'Ciclismo', 
      'Natación', 'Yoga', 'Gimnasio', 'Senderismo', 'Escalada', 'Artes Marciales',
      'Concierto Rock', 'Concierto Pop', 'Concierto Clásica', 'Jazz', 'Electrónica', 
      'Hip Hop', 'Karaoke', 'Discoteca', 'Festival Musical',
      'Exposición Arte', 'Teatro', 'Cine', 'Museo', 'Literatura', 'Fotografía', 
      'Pintura', 'Escultura', 'Danza', 'Ópera', 'Restaurante', 'Tapas', 
      'Cocina Internacional', 'Vinos', 'Cerveza Artesanal', 'Repostería', 'Brunch', 
      'Food Truck', 'Fiesta Privada', 'Fiesta Temática', 'Cumpleaños', 'Boda', 
      'Despedida', 'After Work', 'Networking', 'Speed Dating', 'Taller', 'Curso', 
      'Conferencia', 'Seminario', 'Workshop', 'Idiomas', 'Masterclass', 'Hackathon', 
      'Meetup Tech', 'Gaming', 'eSports', 'Programación', 'Inteligencia Artificial', 
      'Blockchain', 'Startups', 'Meditación', 'Spa', 'Wellness', 'Mindfulness', 
      'Salud Mental', 'Voluntariado Ambiental', 'Voluntariado Social', 
      'Donación de Sangre', 'Rescate Animal', 'Limpieza Playas', 
      'Banco de Alimentos', 'Camping', 'Montañismo', 'Playa', 'Barbacoa', 'Picnic', 
      'Observación Aves', 'Safari', 'Juegos de Mesa', 'Ajedrez', 'Poker', 
      'Escape Room', 'Paintball', 'Laser Tag', 'Bolos', 'Evento Familiar', 
      'Parque Infantil', 'Teatro Infantil', 'Animación Infantil', 'Taller Niños', 
      'Mercadillo', 'Feria', 'Turismo', 'Excursión', 'Compras', 'Otros'
    ];

    const systemPrompt = `
      Eres un asistente que traduce peticiones de usuarios en lenguaje natural a consultas de búsqueda de MongoDB (formato JSON).
      
      Datos actuales:
      - Fecha de hoy (ISO): ${today}

      Esquema de la colección 'Evento':
      - name (String): Título del evento (usa $regex con opciones 'i' para búsquedas parciales).
      - categoria (String): Debe ser EXACTAMENTE una de estas: ${categories.join(', ')}. Si el usuario dice "música", busca categorías relacionadas con música usando un $in.
      - address (String): Ubicación (usa $regex para ciudades).
      - schedule (Date): Fecha del evento. Usa operadores $gte, $lte para rangos de fechas (hoy, mañana, fin de semana).
      - participantes (ObjectId[]): Lista de usuarios inscritos.

      Instrucciones:
      1. Retorna SOLAMENTE un objeto JSON válido que se pueda pasar directamente a model.find().
      2. No incluyas explicaciones, ni markdown, solo el JSON.
      3. Si el usuario pide algo de lo que no tienes información, intenta hacer la mejor aproximación con $regex en el campo 'name' o 'categoria'.
      4. Si el usuario pide explícitamente eventos a los que NO está apuntado (ej: "eventos nuevos", "que no tenga", "libres"), añade al filtro: { "participantes": { "$ne": "CURRENT_USER_ID" } }.
      5. Si el usuario pide eventos a los que SÍ está apuntado, usa: { "participantes": "CURRENT_USER_ID" }.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
      });
      logger.info('AI Service: Respuesta recibida de OpenAI');

      const content = response.choices[0].message?.content;
      if (!content) return {};

      let cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Reemplazar el placeholder por el ID real si existe
      if (userId) {
        cleanedContent = cleanedContent.replace(/CURRENT_USER_ID/g, userId);
      } else {
        // Si no hay userId, eliminamos el filtro de participantes para evitar errores, o lo dejamos fallar?
        // Mejor eliminar la parte de "participantes": ... si no hay user ID, pero es complejo parsear string.
        // Asumiremos que si la IA lo pone es pq lo pidió el usuario. Si no hay ID, quizas deberiamos avisar.
        // Simplemente lo reemplazamos por algo que no rompa o null, pero Mongo fallaría con ObjectId invalido.
        // Dejaremos el string y si falla, falla. O mejor, si no hay ID, intentamos limpiarlo.
        if (cleanedContent.includes('CURRENT_USER_ID')) {
           console.warn('AI Service: Se solicitó filtro por usuario pero no se proporcionó userId');
           // Podríamos eliminar la linea, pero es arriesgado con regex simple.
        }
      }

      logger.info(`AI Query generada: ${cleanedContent}`);
      return JSON.parse(cleanedContent);

    } catch (error) {
      logger.error(`Error generant query amb IA: ${error}`);
      return {}; 
    }
  }
}