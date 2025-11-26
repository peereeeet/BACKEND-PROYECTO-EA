import { Schema, model, Types, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUsuario {
  _id: Types.ObjectId;
  username: string;
  gmail: string;
  password: string;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  birthday: Date;
  eventos: Types.ObjectId[];
  rol: 'admin' | 'usuario';
  friends: Types.ObjectId[];
  friendRequest: Types.ObjectId[];
  sentRequests: Types.ObjectId[];
  online?: boolean;
  lastSeen?: Date; 
  comparePassword(candidatePassword: string): Promise<boolean>;
  isModified(path: string): boolean;
  isActive: boolean;
}

const usuarioSchema = new Schema<IUsuario>({
  username: { type: String, required: true, unique: true },
  gmail: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  birthday: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  friends: [{ type: Schema.Types.ObjectId, ref: 'Usuario', index: true }],
  friendRequest: [{type: Schema.Types.ObjectId, ref: 'Usuario', index: true}],
  sentRequests: [{type: Schema.Types.ObjectId, ref: 'Usuario', index: true}],
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  eventos: [{ type: Schema.Types.ObjectId, ref: 'Evento', default: [] }],
  rol: { type: String, enum: ['admin', 'usuario'], default: 'usuario' }
}, {
  timestamps: false,
  versionKey: false
});

usuarioSchema.index({ username: 'text', gmail: 'text' });

usuarioSchema.pre<IUsuario>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt();
  const hash = await bcrypt.hash(this.password, salt);
  this.password = hash;
  next();
});

usuarioSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

export interface IChatMessage extends Document {
  from: string;
  to: string;
  text: string;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
  from: { type: String, required: true },
  to:   { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Usuario = model<IUsuario>('Usuario', usuarioSchema);
export default Usuario;
export const ChatMessageModel = model<IChatMessage>('ChatMessage', chatMessageSchema);
