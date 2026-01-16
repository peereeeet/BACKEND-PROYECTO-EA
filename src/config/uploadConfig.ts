import multer from 'multer';
import path from 'path';
import fs from 'fs';

const profilePhotosDir = path.join(
  __dirname,
  '..',
  'public',
  'uploads',
  'profile-photos',
);
const eventPhotosDir = path.join(
  __dirname,
  '..',
  'public',
  'uploads',
  'event-photos',
);

[profilePhotosDir, eventPhotosDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePhotosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const eventStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, eventPhotosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `event-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, GIF, WEBP).',
      ),
    );
  }
};

export const uploadProfilePhoto = multer({
  storage: profileStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadEventPhoto = multer({
  storage: eventStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB para fotos de eventos
  },
});
