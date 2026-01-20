import { Request, Response, NextFunction } from 'express';
import { verifyToken, verifyRefreshToken } from './token';
import { logger } from '../config/logger';

export function authenticateadminToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization'];
  const token: string = (authHeader && authHeader.split(' ')[1]) ?? '';

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const rol: string = (decoded as any).payload.rol;

  if (rol !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Se requieren privilegios de administrador' });
  }

  logger.info(`Token verificado, usuario administrador`);
  next();
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization'];
  const token: string = (authHeader && authHeader.split(' ')[1]) ?? '';

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const payload = (decoded as any).payload;
  if (!payload || !payload.id) {
    return res
      .status(403)
      .json({ error: 'Token inválido: falta información del usuario' });
  }

  (req as any).user = payload;

  logger.info(`Token verificado, usuario: ${payload.id}`);
  next();
}

export function authenticateOwner(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization'];
  const token: string = (authHeader && authHeader.split(' ')[1]) ?? '';

  if (!token) {
    logger.warn('Token requerido');
    return res.status(401).json({ error: 'Token requerido' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    logger.warn('Token invalido');
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const userIdFromToken: string = (decoded as any).payload.id;
  const userIdFromParams: string = req.params.id;

  if (userIdFromToken === userIdFromParams) {
    logger.info(`Token verificado`);
    (req as any).user = (decoded as any).payload;
    next();
  } else {
    return res
      .status(403)
      .json({ error: 'No tienes permisos para realizar esta acción' });
  }
}

export function authenticateRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { refreshToken, userId } = req.body;
    if (!refreshToken || !userId) {
      logger.warn('Refresh token y userId requeridos');
      return res
        .status(401)
        .json({ error: 'Refresh token y userId requeridos' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      logger.warn('Refresh token inválido o expirado');
      return res
        .status(401)
        .json({ error: 'Refresh token inválido o expirado' });
    }

    const refreshtokenUserid: string = (decoded as any).payload.id;
    if (refreshtokenUserid !== userId) {
      logger.warn('El userId no coincide con el del token');
      return res
        .status(403)
        .json({ error: 'El userId no coincide con el del token' });
    }

    (req as any).user = (decoded as any).payload;

    logger.info(`token verificado, usuario`);
    next();
  } catch (_error) {
    logger.error(`Error al verificar el refreshToken`);
    return res
      .status(500)
      .json({ error: 'Error interno en la verificación del refresh token' });
  }
}
export function optionalAuthenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers['authorization'];
  const token: string = (authHeader && authHeader.split(' ')[1]) ?? '';

  if (!token) {
    next();
    return;
  }

  const decoded = verifyToken(token);
  if (decoded) {
    const payload = (decoded as any).payload;
    if (payload && payload.id) {
      (req as any).user = payload;
      logger.info(`Token verificado usuario: ${payload.id}`);
    }
  }

  next();
}
