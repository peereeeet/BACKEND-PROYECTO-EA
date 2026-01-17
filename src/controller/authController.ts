import { Request, Response } from 'express';
import Usuario, { IUsuario } from '../models/usuario';
import * as emailService from '../services/emailService';
import * as otpService from '../services/otpService';
import { generateToken, generateRefreshToken } from '../auth/token';
import { logger } from '../config/logger';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../services/usuarioServices';

const userService = new UserService();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function register(req: Request, res: Response): Promise<Response> {
  try {
    const { username, gmail, password, birthday } = req.body;

    const existingUser = await Usuario.findOne({
      $or: [{ username }, { gmail }],
    });
    if (existingUser) {
      if (existingUser.gmail === gmail) {
        return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
      }
      return res.status(409).json({ error: 'USERNAME_ALREADY_EXISTS' });
    }

    const otp = otpService.generateOTP();
    const otpHash = await otpService.hashOTP(otp);

    const newUser = new Usuario({
      username,
      gmail,
      password,
      birthday,
      rol: 'usuario',
      accountStatus: 'PENDING_EMAIL',
      otpHash,
      otpExpires: new Date(Date.now() + 15 * 60 * 1000),
      otpAttempts: 0,
      otpLastSentAt: new Date(),
      otpPurpose: 'VERIFY_EMAIL',
    });

    await newUser.save();

    await emailService.sendVerificationEmail(gmail, otp);

    logger.info(`Nuevo usuario registrado (pendiente): ${username}`);
    return res.status(201).json({
      message: 'Usuario registrado. Verifica tu email.',
      userId: newUser._id,
    });
  } catch (error) {
    logger.error(`Error en register: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const gmail = email;

    const user = await Usuario.findOne({ gmail });
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    if (user.accountStatus === 'ACTIVE') {
      return res.status(400).json({ error: 'ALREADY_Verified' });
    }

    if (user.otpPurpose !== 'VERIFY_EMAIL') {
      return res.status(400).json({ error: 'INVALID_OTP_PURPOSE' });
    }

    if (!user.otpHash || !user.otpExpires) {
      return res.status(400).json({ error: 'NO_OTP_REQUESTED' });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({ error: 'EXPIRED_CODE' });
    }

    const maxAttempts = 5;
    if ((user.otpAttempts || 0) >= maxAttempts) {
      return res.status(423).json({ error: 'TOO_MANY_ATTEMPTS' });
    }

    const isValid = await otpService.verifyOTP(otp, user.otpHash);
    if (!isValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ error: 'INVALID_CODE' });
    }

    user.accountStatus = 'ACTIVE';
    user.otpHash = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpPurpose = null;
    user.otpLastSentAt = null;
    await user.save();

    logger.info(`Email verificado para: ${gmail}`);
    return res.status(200).json({ message: 'EMAIL_VERIFIED' });
  } catch (error) {
    logger.error(`Error en verifyEmail: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function resendVerificationCode(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { email } = req.body;
    const gmail = email;
    const user = await Usuario.findOne({ gmail });

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }
    if (user.accountStatus === 'ACTIVE') {
      return res.status(200).json({ message: 'ALREADY_VERIFIED' });
    }

    if (user.otpLastSentAt) {
      const diff = Date.now() - user.otpLastSentAt.getTime();
      if (diff < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ error: 'RATE_LIMITED' });
      }
    }

    const otp = otpService.generateOTP();
    const otpHash = await otpService.hashOTP(otp);

    user.otpHash = otpHash;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    user.otpPurpose = 'VERIFY_EMAIL';
    await user.save();

    await emailService.sendVerificationEmail(gmail, otp);

    return res.status(200).json({ message: 'CODE_SENT' });
  } catch (error) {
    logger.error(`Error en resendVerificationCode: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { username, password } = req.body;

    const user = await Usuario.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    if (user.isGoogleUser) {
      return res.status(400).json({
        error: 'GOOGLE_ACCOUNT',
        message: 'This account uses Google Login',
      });
    }

    if (user.accountStatus === 'PENDING_EMAIL') {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
    }

    if (!user.isActive || user.accountStatus === 'DISABLED') {
      return res.status(403).json({ error: 'USER_DISABLED' });
    }

    const token = await generateToken(user, res);
    const refreshToken = await generateRefreshToken(user, res);

    const userObj = user.toObject() as Partial<IUsuario>;
    delete userObj.password;
    delete userObj.otpHash;

    logger.info(`Login exitoso: ${username}`);
    return res.json({
      message: 'LOGIN EXITOSO',
      user: userObj,
      token,
      refreshToken,
    });
  } catch (error) {
    logger.error(`Error en login: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { email } = req.body;
    const gmail = email;
    const user = await Usuario.findOne({ gmail });

    if (!user) {
      logger.debug(`Forgot password para email no existente: ${email}`);
      return res.status(200).json({ message: 'EMAIL_SENT_IF_EXISTS' });
    }

    if (user.otpLastSentAt) {
      const diff = Date.now() - user.otpLastSentAt.getTime();
      if (diff < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ error: 'RATE_LIMITED' });
      }
    }

    const otp = otpService.generateOTP();
    const otpHash = await otpService.hashOTP(otp);

    user.otpHash = otpHash;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    user.otpPurpose = 'RESET_PASSWORD';

    await user.save();

    await emailService.sendPasswordResetEmail(user.gmail, otp);

    logger.info(`Forgot password solicitado para: ${gmail}`);
    return res.status(200).json({ message: 'EMAIL_SENT_IF_EXISTS' });
  } catch (error) {
    logger.error(`Error en forgotPassword: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const gmail = email;

    const user = await Usuario.findOne({ gmail });
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    if (user.otpPurpose !== 'RESET_PASSWORD') {
      return res.status(400).json({ error: 'INVALID_OTP_PURPOSE' });
    }

    if (!user.otpHash || !user.otpExpires) {
      return res.status(400).json({ error: 'NO_RESET_REQUESTED' });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({ error: 'EXPIRED_CODE' });
    }

    const maxAttempts = 5;
    if ((user.otpAttempts || 0) >= maxAttempts) {
      return res.status(423).json({ error: 'TOO_MANY_ATTEMPTS' });
    }

    const isValid = await otpService.verifyOTP(otp, user.otpHash);
    if (!isValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ error: 'INVALID_CODE' });
    }

    user.password = newPassword;
    user.otpHash = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpPurpose = null;

    if (user.accountStatus === 'PENDING_EMAIL') {
      user.accountStatus = 'ACTIVE';
    }

    await user.save();

    logger.info(`Contraseña restablecida para: ${gmail}`);
    return res.status(200).json({ message: 'PASSWORD_RESET_SUCCESS' });
  } catch (error) {
    logger.error(`Error en resetPassword: ${error}`);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}

export async function loginWithGoogle(req: Request, res: Response) {
  try {
    const { credential, birthday } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Falta el token de Google' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Token de Google no válido' });
    }

    const gmail = payload.email;
    const googleId = payload.sub || null;
    const name =
      payload.name || (gmail.includes('@') ? gmail.split('@')[0] : gmail);

    let birthdayDate: Date | undefined = undefined;
    if (birthday) {
      const parsed = new Date(birthday as string);
      if (!Number.isNaN(parsed.getTime())) {
        birthdayDate = parsed;
      }
    }

    if (!birthdayDate) {
      const payloadObj = payload as { birthdate?: string; birthday?: string };
      const rawBirth = payloadObj.birthdate || payloadObj.birthday;
      if (rawBirth) {
        const parsed = new Date(rawBirth);
        if (!Number.isNaN(parsed.getTime())) {
          birthdayDate = parsed;
        }
      }
    }

    let user = await Usuario.findOne({ gmail });

    if (!user) {
      user = new Usuario({
        username: name,
        gmail,
        birthday: birthdayDate,
        rol: 'usuario',
        isGoogleUser: true,
        googleId,
        accountStatus: 'ACTIVE',
      } as Partial<IUsuario>);

      await user.save();
    } else {
      if (!user.isGoogleUser) {
        return res.status(400).json({
          message:
            'Esta cuenta ya existe sin Google. Inicia sesión con usuario y contraseña.',
        });
      }

      let mustSave = false;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        mustSave = true;
      }
      if (!user.birthday && birthdayDate) {
        user.birthday = birthdayDate;
        mustSave = true;
      }
      if (mustSave) {
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'USER_DISABLED' });
    }

    const token = await generateToken(user!, res);
    const refreshToken = await generateRefreshToken(user!, res);

    return res.status(200).json({
      message: 'LOGIN EXITOSO',
      user,
      token,
      refreshToken,
    });
  } catch (error) {
    logger.error(`Error en loginWithGoogle: ${error}`);
    return res.status(500).json({ message: 'ERROR EN LOGIN CON GOOGLE' });
  }
}

/* Create admin only development */
export async function createAdminUser(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    await userService.createAdminUser();
    return res.status(200).json({ message: 'Usuario admin verificado/creado' });
  } catch (_error) {
    return res.status(500).json({ error: 'Error con usuario admin' });
  }
}

export const checkEmailExists = async (req: Request, res: Response) => {
  try {
    const { gmail, userId } = req.body;

    if (!gmail) {
      return res
        .status(400)
        .json({ exists: false, message: "El campo 'gmail' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ gmail });

    if (!existingUser) {
      return res
        .status(200)
        .json({ exists: false, message: 'El correo está disponible' });
    }

    if (userId && existingUser._id.toString() === userId) {
      return res.status(200).json({
        exists: false,
        message: 'El correo pertenece al mismo usuario',
      });
    }

    return res
      .status(200)
      .json({ exists: true, message: 'El correo ya está registrado' });
  } catch (_error) {
    res.status(500).json({ error: 'Error al verificar el correo' });
  }
};

export const checkUsernameExists = async (req: Request, res: Response) => {
  try {
    const { username, userId } = req.body;

    if (!username) {
      logger.warn('Falta username en checkUsernameExists');
      return res
        .status(400)
        .json({ exists: false, message: "El campo 'username' es obligatorio" });
    }

    const existingUser = await Usuario.findOne({ username });

    if (!existingUser) {
      logger.info(`Nombre de usuario disponible: ${username}`);
      return res
        .status(200)
        .json({ exists: false, message: 'Nombre disponible' });
    }

    if (userId && existingUser._id.toString() === userId) {
      logger.info(
        `El nombre de usuario pertenece al mismo usuario: ${username}`,
      );
      return res
        .status(200)
        .json({ exists: false, message: 'Nombre pertenece al mismo usuario' });
    }
    logger.info(`El nombre de usuario ya está en uso: ${username}`);
    return res
      .status(200)
      .json({ exists: true, message: 'El nombre de usuario ya está en uso' });
  } catch (error) {
    logger.error(`Error en checkUsernameExists: ${error}`);
    return res
      .status(500)
      .json({ error: 'Error al verificar el nombre de usuario' });
  }
};

export async function refreshToken(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const id = (req as Request & { user: { payload: { id: string } } }).user
      .payload.id;
    const user = await userService.getUserById(id);
    if (!user) {
      logger.warn(`Usuario no encontrado en refreshToken with ID: ${id}`);
      return res.status(404).json({ message: 'USUARIO NO ENCONTRADO' });
    }

    const newToken = await generateToken(user, res);
    logger.info(`Nuevo token generado para el usuario con ID: ${id}`);
    return res.status(200).json({
      token: newToken,
    });
  } catch (error) {
    logger.error(`Error en refreshToken: ${error}`);
    return res.status(500).json({ error: 'ERROR AL ACTUALIZAR EL TOKEN' });
  }
}

export async function checkUserExistsForReset(req: Request, res: Response) {
  try {
    const { emailOrUsername } = req.body || {};
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      logger.warn('Falta email o usuario en checkUserExistsForReset');
      return res.status(400).json({ message: 'Falta email o usuario.' });
    }

    const user = await userService.findUserByEmailOrUsername(emailOrUsername);
    if (!user) return res.json({ exists: false });

    return res.json({
      exists: true,
      userId: String(user._id),
      username: user.username,
      gmail: user.gmail,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Error al comprobar usuario.';
    return res.status(500).json({ message: errorMessage });
  }
}

export async function directResetPassword(req: Request, res: Response) {
  try {
    const { userId, newPassword } = req.body || {};
    if (!userId || !newPassword) {
      return res.status(400).json({ message: 'Faltan datos.' });
    }
    await userService.setPasswordByUserId(userId, newPassword);
    return res.json({ ok: true });
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'No se pudo actualizar la contraseña.';
    return res.status(400).json({
      message: errorMessage,
    });
  }
}
