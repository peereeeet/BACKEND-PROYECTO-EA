import { Schema, model, Types, Document } from 'mongoose';

export interface INotificacion extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'friend_request' | 'friend_accepted' | 'event_join' | 'event_reminder' | 'new_message';
  title: string;
  message: string;
  relatedUserId?: Types.ObjectId;
  relatedEventId?: Types.ObjectId;
  relatedUsername?: string;
  relatedEventName?: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

const notificacionSchema = new Schema<INotificacion>({
  userId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  type: { 
    type: String, 
    required: true,
    enum: ['friend_request', 'friend_accepted', 'event_join', 'event_reminder', 'new_message'],
    index: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedUserId: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
  relatedEventId: { type: Schema.Types.ObjectId, ref: 'Evento', default: null },
  relatedUsername: { type: String, default: null },
  relatedEventName: { type: String, default: null },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  actionUrl: { type: String, default: null }
}, {
  timestamps: false,
  versionKey: false
});

notificacionSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notificacion = model<INotificacion>('Notificacion', notificacionSchema);
export default Notificacion;