import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import usuarioRoutes from './routes/usuarioRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import eventoRoutes from './routes/eventoRoutes';
import valoracionRoutes from './routes/valoracionRoutes';
import { UserService } from './services/usuarioServices';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './config/logger';

// ----------- APP & SERVER ----------- //
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// ----------- MIDDLEWARES ----------- //
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:8080',
    'https://ea2.upc.edu',     // Front producción
    'https://ea2-api.upc.edu' // Back producción
  ],
  credentials: true,
}));

app.use(express.json());

// ----------- SWAGGER ----------- //
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ----------- DATABASE ----------- //
const mongoURL = process.env.MONGO_URL || "mongodb://mongo:27017/BBDD";
const usuarioServices = new UserService();

// Crear servidor HTTP conjunto (API + WebSockets)
const httpServer = createServer(app);

// Conectar a MongoDB y arrancar el servidor
mongoose
  .connect(mongoURL)
  .then(async () => {
    logger.info({ url: mongoURL }, 'MongoDB conectado correctamente');

    await usuarioServices.createAdminUser();

    httpServer.listen(PORT, () => {
      logger.info(`Backend escuchando en http://localhost:${PORT}`);
      logger.info(`Swagger en http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    logger.error({ error: err }, 'Error al conectar a MongoDB');
  });

// ----------- ROUTES ----------- //
app.use('/api/user', usuarioRoutes);
app.use('/api/event', eventoRoutes);
app.use('/api/ratings', valoracionRoutes);

// ----------- SOCKET.IO ----------- //
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      'http://localhost:4200',
      'https://ea2.upc.edu'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Utilidades
function getChatRoomId(a: string, b: string): string {
  return [a, b].sort().join(':');
}
function getEventRoomId(eventId: string): string {
  return `event:${eventId}`;
}

// Handlers de WebSockets
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, '🔌 Cliente conectado');

  socket.on('user:online', async (userId: string) => {
    try {
      if (!userId) return;

      (socket.data as any).userId = userId;
      socket.join(`user:${userId}`);

      await usuarioServices.setUserOnline(userId);

      io.emit('user:online', { userId });
      logger.info({ userId }, '🟢 Usuario online');
    } catch (err) {
      logger.error({ error: err }, 'Error en user:online');
    }
  });

  socket.on('disconnect', async () => {
    try {
      const userId = (socket.data as any).userId;
      if (!userId) return;

      await usuarioServices.setUserOffline(userId);
      io.emit('user:offline', { userId });
      logger.info({ userId }, '🔴 Usuario offline');
    } catch (err) {
      logger.error({ error: err }, 'Error al desconectar usuario');
    }
  });

  socket.on('chat:join', ({ userId, friendId }) => {
    try {
      if (!userId || !friendId) return;
      socket.join(getChatRoomId(userId, friendId));
    } catch (err) {
      logger.error({ error: err }, 'Error en chat:join');
    }
  });

  socket.on('chat:message', async ({ from, to, text }) => {
    try {
      if (!from || !to || !text?.trim()) return;

      const msg = await usuarioServices.addChatMessage(from, to, text.trim());
      const roomId = getChatRoomId(from, to);

      io.to(roomId).emit('chat:message', msg);
    } catch (err) {
      logger.error({ error: err }, 'Error en chat:message');
    }
  });

  socket.on('eventChat:join', ({ eventId }) => {
    if (!eventId) return;
    socket.join(getEventRoomId(eventId));
  });

  socket.on('eventChat:message', async ({ eventId, userId, username, text }) => {
    try {
      if (!eventId || !userId || !username || !text?.trim()) return;

      const msg = await usuarioServices.addEventChatMessage(
        eventId, userId, username, text.trim()
      );

      io.to(getEventRoomId(eventId)).emit('eventChat:message', msg);
    } catch (err) {
      logger.error({ error: err }, 'Error en eventChat:message');
    }
  });
});

export { io };
