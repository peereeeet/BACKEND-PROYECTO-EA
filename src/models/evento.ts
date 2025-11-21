import { Schema, model, Types } from 'mongoose';

export interface IEvento {
  _id: Types.ObjectId;
  name: string;
  schedule: string;
  address?: string;
  participantes: Types.ObjectId[];
  creador: Types.ObjectId;
  categoria: String;
  avgRating?: number;
  ratingsCount?: number;
}

const eventoSchema = new Schema<IEvento>({
  name: { type: String, required: true },
  schedule: { type: String, required: true },
  address: { type: String },
  participantes: [{ type: Schema.Types.ObjectId, ref: 'Usuario', default: [] }],
  creador: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }, 
  categoria:{type:String, enum: ['Deporte', 'Conciertos', 'Arte', 'Fiestas', 'Voluntariado', 'Tech', 'Otros'], required: true, default: 'Otros' },
  avgRating: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 }
}, { timestamps: false, versionKey: false });

export const Evento = model<IEvento>('Evento', eventoSchema);
export default Evento;
