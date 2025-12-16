import { Schema, model, Types, Document } from 'mongoose';

export interface IInsignia extends Document {
  _id: Types.ObjectId;
  codigo: string;
  nombre: string;
  descripcion: string;
  icono?: string;
  puntos: number;
  criterios: {
    eventosCreadosRequeridos?: number;
    eventosUnidosRequeridos?: number;
    valoracionesRequeridas?: number;
    amigosRequeridos?: number;
    puntosRequeridos?: number;
  };
}

const insigniaSchema = new Schema<IInsignia>({
  codigo: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  icono: { type: String, default: '🏆' },
  puntos: { type: Number, default: 0 },
  criterios: {
    eventosCreadosRequeridos: { type: Number },
    eventosUnidosRequeridos: { type: Number },
    valoracionesRequeridas: { type: Number },
    amigosRequeridos: { type: Number },
    puntosRequeridos: { type: Number }
  }
}, { timestamps: false, versionKey: false });

export const Insignia = model<IInsignia>('Insignia', insigniaSchema);
export default Insignia;