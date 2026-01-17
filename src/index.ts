import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import usuarioRoutes from './routes/usuarioRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import eventoRoutes from './routes/eventoRoutes';
import { UserService } from './services/usuarioServices';
import valoracionRoutes from './routes/valoracionRoutes';
import gamificacionRoutes from './routes/gamificacionRoutes';
import gamificacionService from './services/gamificacionServices';
import aiRoutes from './routes/aiRoutes';
import notificacionRoutes from './routes/notificacionRoutes';
import notificacionService from './services/notificacionServices';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './config/logger';
import { ProfanityFilter } from './profanityFilter';
import Usuario from './models/usuario';
import Evento from './models/evento';

const app = express();
const PORT = 3000;
const usuarioServices = new UserService();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

////////////////////// MIDDLEWARE CORS + JSON //////////////////////
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use('/uploads', (req, res, next) => {
  logger.info(`📂 Archivo solicitado: ${req.url}`);
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

import authRoutes from './routes/authRoutes';

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/user', usuarioRoutes);
app.use('/api/event', eventoRoutes);
app.use('/api/ratings', valoracionRoutes);
app.use('/api/gamificacion', gamificacionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notificaciones', notificacionRoutes);

async function checkEventReminders() {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const upcomingEvents = await Evento.find({
      schedule: {
        $gte: in24Hours,
        $lt: in25Hours,
      },
    })
      .populate('participantes', '_id username')
      .lean();

    logger.info(
      `🔔 Revisando recordatorios: ${upcomingEvents.length} eventos encontrados`,
    );

    for (const evento of upcomingEvents) {
      const participantes = (evento.participantes || []) as unknown as {
        _id: mongoose.Types.ObjectId;
        username: string;
      }[];

      for (const participante of participantes) {
        if (participante && participante._id) {
          try {
            await notificacionService.notifyEventReminder(
              participante._id.toString(),
              evento._id.toString(),
              evento.name,
              new Date(evento.schedule),
            );
            logger.info(
              `✅ Recordatorio enviado a ${participante.username} para evento "${evento.name}"`,
            );
          } catch (err) {
            logger.error(
              `❌ Error enviando recordatorio a ${participante._id}: ${String(err)}`,
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error(`❌ Error en checkEventReminders: ${String(error)}`);
  }
}

async function cleanupOldNotificaciones() {
  try {
    const deleted = await notificacionService.deleteOldNotificaciones();
    logger.info(
      `🗑️ Limpieza automática: ${deleted} notificaciones antiguas eliminadas`,
    );
  } catch (error) {
    logger.error(`❌ Error en limpieza de notificaciones: ${String(error)}`);
  }
}

////////////////////// CONEXIÓN A BBDD //////////////////////
mongoose
  .connect('mongodb://127.0.0.1:27017/BBDD', {
    serverSelectionTimeoutMS: 5000,
    family: 4,
  } as mongoose.ConnectOptions)
  .then(async () => {
    logger.info('CONEXION EXITOSA A LA BASE DE DATOS DE MONGODB');

    await usuarioServices.createAdminUser();
    await gamificacionService.inicializarInsignias();

    setInterval(checkEventReminders, 60 * 60 * 1000);
    logger.info(
      '⏰ Cron job de recordatorios de eventos iniciado (cada 1 hora)',
    );
    checkEventReminders();

    setInterval(cleanupOldNotificaciones, 24 * 60 * 60 * 1000);
    logger.info(
      '🗑️ Cron job de limpieza de notificaciones iniciado (cada 24 horas)',
    );
    cleanupOldNotificaciones();

    httpServer.listen(PORT, () => {
      logger.info(`URL DEL SERVIDOR http://localhost:${PORT}`);
      logger.info(`Swagger docs en http://localhost:${PORT}/api-docs`);
      logger.info(
        `📂 Archivos estáticos: ${path.join(__dirname, 'public', 'uploads')}`,
      );
    });
  })
  .catch((err) => {
    logger.error(`HAY ALGUN ERROR CON LA CONEXION: ${err}`);
  });

////////////////////// SOCKET.IO: ONLINE / OFFLINE //////////////////////
function getChatRoomId(a: string, b: string): string {
  return [a, b].sort().join(':');
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
      logger.info(`🔴 Usuario offline (disconnect): ${userId}`);
    } catch (err) {
      logger.error(`Error al marcar offline en disconnect: ${err}`);
    }
  });

  socket.on('chat:join', (payload: { userId: string; friendId: string }) => {
    try {
      if (!payload?.userId || !payload?.friendId) return;
      const roomId = getChatRoomId(payload.userId, payload.friendId);
      socket.join(roomId);
      logger.info(`💬 Usuario ${payload.userId} unido a chat room: ${roomId}`);
    } catch (err) {
      logger.error(`Error en chat:join: ${err}`);
    }
  });

  socket.on(
    'chat:message',
    async (payload: { from: string; to: string; text: string }) => {
      try {
        const { from, to, text } = payload;
        if (!from || !to || !text || !text.trim()) return;

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

        try {
          const savedMessage = await usuarioServices.addChatMessage(
            from,
            to,
            text.trim(),
          );
          const msg = {
            _id: String((savedMessage as { _id: mongoose.Types.ObjectId })._id),
            from: savedMessage.from,
            to: savedMessage.to,
            text: savedMessage.text,
            createdAt: savedMessage.createdAt,
          };

          const roomId = getChatRoomId(from, to);
          io.to(roomId).emit('chat:message', msg);

          logger.info(`💬 Mensaje guardado: ${from} → ${to}`);

          const chatRoom = io.sockets.adapter.rooms.get(roomId);
          const recipientInChat =
            chatRoom &&
            Array.from(chatRoom).some((socketId) => {
              const s = io.sockets.sockets.get(socketId);
              const data = s?.data as SocketData;
              return data?.userId === to;
            });

          if (!recipientInChat) {
            try {
              const fromUser = await Usuario.findById(from)
                .select('username')
                .lean();
              if (fromUser) {
                const notificacion = await notificacionService.notifyNewMessage(
                  to,
                  from,
                  fromUser.username,
                );

                if (notificacion) {
                  logger.info(
                    `✅ Notificación creada y enviada via Socket.IO a user:${to}`,
                  );
                } else {
                  logger.error(
                    `❌ No se pudo crear la notificación de mensaje`,
                  );
                }
              }
            } catch (notifError) {
              logger.error(
                `❌ Error al enviar notificación de mensaje: ${notifError}`,
              );
            }
          }
        } catch (saveError) {
          logger.error(`Error al guardar mensaje: ${saveError}`);
          const msg = {
            _id: new mongoose.Types.ObjectId().toString(),
            from,
            to,
            text: text.trim(),
            createdAt: new Date(),
          };
          const roomId = getChatRoomId(from, to);
          io.to(roomId).emit('chat:message', msg);
        }
      } catch (err) {
        logger.error(`Error en chat:message: ${err}`);
      }
    },
  );

  function getEventRoomId(eventId: string): string {
    return `event:${eventId}`;
  }

  socket.on('eventChat:join', (payload: { eventId: string }) => {
    try {
      if (!payload?.eventId) return;
      const roomId = getEventRoomId(payload.eventId);
      socket.join(roomId);
      logger.info(`🎉 Usuario unido a event chat room: ${roomId}`);
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

        try {
          const savedMessage = await usuarioServices.addEventChatMessage(
            eventId,
            userId,
            username,
            text.trim(),
          );

          const msg = {
            _id: String((savedMessage as { _id: mongoose.Types.ObjectId })._id),
            eventId: savedMessage.eventId,
            userId: savedMessage.userId,
            username: savedMessage.username,
            text: savedMessage.text,
            createdAt: savedMessage.createdAt,
          };

          const roomId = getEventRoomId(eventId);
          io.to(roomId).emit('eventChat:message', msg);

          logger.info(
            `🎉 Mensaje de evento guardado: ${username} en ${eventId}`,
          );
        } catch (saveError) {
          logger.error(`Error al guardar mensaje de evento: ${saveError}`);
          const msg = {
            _id: new mongoose.Types.ObjectId().toString(),
            eventId,
            userId,
            username,
            text: text.trim(),
            createdAt: new Date(),
          };
          const roomId = getEventRoomId(eventId);
          io.to(roomId).emit('eventChat:message', msg);
        }
      } catch (err) {
        logger.error(`Error en eventChat:message: ${err}`);
      }
    },
  );
});

export { io };
