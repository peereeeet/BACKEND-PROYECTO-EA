import { Schema, model, Types, Document } from 'mongoose';

export interface IUsuarioProgreso extends Document {
  _id: Types.ObjectId;
  usuario: Types.ObjectId;
  puntos: number;
  nivel: string;
  insignias: Types.ObjectId[];
  estadisticas: {
    eventosCreadosTotal: number;
    eventosUnidosTotal: number;
    valoracionesTotal: number;
    amigosTotal: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const usuarioProgresoSchema = new Schema<IUsuarioProgreso>({
  usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true, index: true },
  puntos: { type: Number, default: 0 },
  nivel: { 
    type: String, 
    enum: ['Novato', 'Explorador', 'Organizador', 'Experto', 'Leyenda'], 
    default: 'Novato' 
  },
  insignias: [{ type: Schema.Types.ObjectId, ref: 'Insignia', default: [] }],
  estadisticas: {
    eventosCreadosTotal: { type: Number, default: 0 },
    eventosUnidosTotal: { type: Number, default: 0 },
    valoracionesTotal: { type: Number, default: 0 },
    amigosTotal: { type: Number, default: 0 }
  }
}, { timestamps: true, versionKey: false });

export const UsuarioProgreso = model<IUsuarioProgreso>('UsuarioProgreso', usuarioProgresoSchema);
export default UsuarioProgreso;