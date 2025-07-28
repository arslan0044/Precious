import { getConversations,getMessages  } from "./controller.js";
import express from "express";
import { authenticate } from "../../middlewares/auth.js";
const router = express.Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: User conversation management
 */
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Conversation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439011
 *         participants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         lastMessage:
 *           $ref: '#/components/schemas/Message'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439012
 *         username:
 *           type: string
 *           example: johndoe
 *         profilePic:
 *           type: string
 *           format: uri
 *           example: https://example.com/profile.jpg
 *         status:
 *           type: string
 *           enum: [online, offline, away]
 *           example: online
 *         lastSeen:
 *           type: string
 *           format: date-time
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439013
 *         sender:
 *           $ref: '#/components/schemas/User'
 *         content:
 *           type: string
 *           example: Hello there!
 *         createdAt:
 *           type: string
 *           format: date-time
 *         read:
 *           type: boolean
 *           example: false
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 100
 *         page:
 *           type: integer
 *           example: 2
 *         limit:
 *           type: integer
 *           example: 20
 *         totalPages:
 *           type: integer
 *           example: 5
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPreviousPage:
 *           type: boolean
 *           example: true
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Invalid user ID format
 */

/**
 * @swagger
 * /api/conversations/{userId}:
 *   get:
 *     summary: Get all conversations for a user
 *     description: |
 *       Retrieves paginated conversations for the authenticated user.
 *       - Returns conversation list with participants and last message details
 *       - Supports pagination and minimal response format
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID of the user whose conversations to retrieve
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of conversations per page (max 50)
 *       - in: query
 *         name: minimal
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           If true, returns minimal response without populating participants and last message.
 *           Useful for reducing payload size when only basic conversation info is needed.
 *     responses:
 *       200:
 *         description: Successful operation
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
 *                     $ref: '#/components/schemas/Conversation'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (user trying to access other user's conversations)
 *       500:
 *         description: Internal server error
 */
router.get("/:userId", getConversations);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439011
 *         username:
 *           type: string
 *           example: johndoe
 *         profilePic:
 *           type: string
 *           format: uri
 *           example: https://example.com/profile.jpg
 * 
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439011
 *         content:
 *           type: string
 *           example: Hello there!
 *         sender:
 *           $ref: '#/components/schemas/User'
 *         conversation:
 *           type: string
 *           format: objectId
 *         messageType:
 *           type: string
 *           enum: [text, image, video, system]
 *           example: text
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     ConversationInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: objectId
 *           example: 507f1f77bcf86cd799439011
 *         type:
 *           type: string
 *           enum: [direct, group, broadcast, channel, individual]
 *           example: direct
 *         name:
 *           type: string
 *           nullable: true
 *           example: "Group Chat"
 *         participants:
 *           type: integer
 *           example: 3
 *           description: Number of active participants
 * 
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 100
 *         page:
 *           type: integer
 *           example: 2
 *         limit:
 *           type: integer
 *           example: 20
 *         totalPages:
 *           type: integer
 *           example: 5
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *         hasPreviousPage:
 *           type: boolean
 *           example: true
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Invalid request parameters
 * 
 *   parameters:
 *     conversationIdParam:
 *       in: path
 *       name: conversationId
 *       required: true
 *       schema:
 *         type: string
 *         format: objectId
 *       description: ID of the conversation
 * 
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: Unauthorized access
 * 
 *     ForbiddenError:
 *       description: User doesn't have permission
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: Not a conversation participant
 */

/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   get:
 *     tags: [Messages]
 *     summary: Get conversation messages
 *     description: Retrieve paginated messages from a conversation with filtering options
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/conversationIdParam'
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
 *           default: 50
 *         description: Messages per page
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter messages before this timestamp
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter messages after this timestamp
 *       - in: query
 *         name: includeSystem
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include system messages
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order by creation time
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 conversationInfo:
 *                   $ref: '#/components/schemas/ConversationInfo'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: Conversation not found
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: Internal server error
 */

router.get(
  '/:conversationId/messages',
  getMessages
);
export default router;