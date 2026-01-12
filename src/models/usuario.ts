import { Schema, model, Types, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUsuario {
  _id: Types.ObjectId;
  username: string;
  gmail: string;
  password?: string;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  birthday?: Date;
  eventos: Types.ObjectId[];
  rol: 'admin' | 'usuario';
  friends: Types.ObjectId[];
  friendRequest: Types.ObjectId[];
  sentRequests: Types.ObjectId[];
  online?: boolean;
  lastSeen?: Date;
  profilePhoto?: string; // ← NUEVA: URL de la foto de perfil
  comparePassword(candidatePassword: string): Promise<boolean>;
  isModified(path: string): boolean;
  isActive: boolean;
  isGoogleUser?: boolean;
  googleId?: string | null;
  blockedUsers: Types.ObjectId[];
}

const usuarioSchema = new Schema<IUsuario>(
  {
    username: { type: String, required: true, unique: true },
    gmail: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function () {
        return !(this as any).isGoogleUser;
      },
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    birthday: {
      type: Date,
      required: function () {
        return !(this as any).isGoogleUser;
      },
    },
    isActive: { type: Boolean, default: true },
    isGoogleUser: { type: Boolean, default: false },
    googleId: { type: String, default: null },
    profilePhoto: { type: String, default: null }, // ← NUEVA: Campo para foto de perfil
    friends: [{ type: Schema.Types.ObjectId, ref: 'Usuario', index: true }],
    friendRequest: [
      { type: Schema.Types.ObjectId, ref: 'Usuario', index: true },
    ],
    sentRequests: [
      { type: Schema.Types.ObjectId, ref: 'Usuario', index: true },
    ],
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    eventos: [{ type: Schema.Types.ObjectId, ref: 'Evento', default: [] }],
    blockedUsers: [
      { type: Schema.Types.ObjectId, ref: 'Usuario', default: [] },
    ],
    rol: { type: String, enum: ['admin', 'usuario'], default: 'usuario' },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

usuarioSchema.index({ username: 'text', gmail: 'text' });

usuarioSchema.pre<IUsuario>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  if (!this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err as any);
  }
});

usuarioSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  const password = (this as any).password;
  if (!password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, password);
};

export interface IChatMessage extends Document {
  from: string;
  to: string;
  text: string;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
  from: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export interface IEventChatMessage extends Document {
  eventId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: Date;
}

const eventChatMessageSchema = new Schema<IEventChatMessage>({
  eventId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Usuario = model<IUsuario>('Usuario', usuarioSchema);
export default Usuario;
export const ChatMessageModel = model<IChatMessage>(
  'ChatMessage',
  chatMessageSchema,
);
export const EventChatMessageModel = model<IEventChatMessage>(
  'EventChatMessage',
  eventChatMessageSchema,
);
