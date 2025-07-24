import {
  userInfoController,
  updatePasswordController,
  updateProfileController,
  requestFollowController,
  acceptFollowRequestController,
  rejectFollowRequestController,
  unfollowUserController,
  blockUserController,
  unblockUserController,
  getFollowStatusController,
  getUserRelationshipsController,
  getAllUsersController,
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

/**
 * @swagger
 * tags:
 *   name: Follow
 *   description: User relationship management
 */

/**
 * @swagger
 * /api/user/{userId}/follow:
 *   post:
 *     summary: Follow or request to follow a user
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to follow
 *     responses:
 *       200:
 *         description: Follow request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [following, requested]
 *                   example: following
 *       400:
 *         description: Bad request (already following, self-follow, etc.)
 *       403:
 *         description: Forbidden (blocked, private account not accepting requests)
 *       404:
 *         description: User not found
 */
router.post("/:userId/follow", requestFollowController);

/**
 * @swagger
 * /api/user/{requesterId}/accept:
 *   post:
 *     summary: Accept a follow request
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user who sent the request
 *     responses:
 *       200:
 *         description: Request accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: following
 *       400:
 *         description: No pending request from this user
 *       404:
 *         description: User not found
 */
router.post("/:requesterId/accept", acceptFollowRequestController);

/**
 * @swagger
 * /api/user/{requesterId}/reject:
 *   post:
 *     summary: Reject a follow request
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requesterId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user who sent the request
 *     responses:
 *       200:
 *         description: Request rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: rejected
 *       404:
 *         description: User not found
 */
router.post("/:requesterId/reject", rejectFollowRequestController);

/**
 * @swagger
 * /api/user/{userId}/unfollow:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to unfollow
 *     responses:
 *       200:
 *         description: Unfollow successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unfollowed
 *       400:
 *         description: Not following this user
 *       404:
 *         description: User not found
 */
router.delete("/:userId/unfollow", unfollowUserController);

/**
 * @swagger
 * /api/user/{userId}/block:
 *   post:
 *     summary: Block a user
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to block
 *     responses:
 *       200:
 *         description: User blocked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: blocked
 *       400:
 *         description: Cannot block yourself
 *       404:
 *         description: User not found
 */
router.post("/:userId/block", blockUserController);

/**
 * @swagger
 * /api/user/{userId}/unblock:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to unblock
 *     responses:
 *       200:
 *         description: User unblocked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unblocked
 *       404:
 *         description: User not found
 */
router.delete("/:userId/unblock", unblockUserController);

/**
 * @swagger
 * /api/user/{userId}/status:
 *   get:
 *     summary: Get relationship status with a user
 *     tags: [Follow]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user to check status with
 *     responses:
 *       200:
 *         description: Relationship status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [self, blocked, following, requested, not_following]
 *                   example: following
 *                 isFollowing:
 *                   type: boolean
 *                   example: true
 *                 hasPendingRequest:
 *                   type: boolean
 *                   example: false
 *                 isPrivate:
 *                   type: boolean
 *                   example: false
 *       404:
 *         description: User not found
 */
router.get("/:userId/status", getFollowStatusController);

/**
 * @swagger
 * tags:
 *   name: Relationships
 *   description: User relationship management
 */

/**
 * @swagger
 * /api/user/{userId}/relationships:
 *   get:
 *     summary: Get a user's relationships
 *     description: Retrieve followers, following, pending requests, and blocked users with counts
 *     tags: [Relationships]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the user whose relationships to fetch
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *           enum: [followers, following, pendingFollowRequests, blockedUsers]
 *           default: "followers,following,pendingFollowRequests,blockedUsers"
 *         description: Comma-separated list of relationship types to include
 *       - in: query
 *         name: include_counts
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to include counts in the response
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of results per relationship type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *     responses:
 *       200:
 *         description: User relationships retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counts:
 *                   type: object
 *                   description: Relationship counts (only if include_counts=true)
 *                   properties:
 *                     followers:
 *                       type: integer
 *                       example: 42
 *                     following:
 *                       type: integer
 *                       example: 37
 *                     pendingRequests:
 *                       type: integer
 *                       example: 3
 *                 relationships:
 *                   type: object
 *                   properties:
 *                     followers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BasicUser'
 *                     following:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BasicUser'
 *                     pendingFollowRequests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BasicUser'
 *                     blockedUsers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BasicUser'
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Not authorized to view these relationships
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BasicUser:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         username:
 *           type: string
 *           example: "johndoe"
 *         profile:
 *           type: object
 *           properties:
 *             avatar:
 *               type: string
 *               example: "https://example.com/avatar.jpg"
 *         isOnline:
 *           type: boolean
 *           example: true
 *         lastSeen:
 *           type: string
 *           format: date-time
 *           example: "2023-05-15T10:00:00Z"
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

router.get("/:userId/relationships", getUserRelationshipsController);

/**
 * @swagger
 * /api/user/all-users:
 *   get:
 *     summary: Get all active users
 *     description: Retrieve a paginated list of active users with optional sorting and search.
 *     tags: [Relationships]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, username, lastSeen]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search keyword to filter by username or name
 *     responses:
 *       200:
 *         description: A list of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BasicUser'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 150
 *                     totalPages:
 *                       type: integer
 *                       example: 8
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 20
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid pagination parameters"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

router.get("/all-users", getAllUsersController);
export default router;
