import mongoose, { Schema, Document } from 'mongoose';
import mongoosePaginate from "mongoose-paginate-v2";


export interface IApuntado extends Document {
  userId: mongoose.Types.ObjectId;
  eventoId: mongoose.Types.ObjectId;
}

const apuntadoSchema = new Schema<IApuntado>(
  {
  userId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    eventoId: { type: Schema.Types.ObjectId, ref: 'Evento', required: true },
  },
  { timestamps: true, versionKey: false }
);
apuntadoSchema.plugin(mongoosePaginate);
apuntadoSchema.index({ userId: 1, eventoId: 1 }, { unique: true });


export default mongoose.model<IApuntado>('Apuntado', apuntadoSchema);
