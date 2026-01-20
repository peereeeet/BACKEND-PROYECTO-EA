import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const eventChatDir = path.join(
  __dirname,
  '..',
  'public',
  'uploads',
  'event-chat',
);
if (!fs.existsSync(eventChatDir)) {
  fs.mkdirSync(eventChatDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, eventChatDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `event-chat-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)',
      ),
    );
  }
};

export const uploadEventChatImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
