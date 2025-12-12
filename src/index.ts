import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import cors from 'cors';
import usuarioRoutes from './routes/usuarioRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import eventoRoutes from './routes/eventoRoutes';
import { UserService } from './services/usuarioServices';
import valoracionRoutes from './routes/valoracionRoutes';
import aiRoutes from './routes/aiRoutes';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {logger } from './config/logger';

const app = express();
const PORT = 3000;
const usuarioServices = new UserService();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

////////////////////// MIDDLEWARE CORS + JSON //////////////////////
app.use(cors());
app.use(express.json());
app.use(express.json() as express.RequestHandler);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// RUTAS REST
app.use('/api/user', usuarioRoutes);
app.use('/api/event', eventoRoutes);
app.use('/api/ratings', valoracionRoutes);
app.use('/api/ai', aiRoutes);

////////////////////// CONEXIÓN A BBDD //////////////////////
mongoose
  .connect('mongodb://localhost:27017/BBDD')
  .then(async () => {
    logger.info('CONEXION EXITOSA A LA BASE DE DATOS DE MONGODB');

    await usuarioServices.createAdminUser();

    httpServer.listen(PORT, () => {
      logger.info(`URL DEL SERVIDOR http://localhost:${PORT}`);
      logger.info(`Swagger docs en http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    logger.error('HAY ALGUN ERROR CON LA CONEXION', err);
  });

////////////////////// SOCKET.IO: ONLINE / OFFLINE //////////////////////
function getChatRoomId(a: string, b: string): string {
  return [a, b].sort().join(':');
}
io.on('connection', (socket) => {
  logger.info(` Cliente conectado ${socket.id}`);
  socket.on('user:online', async (userId: string) => {
    try {
      if (!userId) return;

      (socket.data as any).userId = userId;
      socket.join(`user: ${userId}`);

      await usuarioServices.setUserOnline(userId);

      io.emit('user:online', { userId });
      logger.info(`Usuario online: ${userId}`);
    } catch (err) {
      logger.error(`Error en user:online: ${err}`);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const userId = (socket.data as any).userId;
      if (!userId) return;

      await usuarioServices.setUserOffline(userId);
      io.emit('user:offline', { userId });
      logger.info(`Usuario offline (disconnect): ${userId}`);
    } catch (err) {
      logger.error(`Error al marcar offline en disconnect:, ${err}`);
    }
  });

  socket.on('chat:join', (payload: { userId: string; friendId: string }) => {
    try {
      if (!payload?.userId || !payload?.friendId) return;
      const roomId = getChatRoomId(payload.userId, payload.friendId);
      socket.join(roomId);
    } catch (err) {
      logger.error(`Error en chat:join: ${err}`);
    }
  });

  socket.on('chat:message', async (payload: { from: string; to: string; text: string }) => {
    try {
      const { from, to, text } = payload;
      if (!from || !to || !text || !text.trim()) return;

      const msg = await usuarioServices.addChatMessage(from, to, text.trim());
      const roomId = getChatRoomId(from, to);
      io.to(roomId).emit('chat:message', {
        _id: msg._id,
        from: msg.from,
        to: msg.to,
        text: msg.text,
        createdAt: msg.createdAt
      });
    } catch (err) {
      logger.error(`Error en chat:message: ${err}`);
    }
  });

  function getEventRoomId(eventId: string): string {
    return `event:${eventId}`;
  }

  socket.on('eventChat:join', (payload: { eventId: string }) => {
    try {
      if (!payload?.eventId) return;
      const roomId = getEventRoomId(payload.eventId);
      socket.join(roomId);
    } catch (err) {
      logger.error(`Error en eventChat:join: ${err}`);
    }
  });

  socket.on(
    'eventChat:message',
    async (payload: {
      eventId: string;
      userId: string;
      username: string;
      text: string;
    }) => {
      try {
        const { eventId, userId, username, text } = payload;
        if (!eventId || !userId || !username || !text || !text.trim()) return;

        const msg = await usuarioServices.addEventChatMessage(
          eventId,
          userId,
          username,
          text.trim()
        );

        const roomId = getEventRoomId(eventId);

        io.to(roomId).emit('eventChat:message', {
          _id: msg._id,
          eventId: msg.eventId,
          userId: msg.userId,
          username: msg.username,
          text: msg.text,
          createdAt: msg.createdAt
        });
      } catch (err) {
        logger.error(`Error en eventChat:message: ${err}`);
      }
    }
  );
});

export { io };
