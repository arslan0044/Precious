import express from "express";
import {
  sendOtpController,
  verifyOtpController,
  registerUserController,
  loginUserController,
  googleLoginController,
  forgotPasswordOTPController,
  refreshTokenController,
  verifyForgotOtpController,
  updatePasswordController,
} from "./controller.js";
import { verifyPasswordResetToken } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  registerSchema,
  loginSchema,
  sendOTPSchecma,
  verifyOTPSchecma,
  verifyForgotOTP,
  updatePassword,
  refreshToken,
} from "./validation.js";
const router = express.Router();

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to a user's email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
router.post("/send-otp", validate(sendOTPSchecma), sendOtpController);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify an OTP code for email verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.post("/verify-otp", validate(verifyOTPSchecma), verifyOtpController);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user after OTP verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *                 example: user123
 *               name:
 *                 type: string
 *                 example: John Doe
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: OTP not verified
 */
router.post("/register", validate(registerSchema), registerUserController);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user with email and password
 *     description: Returns an access token upon successful authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: Registered email address
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: 12345678
 *                 description: User password (min 8 characters)
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: error
 *               message: Email and password are required
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: error
 *               message: Invalid credentials
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               status: error
 *               message: Too many login attempts, please try again later
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/login", validate(loginSchema), loginUserController);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Login or register using Google OAuth token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 example: ya29.a0AfH6SMA...
 *     responses:
 *       200:
 *         description: Login success via Google
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/google", googleLoginController);
/**
 * @swagger
 * /api/auth/forgot-password-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Send password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent
 *       400:
 *         description: Invalid email
 *       404:
 *         description: User not found
 */
router.post(
  "/forgot-password-otp",
  validate(sendOTPSchecma),
  forgotPasswordOTPController
);
/**
 * @swagger
 * /api/auth/verify-forgot-otp:
 *   post:
 *     summary: Verify OTP for password reset
 *     description: Verify the OTP code sent for password recovery and return a short-lived token to update password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "583920"
 *     responses:
 *       200:
 *         description: OTP verified and token returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

router.post(
  "/verify-forgot-otp",
  validate(verifyForgotOTP),
  verifyForgotOtpController
);
/**
 * @swagger
 * /api/auth/update-password:
 *   patch:
 *     summary: Update password after verifying reset token
 *     description: Allows user to update password using a valid password-reset token.
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: NewPassword@123
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password updated
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Password updated successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.patch(
  "/update-password",
  verifyPasswordResetToken,
  validate(updatePassword),
  updatePasswordController
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh JWT tokens
 *     description: Exchange a valid refresh token for a new access and refresh token pair.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6...
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Token refreshed successfully
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post("/refresh-token", validate(refreshToken), refreshTokenController);

export default router;
