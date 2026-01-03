import { body, ValidationChain } from 'express-validator';

const temporaryEmailDomains = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'maildrop.cc',
  'getnada.com',
  'trashmail.com',
  'sharklasers.com'
];

export const emailValidation: ValidationChain = body('gmail')
  .trim()
  .notEmpty()
  .withMessage('El correo electrónico es obligatorio')
  .isEmail()
  .withMessage('Formato de correo electrónico inválido')
  .normalizeEmail()
  .isLength({ max: 100 })
  .withMessage('El correo electrónico no puede exceder 100 caracteres')
  .custom((value: string) => {
    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      throw new Error('Formato de correo electrónico inválido');
    }
    
    const domain = value.split('@')[1]?.toLowerCase();
    if (temporaryEmailDomains.includes(domain)) {
      throw new Error('No se permiten correos electrónicos temporales');
    }
    
    const [localPart, domainPart] = value.split('@');
    if (localPart.length > 64) {
      throw new Error('La parte local del correo es demasiado larga');
    }
    if (domainPart.length > 253) {
      throw new Error('El dominio del correo es demasiado largo');
    }
    
    if (/\.\./.test(value)) {
      throw new Error('El correo no puede contener puntos consecutivos');
    }
    
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      throw new Error('El correo no puede comenzar o terminar con un punto');
    }
    
    return true;
  });

const commonPasswords = [
  'password', 'password123', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567890', 'letmein', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
  'bailey', 'passw0rd', 'shadow', '123456', 'admin123'
];

export const passwordValidation: ValidationChain = body('password')
  .trim()
  .notEmpty()
  .withMessage('La contraseña es obligatoria')
  .isLength({ min: 8, max: 128 })
  .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
  .matches(/[A-Z]/)
  .withMessage('La contraseña debe contener al menos una letra mayúscula')
  .matches(/[a-z]/)
  .withMessage('La contraseña debe contener al menos una letra minúscula')
  .matches(/[0-9]/)
  .withMessage('La contraseña debe contener al menos un número')
  .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
  .withMessage('La contraseña debe contener al menos un carácter especial (!@#$%^&*...)')
  .custom((value: string) => {
    const lowerValue = value.toLowerCase();
    if (commonPasswords.some(common => lowerValue.includes(common))) {
      throw new Error('La contraseña es demasiado común. Elige una más segura');
    }
    
    const sequences = ['123', 'abc', 'qwerty', 'asdf'];
    if (sequences.some(seq => lowerValue.includes(seq))) {
      throw new Error('La contraseña no puede contener secuencias obvias');
    }
    
    if (/(.)\1{2,}/.test(value)) {
      throw new Error('La contraseña no puede tener más de 2 caracteres iguales consecutivos');
    }
    
    return true;
  });

export const usernameValidation: ValidationChain = body('username')
  .trim()
  .notEmpty()
  .withMessage('El nombre de usuario es obligatorio')
  .isLength({ min: 3, max: 30 })
  .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
  .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
  .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos, y debe empezar con una letra')
  .custom((value: string) => {
    const inappropriateWords = ['admin', 'root', 'system', 'null', 'undefined'];
    const lowerValue = value.toLowerCase();
    if (inappropriateWords.some(word => lowerValue === word)) {
      throw new Error('Este nombre de usuario no está permitido');
    }
    return true;
  });

export const birthdayValidation: ValidationChain = body('birthday')
  .optional()
  .isISO8601()
  .withMessage('Formato de fecha inválido')
  .custom((value: string) => {
    const birthday = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();
    
    if (birthday > today) {
      throw new Error('La fecha de nacimiento no puede ser futura');
    }
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate()) 
      ? age - 1 
      : age;
    
    if (actualAge < 13) {
      throw new Error('Debes tener al menos 13 años para registrarte');
    }
    
    if (actualAge > 120) {
      throw new Error('Fecha de nacimiento inválida');
    }
    
    return true;
  });

export const registerValidation: ValidationChain[] = [
  usernameValidation,
  emailValidation,
  passwordValidation,
  birthdayValidation
];

export const updateProfileValidation: ValidationChain[] = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
  
  body('gmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Formato de correo electrónico inválido')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('El correo electrónico no puede exceder 254 caracteres'),
  
  body('password')
    .optional()
    .trim()
    .isLength({ min: 8, max: 128 })
    .withMessage('La contraseña debe tener entre 8 y 128 caracteres')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[a-z]/)
    .withMessage('La contraseña debe contener al menos una letra minúscula')
    .matches(/[0-9]/)
    .withMessage('La contraseña debe contener al menos un número')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('La contraseña debe contener al menos un carácter especial'),
  
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Formato de fecha inválido')
];