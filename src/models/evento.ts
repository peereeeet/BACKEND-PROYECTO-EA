import { Schema, model, Types } from 'mongoose';

export interface IEvento {
  _id: Types.ObjectId;
  name: string;
  schedule: Date;
  address?: string;
  lat?: number;
  lng?: number;
  participantes: Types.ObjectId[];
  creador: Types.ObjectId;
  categoria: String;
  avgRating?: number;
  ratingsCount?: number;
  isPrivate: boolean;
  invitados: Types.ObjectId[];
  invitacionesPendientes: Types.ObjectId[];
}

const eventoSchema = new Schema<IEvento>({
  name: { type: String, required: true },
  schedule: { type: Date, required: true },
  address: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  participantes: [{ type: Schema.Types.ObjectId, ref: 'Usuario', default: [] }],
  creador: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }, 
  categoria: {
    type: String, 
    enum: [
      'Fútbol', 'Baloncesto', 'Tenis', 'Pádel', 'Running', 'Ciclismo', 
      'Natación', 'Yoga', 'Gimnasio', 'Senderismo', 'Escalada', 'Artes Marciales',
      'Concierto Rock', 'Concierto Pop', 'Concierto Clásica', 'Jazz', 'Electrónica', 
      'Hip Hop', 'Karaoke', 'Discoteca', 'Festival Musical',
      'Exposición Arte', 'Teatro', 'Cine', 'Museo', 'Literatura', 'Fotografía', 
      'Pintura', 'Escultura', 'Danza', 'Ópera',
      'Restaurante', 'Tapas', 'Cocina Internacional', 'Vinos', 'Cerveza Artesanal', 
      'Repostería', 'Brunch', 'Food Truck',
      'Fiesta Privada', 'Fiesta Temática', 'Cumpleaños', 'Boda', 'Despedida', 
      'After Work', 'Networking', 'Speed Dating',
      'Taller', 'Curso', 'Conferencia', 'Seminario', 'Workshop', 'Idiomas', 'Masterclass',
      'Hackathon', 'Meetup Tech', 'Gaming', 'eSports', 'Programación', 
      'Inteligencia Artificial', 'Blockchain', 'Startups',
      'Meditación', 'Spa', 'Wellness', 'Mindfulness', 'Salud Mental',
      'Voluntariado Ambiental', 'Voluntariado Social', 'Donación de Sangre', 
      'Rescate Animal', 'Limpieza Playas', 'Banco de Alimentos',
      'Camping', 'Montañismo', 'Playa', 'Barbacoa', 'Picnic', 'Observación Aves', 'Safari',
      'Juegos de Mesa', 'Ajedrez', 'Poker', 'Escape Room', 'Paintball', 'Laser Tag', 'Bolos',
      'Evento Familiar', 'Parque Infantil', 'Teatro Infantil', 'Animación Infantil', 'Taller Niños',
      'Mercadillo', 'Feria', 'Turismo', 'Excursión', 'Compras', 'Otros'
    ], 
    required: true, 
    default: 'Otros' 
  },
  avgRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  invitados: [{ type: Schema.Types.ObjectId, ref: 'Usuario', default: [] }],
  invitacionesPendientes: [{ type: Schema.Types.ObjectId, ref: 'Usuario', default: [] }]
}, { timestamps: false, versionKey: false });

export const Evento = model<IEvento>('Evento', eventoSchema);
export default Evento;