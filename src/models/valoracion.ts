import { Schema, model, Types } from 'mongoose';

export interface IValoracion {
  _id: Types.ObjectId;
  evento: Types.ObjectId;
  usuario: Types.ObjectId;
  puntuacion: number;
  comentario?: string;
  createdAt: Date;
  updatedAt: Date;
}

const valoracionSchema = new Schema<IValoracion>(
  {
    evento: {
      type: Schema.Types.ObjectId,
      ref: 'Evento',
      required: true,
      index: true,
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    puntuacion: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false },
);

valoracionSchema.index({ evento: 1, usuario: 1 }, { unique: true });

export const Valoracion = model<IValoracion>('Valoracion', valoracionSchema);
export default Valoracion;
