import {
  userInfoController,
  updatePasswordController,
  updateProfileController,
} from "./controller.js";
import express from "express";
import { authenticate } from "../../middlewares/auth.js";
const router = express.Router();
router.use(authenticate);
/**
 * @swagger
 * /api/user/me:
 *   get:
 *     summary: Get current authenticated user info
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 60ae0d9f5b6c3c001c8f1234
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     role:
 *                       type: string
 *                       example: user
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */

router.get("/me", userInfoController);

/**
 * @swagger
 * /api/user/update-password:
 *   put:
 *     summary: Update authenticated user password
 *     description: Authenticated users can update their password by providing the old and new passwords.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: old_password123
 *               newPassword:
 *                 type: string
 *                 example: new_secure_password456
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
 *                   example: Password updated successfully
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.put("/update-password", updatePasswordController);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update authenticated user's profile
 *     description: Updates profile fields including personal information, preferences, and privacy settings.
 *     tags:
 *       - User
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *                 minLength: 1
 *               username:
 *                 type: string
 *                 example: johndoe123
 *                 minLength: 3
 *                 maxLength: 30
 *               profile:
 *                 type: object
 *                 properties:
 *                   avatar:
 *                     type: string
 *                     format: uri
 *                     example: https://example.com/avatar.jpg
 *                   phone:
 *                     type: string
 *                     example: "+1234567890"
 *                   bio:
 *                     type: string
 *                     example: "Digital creator | Photography enthusiast"
 *                     maxLength: 150
 *                   website:
 *                     type: string
 *                     format: uri
 *                     example: "https://johndoe.com"
 *                   gender:
 *                     type: string
 *                     enum: ["Male", "Female", "Other"]
 *                     example: "Male"
 *                   dob:
 *                     type: string
 *                     format: date
 *                     example: "1990-10-27"
 *               notificationPreferences:
 *                 type: object
 *                 properties:
 *                   push:
 *                     type: boolean
 *                     example: true
 *                   email:
 *                     type: boolean
 *                     example: true
 *                   whatsapp:
 *                     type: boolean
 *                     example: false
 *               privacySettings:
 *                 type: object
 *                 properties:
 *                   showActivityStatus:
 *                     type: boolean
 *                     example: true
 *                   allowSharing:
 *                     type: boolean
 *                     example: true
 *                   allowTagging:
 *                     type: boolean
 *                     example: true
 *                   searchVisibility:
 *                     type: boolean
 *                     example: true
 *               contentPreferences:
 *                 type: object
 *                 properties:
 *                   sensitiveContentFilter:
 *                     type: boolean
 *                     example: true
 *                   language:
 *                     type: string
 *                     example: "en"
 *                   theme:
 *                     type: string
 *                     enum: ["light", "dark", "system"]
 *                     example: "dark"
 *               isPrivate:
 *                 type: boolean
 *                 example: false
 *               allow_friends_Request:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: Profile updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input data
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Conflict (e.g., username or email already taken)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: user@example.com
 *         username:
 *           type: string
 *           example: johndoe123
 *         profile:
 *           $ref: '#/components/schemas/UserProfile'
 *         role:
 *           type: string
 *           enum: ["user", "admin", "moderator", "owner"]
 *           example: user
 *         status:
 *           type: string
 *           enum: ["active", "inactive", "suspended", "deleted"]
 *           example: active
 *         isPrivate:
 *           type: boolean
 *           example: false
 *         allow_friends_Request:
 *           type: boolean
 *           example: true
 *         followersCount:
 *           type: integer
 *           example: 42
 *         followingCount:
 *           type: integer
 *           example: 37
 *         postCount:
 *           type: integer
 *           example: 15
 *         privacySettings:
 *           $ref: '#/components/schemas/PrivacySettings'
 *         contentPreferences:
 *           $ref: '#/components/schemas/ContentPreferences'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     UserProfile:
 *       type: object
 *       properties:
 *         avatar:
 *           type: string
 *           example: https://example.com/avatar.jpg
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         bio:
 *           type: string
 *           example: "Digital creator | Photography enthusiast"
 *         website:
 *           type: string
 *           example: "https://johndoe.com"
 *         gender:
 *           type: string
 *           enum: ["Male", "Female", "Other"]
 *           example: "Male"
 *         dob:
 *           type: string
 *           format: date
 *           example: "1990-10-27"
 * 
 *     PrivacySettings:
 *       type: object
 *       properties:
 *         showActivityStatus:
 *           type: boolean
 *           example: true
 *         allowSharing:
 *           type: boolean
 *           example: true
 *         allowTagging:
 *           type: boolean
 *           example: true
 *         searchVisibility:
 *           type: boolean
 *           example: true
 * 
 *     ContentPreferences:
 *       type: object
 *       properties:
 *         sensitiveContentFilter:
 *           type: boolean
 *           example: true
 *         language:
 *           type: string
 *           example: "en"
 *         theme:
 *           type: string
 *           enum: ["light", "dark", "system"]
 *           example: "dark"
 */

router.put("/profile", updateProfileController);

export default router;
