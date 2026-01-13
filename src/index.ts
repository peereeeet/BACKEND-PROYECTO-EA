import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import usuarioRoutes from './routes/usuarioRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import eventoRoutes from './routes/eventoRoutes';
import valoracionRoutes from './routes/valoracionRoutes';
import gamificacionRoutes from './routes/gamificacionRoutes';
import gamificacionService from './services/gamificacionServices';
import aiRoutes from './routes/aiRoutes';
import { UserService } from './services/usuarioServices';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './config/logger';
import { ProfanityFilter } from './profanityFilter';

// ----------- APP & SERVER ----------- //
const app = express();
const PORT = process.env.PORT || 3000;
const usuarioServices = new UserService();
const httpServer = createServer(app);

// ----------- MIDDLEWARES ----------- //
const allowedOrigins = [
  'https://ea2.upc.edu',
  'https://ea2-api.upc.edu',
  'http://localhost:4200',
  'http://localhost:8080',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'Origen CORS no permitido');
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

app.use(express.json());

// ----------- SWAGGER ----------- //
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ----------- ROUTES ----------- //
app.use('/api/user', usuarioRoutes);
app.use('/api/event', eventoRoutes);
app.use('/api/ratings', valoracionRoutes);
app.use('/api/gamificacion', gamificacionRoutes);
app.use('/api/ai', aiRoutes);

// ----------- DATABASE ----------- //
const mongoURL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/BBDD';

mongoose
  .connect(mongoURL)
  .then(async () => {
    logger.info({ url: mongoURL }, 'MongoDB conectado correctamente');

    await usuarioServices.createAdminUser();
    await gamificacionService.inicializarInsignias();

    httpServer.listen(PORT, '0.0.0.0' as any, () => {
      logger.info(`Backend escuchando en http://0.0.0.0:${PORT}`);
      logger.info(`Swagger en http://0.0.0.0:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    logger.error({ error: err }, 'Error al conectar a MongoDB');
  });

// ----------- SOCKET.IO ----------- //
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

////////////////////// SOCKET.IO: ONLINE / OFFLINE //////////////////////
function getChatRoomId(a: string, b: string): string {
  return [a, b].sort().join(':');
}

function getEventRoomId(eventId: string): string {
  return `event:${eventId}`;
}

interface SocketData {
  userId?: string;
}

io.on('connection', (socket) => {
  logger.info(`✅ Cliente conectado ${socket.id}`);

  socket.on('user:online', async (userId: string) => {
    try {
      if (!userId) return;
      const data = socket.data as SocketData;
      data.userId = userId;
      socket.join(`user:${userId}`);
      await usuarioServices.setUserOnline(userId);
      io.emit('user:online', { userId });
      logger.info(`🟢 Usuario online: ${userId}`);
    } catch (err) {
      logger.error(`Error en user:online: ${err}`);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const data = socket.data as SocketData;
      const userId = data.userId;
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
      logger.error(`Error en chat:join: ${err}`);
    }
  });

  socket.on('chat:message', async ({ from, to, text }) => {
    try {
      if (!from || !to || !text?.trim()) return;
      const profanityResult = ProfanityFilter.check(text);
      if (!profanityResult.isClean) {
        socket.emit('chat:error', {
          message: ProfanityFilter.getErrorMessage(
            profanityResult.foundWords,
            'es',
          ),
          code: 'INAPPROPRIATE_CONTENT',
        });
        return;
      }
      const msg = await usuarioServices.addChatMessage(from, to, text.trim());
      const roomId = getChatRoomId(from, to);
      io.to(roomId).emit('chat:message', msg);
    } catch (err) {
      logger.error(`Error en chat:message: ${err}`);
    }
  });

  socket.on('eventChat:join', ({ eventId }) => {
    if (!eventId) return;
    socket.join(getEventRoomId(eventId));
  });

  socket.on(
    'eventChat:message',
    async ({ eventId, userId, username, text }) => {
      try {
        if (!eventId || !userId || !username || !text?.trim()) return;
        const profanityResult = ProfanityFilter.check(text);
        if (!profanityResult.isClean) {
          socket.emit('chat:error', {
            message: ProfanityFilter.getErrorMessage(
              profanityResult.foundWords,
              'es',
            ),
            code: 'INAPPROPRIATE_CONTENT',
          });
          return;
        }
        const msg = await usuarioServices.addEventChatMessage(
          eventId,
          userId,
          username,
          text.trim(),
        );
        io.to(getEventRoomId(eventId)).emit('eventChat:message', msg);
      } catch (err) {
        logger.error(`Error en eventChat:message: ${err}`);
      }
    },
  );
});

export { io };
