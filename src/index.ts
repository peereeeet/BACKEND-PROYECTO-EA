import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import usuarioRoutes from './routes/usuarioRoutes';
import eventoRoutes from './routes/eventoRoutes';
import { UserService } from './services/usuarioServices';
import valoracionRoutes from './routes/valoracionRoutes';
import gamificacionRoutes from './routes/gamificacionRoutes';
import gamificacionService from './services/gamificacionServices';
import aiRoutes from './routes/aiRoutes';
import notificacionRoutes from './routes/notificacionRoutes';
import notificacionService from './services/notificacionServices';
import { cleanupOldEventPhotos } from './controller/eventoController';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './config/logger';
import { ProfanityFilter } from './profanityFilter';
import Usuario from './models/usuario';
import Evento from './models/evento';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';

const app = express();
const PORT = process.env.PORT || 3000;
const usuarioServices = new UserService();
const httpServer = createServer(app);

const allowedOrigins = [
  'http://localhost:4200',
  'https://ea2.upc.edu',
  'https://ea2-api.upc.edu',
  'http://ea2-api.upc.edu',
];

const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  transports: ['websocket'],
  allowUpgrades: false,
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

////////////////////// MIDDLEWARE CORS + JSON //////////////////////
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  '/uploads/profile-photos',
  express.static(path.join(__dirname, 'public', 'uploads', 'profile-photos')),
);
app.use(
  '/uploads/event-photos',
  express.static(path.join(__dirname, 'public', 'uploads', 'event-photos')),
);
app.use(
  '/uploads/event-chat',
  express.static(path.join(__dirname, 'public', 'uploads', 'event-chat')),
);
app.use(
  '/uploads/friend-chat',
  express.static(path.join(__dirname, 'public', 'uploads', 'friend-chat')),
);

// Middleware para loguear solicitudes a /uploads
app.use('/uploads', (req, res, next) => {
  logger.info(`📂 Archivo solicitado: ${req.url}`);
  next();
});

// Servir toda la carpeta /uploads como estática (fallback)
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'public', 'uploads'), {
    maxAge: '30d', // Cache de 30 días
    etag: false,
  }),
);

import authRoutes from './routes/authRoutes';

////////////////////// ENDPOINT: Servir fotos de eventos //////////////////////
/**
 * GET /api/event/:eventId/photo/:filename?token=JWT
 * Sirve archivos de fotos de eventos desde /app/dist/public/uploads/
 * - Protegido contra path traversal
 * - Cache headers: 30 días
 * - Retorna 404 JSON si no existe
 */
app.get('/api/event/:eventId/photo/:filename', (req, res) => {
  try {
    const { eventId, filename } = req.params;
    // El token en query string se ignora (no se valida aún)
    // const token = req.query.token;

    // Protección contra path traversal: ../ no permitido
    if (filename.includes('..')) {
      logger.warn(`🚨 Path traversal attempt detectado: ${filename}`);
      return res.status(400).json({
        ok: false,
        message: 'Invalid filename',
      });
    }

    // Construir ruta segura del archivo
    // Archivos están en: /app/dist/public/uploads/event-photos/ (en producción)
    // O en: dist/public/uploads/event-photos/ (en desarrollo)
    const uploadsDir = path.join(
      __dirname,
      'public',
      'uploads',
      'event-photos',
    );
    const filePath = path.join(uploadsDir, filename);

    // Verificar que la ruta resuelta está dentro de uploadsDir (seguridad)
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      logger.warn(`🚨 Path traversal bloqueado: ${filename}`);
      return res.status(400).json({
        ok: false,
        message: 'Invalid filename',
      });
    }

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      logger.warn(
        `📸 Foto de evento no encontrada: eventId=${eventId}, filename=${filename}`,
      );
      return res.status(404).json({
        ok: false,
        message: 'Foto no encontrada',
        eventId,
        filename,
      });
    }

    // Headers de cache: 30 días
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    res.set('Cache-Control', `public, max-age=${thirtyDaysInSeconds}`);
    res.set(
      'Expires',
      new Date(Date.now() + thirtyDaysInSeconds * 1000).toUTCString(),
    );

    // Enviar archivo
    logger.info(`✅ Sirviendo foto de evento: ${filename}`);
    return res.sendFile(filePath);
  } catch (error) {
    logger.error(`❌ Error sirviendo foto de evento: ${error}`);
    return res.status(500).json({
      ok: false,
      message: 'Error al servir la foto',
    });
  }
});

