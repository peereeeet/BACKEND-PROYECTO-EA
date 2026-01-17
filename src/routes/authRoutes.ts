import { Router } from 'express';
import * as authController from '../controller/authController';
import { authenticateRefreshToken } from '../auth/middleware';

const router = Router();

router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verificar el correo electrónico del usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verificado correctamente
 *       400:
 *         description: Código inválido o faltan campos
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Reenviar código de verificación
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código reenviado o usuario ya verificado (Idempotente)
 *       404:
 *         description: Usuario no encontrado
 *       429:
 *         description: Demasiados intentos (Rate Limit)
 */
router.post('/resend-verification', authController.resendVerificationCode);
router.post('/login', authController.login);
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar restablecimiento de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Correo enviado si el usuario existe
 *       429:
 *         description: Demasiados intentos (Rate Limit)
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con código OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida con éxito
 *       400:
 *         description: Código inválido, expirado o faltan campos
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/reset-password', authController.resetPassword);

// New centralized routes
router.post('/google', authController.loginWithGoogle);
router.post('/refresh', authenticateRefreshToken, authController.refreshToken);
router.post('/check-email', authController.checkEmailExists);
router.post('/check-username', authController.checkUsernameExists);
router.post('/create-admin', authController.createAdminUser);
router.post('/forgot-password/check', authController.checkUserExistsForReset);
router.post('/reset-password/direct', authController.directResetPassword);

export default router;
