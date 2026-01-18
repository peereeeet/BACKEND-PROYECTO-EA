import { Request, Response, NextFunction } from 'express';
import { ProfanityFilter } from './profanityFilter';
import { logger } from './config/logger';

export const profanityMiddleware = (fieldsToCheck: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const lang =
        (req.headers['accept-language']?.split(',')[0]?.split('-')[0] as any) ||
        'es';

      const result = ProfanityFilter.checkObject(req.body, fieldsToCheck);

      if (!result.isClean) {
        logger.warn(
          `🚫 Contenido bloqueado - Palabras encontradas: ${result.foundWords.join(', ')}`,
        );
        logger.warn(
          `Usuario: ${(req as any).user?.id || 'Anónimo'} | IP: ${req.ip}`,
        );

        return res.status(400).json({
          message: ProfanityFilter.getErrorMessage(result.foundWords, lang),
          code: 'INAPPROPRIATE_CONTENT',
          details: {
            fieldsChecked: fieldsToCheck,
            violationCount: result.foundWords.length,
          },
        });
      }

      next();
    } catch (error) {
      logger.error(`Error en profanity middleware: ${error}`);
      next();
    }
  };
};

export const validateUserContent = profanityMiddleware(['username', 'gmail']);

export const validateEventContent = profanityMiddleware(['name', 'address']);

export const validateRatingContent = profanityMiddleware(['comentario']);

export const validateMessageContent = profanityMiddleware([
  'content',
  'message',
  'texto',
]);

export const validateTextContent = (fieldName: string = 'text') => {
  return profanityMiddleware([fieldName]);
};