////////////////////// RUTAS API //////////////////////
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
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

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/BBDD';

mongoose
  .connect(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
    family: 4,
  } as mongoose.ConnectOptions)
  .then(async () => {
    logger.info('CONEXION EXITOSA A LA BASE DE DATOS DE MONGODB');

    //await usuarioServices.createAdminUser();
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

    setInterval(cleanupOldEventPhotos, 24 * 60 * 60 * 1000);
    logger.info(
      '🗑️ Cron job de limpieza de fotos de eventos iniciado (cada 24 horas)',
    );
    cleanupOldEventPhotos();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Servidor corriendo en puerto: ${PORT}`);
      logger.info(
        `📁 Base de Datos: ${MONGO_URL.replace(/\/\/.*@/, '//***:***@')}`,
      );
      logger.info(`📖 Swagger docs: /api-docs`);
    });
  })
  .catch((err) => {
    logger.error(`HAY ALGUN ERROR CON LA CONEXION: ${err}`);
  });

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

  socket.on('user:force_offline', async (userId: string) => {
    try {
      if (!userId) return;
      await usuarioServices.setUserOffline(userId);
      io.emit('user:offline', { userId });
      logger.info(`🌙 Usuario en modo invisible (background): ${userId}`);
    } catch (err) {
      logger.error(`Error en user:force_offline: ${err}`);
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
    async (payload: {
      from: string;
      to: string;
      text: string;
      imageUrl?: string;
    }) => {
      try {
        const { from, to, text, imageUrl } = payload;
        if (!from || !to) return;
        if ((!text || !text.trim()) && !imageUrl) return;

        if (text && text.trim()) {
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
        }

        try {
          const savedMessage = await usuarioServices.addChatMessage(
            from,
            to,
            text ? text.trim() : '',
            imageUrl,
          );
          const msg = {
            _id: String((savedMessage as { _id: mongoose.Types.ObjectId })._id),
            from: savedMessage.from,
            to: savedMessage.to,
            text: savedMessage.text,
            imageUrl: (savedMessage as any).imageUrl,
            createdAt: savedMessage.createdAt,
          };

          const roomId = getChatRoomId(from, to);
          io.to(roomId).emit('chat:message', msg);

          logger.info(
            `💬 Mensaje guardado: ${from} → ${to}${imageUrl ? ' (con imagen)' : ''}`,
          );

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
            text: text ? text.trim() : '',
            imageUrl,
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
      imageUrl?: string;
    }) => {
      try {
        const { eventId, userId, username, text, imageUrl } = payload;

        if (!eventId || !userId || !username) return;
        if ((!text || !text.trim()) && !imageUrl) return;

        if (text && text.trim()) {
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
        }

        try {
          const savedMessage = await usuarioServices.addEventChatMessage(
            eventId,
            userId,
            username,
            text ? text.trim() : '',
            imageUrl,
          );

          const msg = {
            _id: String((savedMessage as { _id: mongoose.Types.ObjectId })._id),
            eventId: savedMessage.eventId,
            userId: savedMessage.userId,
            username: savedMessage.username,
            text: savedMessage.text,
            imageUrl: (savedMessage as any).imageUrl,
            createdAt: savedMessage.createdAt,
          };

          const roomId = getEventRoomId(eventId);
          io.to(roomId).emit('eventChat:message', msg);

          logger.info(
            `🎉 Mensaje de evento guardado: ${username} en ${eventId}${imageUrl ? ' (con imagen)' : ''}`,
          );
        } catch (saveError) {
          logger.error(`Error al guardar mensaje de evento: ${saveError}`);
          const msg = {
            _id: new mongoose.Types.ObjectId().toString(),
            eventId,
            userId,
            username,
            text: text ? text.trim() : '',
            imageUrl,
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
