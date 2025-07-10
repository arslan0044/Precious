import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { sendNotification } from "../utils/notification.js";
import User from "../models/User.js";
import Message from "../models/message.js";
import Conversation from "../models/conversation.js";
import config from "../config/env.js";
import Notification from "../models/notification.js";
import { isValidObjectId } from "../utils/_idvalidationhelper.js";
import mongoose from "mongoose";

// Map to track connected users (userId -> socketId)
const connectedUsers = new Map();

// Map to track user presence in conversations
const userPresence = new Map();

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {socketIO.Server} Configured Socket.IO server
 */
export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const secret = config.get("jwtSecret");
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded._id).select(
        "_id username isOnline email profile"
      );

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(`New connection: ${socket.id} (User: ${socket.user._id})`);

    // Add user to connected users map
    connectedUsers.set(socket.user._id.toString(), socket.id);

    // Update user online status
    updateUserOnlineStatus(socket.user._id, true);

    // Join user to their personal room
    socket.join(`user_${socket.user._id}`);

    // Join user to all their conversation rooms
    joinUserConversations(socket, io);

    // ===================== CONVERSATION MANAGEMENT =====================

    /**
     * Create a new conversation (individual or group)
     * Event: conversation:create
     * Data: { type: 'individual'|'group', participants: [userId], name?, description?, isPrivate? }
     */
    socket.on("conversation:create", async (data) => {
      try {
        const {
          type,
          participants,
          name,
          description,
          isPrivate = false,
        } = data;
        const creatorId = socket.user._id;

        // Validate conversation type
        if (!["individual", "group"].includes(type)) {
          return socket.emit("conversation:error", {
            error: "Invalid conversation type. Must be 'individual' or 'group'",
          });
        }

        // Validate participants
        if (
          !participants ||
          !Array.isArray(participants) ||
          participants.length === 0
        ) {
          return socket.emit("conversation:error", {
            error: "Participants array is required and cannot be empty",
          });
        }

        // For individual chats, ensure exactly one other participant
        if (type === "individual" && participants.length !== 1) {
          return socket.emit("conversation:error", {
            error:
              "Individual conversations must have exactly one other participant",
          });
        }

        // For group chats, ensure minimum participants and require name
        if (type === "group") {
          if (participants.length < 2) {
            return socket.emit("conversation:error", {
              error:
                "Group conversations must have at least 2 other participants",
            });
          }
          if (!name || name.trim().length === 0) {
            return socket.emit("conversation:error", {
              error: "Group conversations must have a name",
            });
          }
        }

        // Add creator to participants if not already included
        const allParticipants = [
          ...new Set([creatorId.toString(), ...participants]),
        ];

        // Validate all participants exist
        const existingUsers = await User.find({
          _id: { $in: allParticipants },
        }).select("_id");

        if (existingUsers.length !== allParticipants.length) {
          return socket.emit("conversation:error", {
            error: "One or more participants don't exist",
          });
        }

        // For individual chats, check if conversation already exists
        if (type === "individual") {
          const existingConversation = await Conversation.findOne({
            type: "individual",
            participants: { $all: allParticipants, $size: 2 },
          });

          if (existingConversation) {
            return socket.emit("conversation:created", {
              conversation: existingConversation,
              isExisting: true,
            });
          }
        }

        // Create conversation
        const conversationData = {
          type,
          participants: allParticipants,
          createdBy: creatorId,
          lastMessage: null,
          unreadCounts: new Map(
            allParticipants.map((id) => [id.toString(), 0])
          ),
          isPrivate,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add group-specific fields
        if (type === "group") {
          conversationData.name = name.trim();
          conversationData.description = description?.trim() || "";
          conversationData.admins = [creatorId];
          conversationData.settings = {
            allowMembersToAddOthers: true,
            allowMembersToEditInfo: false,
            onlyAdminsCanMessage: false,
          };
        }

        const conversation = await Conversation.create(conversationData);

        // Join all participants to the conversation room
        await joinParticipantsToRoom(io, conversation._id, allParticipants);

        // Emit conversation created event to all participants
        io.to(`conversation_${conversation._id}`).emit("conversation:created", {
          conversation,
          isExisting: false,
        });

        // Send notifications to participants (except creator)
        await sendConversationNotifications(
          io,
          conversation,
          creatorId,
          "created"
        );

        console.log(
          `${type} conversation ${conversation._id} created by ${creatorId}`
        );
      } catch (error) {
        console.error("Error creating conversation:", error);
        socket.emit("conversation:error", {
          error: error.message,
        });
      }
    });

    /**
     * Join a conversation room
     * Event: conversation:join
     * Data: { conversationId }
     */
    socket.on("conversation:join", async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (
          !conversation ||
          !conversation.participants.includes(socket.user._id)
        ) {
          return socket.emit("conversation:error", {
            error: "Access denied or conversation not found",
          });
        }

        socket.join(`conversation_${conversationId}`);

        // Track user presence in conversation
        if (!userPresence.has(conversationId)) {
          userPresence.set(conversationId, new Set());
        }
        userPresence.get(conversationId).add(socket.user._id.toString());

        // Broadcast user joined to other participants
        socket
          .to(`conversation_${conversationId}`)
          .emit("conversation:user_joined", {
            userId: socket.user._id,
            conversationId,
            timestamp: new Date(),
          });

        console.log(
          `User ${socket.user._id} joined conversation ${conversationId}`
        );
      } catch (error) {
        console.error("Error joining conversation:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    /**
     * Leave a conversation room
     * Event: conversation:leave
     * Data: { conversationId }
     */
    socket.on("conversation:leave", async ({ conversationId }) => {
      try {
        socket.leave(`conversation_${conversationId}`);

        // Remove user from presence tracking
        if (userPresence.has(conversationId)) {
          userPresence.get(conversationId).delete(socket.user._id.toString());
        }

        // Broadcast user left to other participants
        socket
          .to(`conversation_${conversationId}`)
          .emit("conversation:user_left", {
            userId: socket.user._id,
            conversationId,
            timestamp: new Date(),
          });

        console.log(
          `User ${socket.user._id} left conversation ${conversationId}`
        );
      } catch (error) {
        console.error("Error leaving conversation:", error);
      }
    });

    /**
     * Update group conversation info (admin only)
     * Event: conversation:update_info
     * Data: { conversationId, name?, description?, settings? }
     */
    socket.on("conversation:update_info", async (data) => {
      try {
        const { conversationId, name, description, settings } = data;
        const userId = socket.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit("conversation:error", {
            error: "Conversation not found",
          });
        }

        // Check if user is admin for group conversations
        if (
          conversation.type === "group" &&
          !conversation.admins.includes(userId)
        ) {
          return socket.emit("conversation:error", {
            error: "Only admins can update group information",
          });
        }

        // Update fields
        const updateData = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined)
          updateData.description = description.trim();
        if (settings !== undefined)
          updateData.settings = { ...conversation.settings, ...settings };

        await Conversation.findByIdAndUpdate(conversationId, updateData);

        // Broadcast update to all participants
        io.to(`conversation_${conversationId}`).emit(
          "conversation:info_updated",
          {
            conversationId,
            updatedBy: userId,
            updates: updateData,
            timestamp: new Date(),
          }
        );
      } catch (error) {
        console.error("Error updating conversation info:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    /**
     * Add members to group conversation (admin only)
     * Event: conversation:add_members
     * Data: { conversationId, memberIds: [userId] }
     */
    socket.on("conversation:add_members", async (data) => {
      try {
        const { conversationId, memberIds } = data;
        const userId = socket.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.type !== "group") {
          return socket.emit("conversation:error", {
            error: "Group conversation not found",
          });
        }

        // Check permissions
        const canAddMembers =
          conversation.admins.includes(userId) ||
          conversation.settings.allowMembersToAddOthers;

        if (!canAddMembers) {
          return socket.emit("conversation:error", {
            error: "You don't have permission to add members",
          });
        }

        // Validate new members
        const newMembers = memberIds.filter(
          (id) => !conversation.participants.includes(id)
        );
        if (newMembers.length === 0) {
          return socket.emit("conversation:error", {
            error: "No new members to add",
          });
        }

        // Verify users exist
        const existingUsers = await User.find({
          _id: { $in: newMembers },
        }).select("_id");

        if (existingUsers.length !== newMembers.length) {
          return socket.emit("conversation:error", {
            error: "One or more users don't exist",
          });
        }

        // Add members
        await Conversation.findByIdAndUpdate(conversationId, {
          $addToSet: { participants: { $each: newMembers } },
          $set: { updatedAt: new Date() },
        });

        // Join new members to conversation room
        await joinParticipantsToRoom(io, conversationId, newMembers);

        // Broadcast member addition
        io.to(`conversation_${conversationId}`).emit(
          "conversation:members_added",
          {
            conversationId,
            addedBy: userId,
            newMembers,
            timestamp: new Date(),
          }
        );

        // Send notifications to new members
        for (const memberId of newMembers) {
          await sendRealTimeNotification(io, {
            recipientId: memberId,
            senderId: userId,
            type: "group_added",
            relatedItem: conversationId,
            metadata: {
              conversationName: conversation.name,
              conversationId,
            },
          });
        }
      } catch (error) {
        console.error("Error adding members:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    /**
     * Remove member from group conversation (admin only)
     * Event: conversation:remove_member
     * Data: { conversationId, memberId }
     */
    socket.on("conversation:remove_member", async (data) => {
      try {
        const { conversationId, memberId } = data;
        const userId = socket.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || conversation.type !== "group") {
          return socket.emit("conversation:error", {
            error: "Group conversation not found",
          });
        }

        // Check if user is admin
        if (!conversation.admins.includes(userId)) {
          return socket.emit("conversation:error", {
            error: "Only admins can remove members",
          });
        }

        // Can't remove other admins
        if (conversation.admins.includes(memberId)) {
          return socket.emit("conversation:error", {
            error: "Cannot remove admin members",
          });
        }

        // Remove member
        await Conversation.findByIdAndUpdate(conversationId, {
          $pull: { participants: memberId },
          $set: { updatedAt: new Date() },
        });

        // Remove from conversation room
        const memberSocketId = connectedUsers.get(memberId.toString());
        if (memberSocketId) {
          const memberSocket = io.sockets.sockets.get(memberSocketId);
          if (memberSocket) {
            memberSocket.leave(`conversation_${conversationId}`);
          }
        }

        // Broadcast member removal
        io.to(`conversation_${conversationId}`).emit(
          "conversation:member_removed",
          {
            conversationId,
            removedBy: userId,
            removedMember: memberId,
            timestamp: new Date(),
          }
        );

        // Notify removed member
        io.to(`user_${memberId}`).emit("conversation:removed_from_group", {
          conversationId,
          removedBy: userId,
          conversationName: conversation.name,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error removing member:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    /**
     * Leave group conversation
     * Event: conversation:leave_group
     * Data: { conversationId }
     */
    socket.on("conversation:leave_group", async ({ conversationId }) => {
      try {
        const userId = socket.user._id;
        const conversation = await Conversation.findById(conversationId);

        if (!conversation || conversation.type !== "group") {
          return socket.emit("conversation:error", {
            error: "Group conversation not found",
          });
        }

        // If user is the only admin, transfer admin rights or prevent leaving
        if (
          conversation.admins.length === 1 &&
          conversation.admins.includes(userId)
        ) {
          const otherParticipants = conversation.participants.filter(
            (id) => !id.equals(userId)
          );

          if (otherParticipants.length > 0) {
            // Transfer admin to first participant
            await Conversation.findByIdAndUpdate(conversationId, {
              $pull: { participants: userId, admins: userId },
              $addToSet: { admins: otherParticipants[0] },
              $set: { updatedAt: new Date() },
            });
          } else {
            // Delete conversation if no other participants
            await Conversation.findByIdAndDelete(conversationId);
            return socket.emit("conversation:left_group", {
              conversationId,
              deleted: true,
            });
          }
        } else {
          // Remove user from conversation
          await Conversation.findByIdAndUpdate(conversationId, {
            $pull: { participants: userId, admins: userId },
            $set: { updatedAt: new Date() },
          });
        }

        // Leave room
        socket.leave(`conversation_${conversationId}`);

        // Broadcast user left
        socket
          .to(`conversation_${conversationId}`)
          .emit("conversation:member_left", {
            conversationId,
            leftMember: userId,
            timestamp: new Date(),
          });

        socket.emit("conversation:left_group", {
          conversationId,
          deleted: false,
        });
      } catch (error) {
        console.error("Error leaving group:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    // ===================== MESSAGE HANDLERS =====================

    /**
     * Send a message to a conversation
     * Event: message:send
     * Data: { conversationId?, recipientId?, content?, media?, replyTo?, clientId? }
     */
    socket.on("message:send", async (data) => {
      try {
        // Run this once when deploying your updates
        async function migrateConversations() {
          try {
            await Conversation.fixCorruptedConversations();
            console.log("Conversation migration completed successfully");
          } catch (err) {
            console.error("Conversation migration failed:", err);
          }
        }

        // Call this during application startup
        migrateConversations();
        const {
          conversationId,
          recipientId,
          content,
          media,
          replyTo,
          clientId,
        } = data;
        const senderId = socket.user._id;
        console.log(
          `Message send request from ${senderId} in conversation ${
            conversationId || "N/A"
          }`
        );
        if (!isValidObjectId(recipientId) && !isValidObjectId(conversationId)) {
          console.log("Invalid sender ID format:", recipientId);
          console.log("Invalid sender ID format:", conversationId);
          throw new Error("Invalid ID format");
        }
        const recipientIdOBJ = new mongoose.Types.ObjectId(recipientId);

        // Validate message content
        if (!content && (!media || media.length === 0)) {
          return socket.emit("message:error", {
            error: "Message must have content or media",
            clientId,
          });
        }

        let conversation;

        // Handle conversation lookup/creation
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            return socket.emit("message:error", {
              error: "Conversation not found",
              clientId,
            });
          }
        } else if (recipientIdOBJ) {
          // Find or create individual conversation

          conversation = await Conversation.findOne({
            type: "individual",
            participants: { $all: [senderId, recipientIdOBJ], $size: 2 },
          });
          if (!conversation) {
            // Create new individual conversation
            const participantsExist =
              (await User.countDocuments({
                _id: { $in: [senderId, recipientIdOBJ] },
              })) === 2;

            if (!participantsExist) {
              return socket.emit("message:error", {
                error: "Recipient not found",
                clientId,
              });
            }
            // console.log("Creating new individual conversation");
            // console.log(senderId, recipientIdOBJ);
            conversation = await Conversation.findOrCreateDirectConversation([
              senderId,
              recipientIdOBJ,
            ]);

            // Join participants to room
            await joinParticipantsToRoom(io, conversation._id, [
              senderId,
              recipientIdOBJ,
            ]);
          }
        } else {
          return socket.emit("message:error", {
            error: "Either conversationId or recipientId is required",
            clientId,
          });
        }
        // console.log(conversation.participants)
        // Verify user is a participant
        if (
          !conversation.participants.some(
            (p) => p.user.toString() === senderId.toString()
          )
        ) {
          return socket.emit("message:error", {
            error: "You are not a participant in this conversation",
            clientId,
          });
        }

        // Check group message permissions
        if (
          conversation.type === "group" &&
          conversation.settings.onlyAdminsCanMessage &&
          !conversation.admins.includes(senderId)
        ) {
          return socket.emit("message:error", {
            error: "Only admins can send messages in this group",
            clientId,
          });
        }

        // Create message
        const messageData = {
          conversation: conversation._id,
          sender: senderId,
          content: content || "",
          media: media || [],
          replyTo: replyTo || null,
          status: "sent",
          metadata: {
            clientId,
            deviceId: socket.handshake.headers["user-agent"] || "unknown",
            ipAddress: socket.handshake.address,
          },
        };
        const message = await Message.createMessage(messageData);
        // console.log(message);

        // Update conversation's last message and unread counts
        await Conversation.updateLastMessage(
          conversation._id,
          message._id,
          senderId
        );

        // Emit message to all participants in the conversation
        io.to(`conversation_${conversation._id}`).emit("message:new", {
          message,
          conversationId: conversation._id,
        });

        // Emit delivery confirmation to sender
        socket.emit("message:sent", {
          messageId: message._id,
          conversationId: conversation._id,
          clientId,
          timestamp: message.createdAt,
        });

        // Send push notifications to offline participants
        // await sendMessageNotifications(io, conversation, message, senderId);

        console.log(
          `Message sent in conversation ${conversation._id} by user ${senderId}`
        );
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message:error", {
          error: error.message,
          clientId: data.clientId,
        });
      }
    });

    /**
     * Handle message delivery confirmation
     * Event: message:delivered
     * Data: { messageId, conversationId }
     */
    socket.on("message:delivered", async ({ messageId, conversationId }) => {
      try {
        await Message.updateStatus(messageId, "delivered", socket.user._id);

        // Notify sender about delivery
        socket.to(`conversation_${conversationId}`).emit("message:status", {
          messageId,
          status: "delivered",
          userId: socket.user._id,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error updating message delivery status:", error);
      }
    });

    /**
     * Handle message read confirmation
     * Event: message:read
     * Data: { messageId, conversationId }
     */
    socket.on("message:read", async ({ messageId, conversationId }) => {
      try {
        if (!isValidObjectId(conversationId) || !isValidObjectId(messageId)) {
          throw new Error("Invalid ID format");
        }
        await Message.updateStatus(messageId, "read", socket.user._id);

        // Mark conversation as read for this user
        await Conversation.markAsRead(conversationId, "read", socket.user._id);

        // Notify sender about read status
        socket.to(`conversation_${conversationId}`).emit("message:status", {
          messageId,
          status: "read",
          userId: socket.user._id,
          timestamp: new Date(),
        });

        // Send updated unread count
        await emitUnreadCounts(socket, conversationId);
      } catch (error) {
        console.error("Error updating message read status:", error);
      }
    });

    /**
     * Delete message
     * Event: message:delete
     * Data: { messageId, conversationId, deleteFor: 'me'|'everyone' }
     */
    socket.on("message:delete", async (data) => {
      try {
        const { messageId, conversationId, deleteFor = "me" } = data;
        const userId = socket.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit("message:error", {
            error: "Message not found",
          });
        }

        // Check if user can delete this message
        if (!message.sender.equals(userId)) {
          return socket.emit("message:error", {
            error: "You can only delete your own messages",
          });
        }

        if (deleteFor === "everyone") {
          // Delete for everyone (within time limit)
          const timeLimit = 10 * 60 * 1000; // 10 minutes
          const messageAge = Date.now() - message.createdAt.getTime();

          if (messageAge > timeLimit) {
            return socket.emit("message:error", {
              error:
                "Messages can only be deleted for everyone within 10 minutes",
            });
          }

          await Message.findByIdAndUpdate(messageId, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
          });

          // Broadcast deletion to all participants
          io.to(`conversation_${conversationId}`).emit("message:deleted", {
            messageId,
            conversationId,
            deletedBy: userId,
            deleteFor: "everyone",
            timestamp: new Date(),
          });
        } else {
          // Delete for me only
          await Message.findByIdAndUpdate(messageId, {
            $addToSet: { deletedFor: userId },
          });

          // Only notify the user who deleted it
          socket.emit("message:deleted", {
            messageId,
            conversationId,
            deletedBy: userId,
            deleteFor: "me",
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("message:error", { error: error.message });
      }
    });

    // ===================== TYPING INDICATORS =====================

    /**
     * Start typing indicator
     * Event: typing:start
     * Data: { conversationId }
     */
    socket.on("typing:start", ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit("typing:start", {
        userId: socket.user._id,
        conversationId,
        timestamp: new Date(),
      });
    });

    /**
     * Stop typing indicator
     * Event: typing:stop
     * Data: { conversationId }
     */
    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit("typing:stop", {
        userId: socket.user._id,
        conversationId,
        timestamp: new Date(),
      });
    });

    // ===================== UNREAD COUNT MANAGEMENT =====================

    /**
     * Mark conversation as read
     * Event: conversation:mark_read
     * Data: { conversationId }
     */
    socket.on("conversation:mark_read", async ({ conversationId }) => {
      try {
        await Conversation.markAsRead(conversationId, socket.user._id);
        await emitUnreadCounts(socket, conversationId);
      } catch (error) {
        console.error("Error marking conversation as read:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    /**
     * Request unread count for specific conversation
     * Event: conversation:request_unread_count
     * Data: { conversationId }
     */
    socket.on(
      "conversation:request_unread_count",
      async ({ conversationId }) => {
        try {
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            return socket.emit("conversation:error", {
              error: "Conversation not found",
            });
          }

          const unreadCount =
            conversation.unreadCounts.get(socket.user._id.toString()) || 0;
          socket.emit("conversation:unread_count", {
            conversationId,
            unreadCount,
          });
        } catch (error) {
          console.error("Error getting conversation unread count:", error);
          socket.emit("conversation:error", { error: error.message });
        }
      }
    );

    /**
     * Request total unread count across all conversations
     * Event: conversation:request_total_unread_count
     */
    socket.on("conversation:request_total_unread_count", async () => {
      try {
        await emitTotalUnreadCount(socket);
      } catch (error) {
        console.error("Error getting total unread count:", error);
        socket.emit("conversation:error", { error: error.message });
      }
    });

    // ===================== NOTIFICATION HANDLERS =====================

    /**
     * Mark notification as read
     * Event: notification:read
     * Data: { notificationIds: [id] }
     */
    socket.on("notification:read", async ({ notificationIds }) => {
      try {
        await Notification.updateMany(
          {
            _id: { $in: notificationIds },
            recipient: socket.user._id,
          },
          { $set: { isRead: true } }
        );

        const unreadCount = await Notification.countDocuments({
          recipient: socket.user._id,
          isRead: false,
        });

        socket.emit("notification:count", { unreadCount });
      } catch (error) {
        console.error("Error marking notifications as read:", error);
        socket.emit("notification:error", { error: error.message });
      }
    });

    /**
     * Request notification count
     * Event: notification:request_count
     */
    socket.on("notification:request_count", async () => {
      try {
        const unreadCount = await Notification.countDocuments({
          recipient: socket.user._id,
          isRead: false,
        });
        socket.emit("notification:count", { unreadCount });
      } catch (error) {
        console.error("Error getting notification count:", error);
        socket.emit("notification:error", { error: error.message });
      }
    });

    // ===================== PRESENCE AND STATUS =====================

    /**
     * Update user status
     * Event: user:update_status
     * Data: { status: 'online'|'away'|'busy'|'offline' }
     */
    socket.on("user:update_status", async ({ status }) => {
      try {
        const validStatuses = ["online", "away", "busy", "offline"];
        if (!validStatuses.includes(status)) {
          return socket.emit("user:error", {
            error: "Invalid status",
          });
        }

        await User.findByIdAndUpdate(socket.user._id, {
          status,
          lastSeen: new Date(),
        });

        // Broadcast status change to user's conversations
        const conversations = await Conversation.find({
          participants: socket.user._id,
        }).select("_id");

        conversations.forEach((conversation) => {
          socket
            .to(`conversation_${conversation._id}`)
            .emit("user:status_changed", {
              userId: socket.user._id,
              status,
              timestamp: new Date(),
            });
        });
      } catch (error) {
        console.error("Error updating user status:", error);
        socket.emit("user:error", { error: error.message });
      }
    });

    // ===================== DISCONNECT HANDLER =====================

    /**
     * Handle user disconnection
     */
    socket.on("disconnect", () => {
      console.log(`Disconnected: ${socket.id} (User: ${socket.user._id})`);

      // Remove from connected users
      connectedUsers.delete(socket.user._id.toString());

      // Remove from presence tracking
      userPresence.forEach((users, conversationId) => {
        users.delete(socket.user._id.toString());
      });

      // Update user online status with delay to account for reconnects
      setTimeout(async () => {
        if (!connectedUsers.has(socket.user._id.toString())) {
          await updateUserOnlineStatus(socket.user._id, false);
        }
      }, 5000); // 5 second delay
    });
  });

  return io;
};

// ===================== HELPER FUNCTIONS =====================

/**
 * Update user online status
 * @param {String} userId - User ID
 * @param {Boolean} isOnline - Online status
 */
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: new Date(),
      status: isOnline ? "online" : "offline",
    });
  } catch (error) {
    console.error("Error updating user online status:", error);
  }
};

/**
 * Join user to all their conversation rooms
 * @param {Object} socket - Socket instance
 * @param {Object} io - Socket.IO server instance
 */
const joinUserConversations = async (socket, io) => {
  try {
    const conversations = await Conversation.find({
      participants: socket.user._id,
    }).select("_id participants type");

    conversations.forEach((conversation) => {
      socket.join(`conversation_${conversation._id}`);

      // Track user presence
      if (!userPresence.has(conversation._id.toString())) {
        userPresence.set(conversation._id.toString(), new Set());
      }
      userPresence
        .get(conversation._id.toString())
        .add(socket.user._id.toString());
    });

    console.log(
      `User ${socket.user._id} joined ${conversations.length} conversation rooms`
    );
  } catch (error) {
    console.error("Error joining user conversations:", error);
  }
};

/**
 * Join participants to a conversation room
 * @param {Object} io - Socket.IO server instance
 * @param {String} conversationId - Conversation ID
 * @param {Array} participantIds - Array of participant IDs
 */
const joinParticipantsToRoom = async (io, conversationId, participantIds) => {
  try {
    participantIds.forEach((participantId) => {
      const socketId = connectedUsers.get(participantId.toString());
      if (socketId) {
        const participantSocket = io.sockets.sockets.get(socketId);
        if (participantSocket) {
          participantSocket.join(`conversation_${conversationId}`);
        }
      }
    });
  } catch (error) {
    console.error("Error joining participants to room:", error);
  }
};

/**
 * Send conversation notifications
 * @param {Object} io - Socket.IO server instance
 * @param {Object} conversation - Conversation object
 * @param {String} senderId - Sender ID
 * @param {String} action - Action type ('created', 'added', etc.)
 */
const sendConversationNotifications = async (
  io,
  conversation,
  senderId,
  action
) => {
  try {
    const recipients = conversation.participants.filter(
      (id) => !id.equals(senderId)
    );

    for (const recipientId of recipients) {
      let notificationType, metadata;

      if (conversation.type === "individual") {
        notificationType = "message";
        metadata = { conversationId: conversation._id };
      } else {
        notificationType =
          action === "created" ? "group_created" : "group_added";
        metadata = {
          conversationId: conversation._id,
          conversationName: conversation.name,
        };
      }

      await sendRealTimeNotification(io, {
        recipientId,
        senderId,
        type: notificationType,
        relatedItem: conversation._id,
        metadata,
      });
    }
  } catch (error) {
    console.error("Error sending conversation notifications:", error);
  }
};

/**
 * Send message notifications to offline participants
 * @param {Object} io - Socket.IO server instance
 * @param {Object} conversation - Conversation object
 * @param {Object} message - Message object
 * @param {String} senderId - Sender ID
 */
const sendMessageNotifications = async (
  io,
  conversation,
  message,
  senderId
) => {
  try {
    // Get offline participants
    const offlineParticipants = await User.find({
      _id: { $in: conversation.participants },
      _id: { $ne: senderId },
      isOnline: false,
    });

    // Send notifications to offline users
    for (const participant of offlineParticipants) {
      await sendRealTimeNotification(io, {
        recipientId: participant._id,
        senderId,
        type: "message",
        relatedItem: message._id,
        metadata: {
          conversationId: conversation._id,
          conversationType: conversation.type,
          conversationName: conversation.name || null,
          messagePreview: message.content.substring(0, 100) || "Media message",
        },
      });
    }
  } catch (error) {
    console.error("Error sending message notifications:", error);
  }
};

/**
 * Emit unread counts for conversation and total
 * @param {Object} socket - Socket instance
 * @param {String} conversationId - Conversation ID
 */
const emitUnreadCounts = async (socket, conversationId) => {
  try {
    // Get conversation unread count
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      const unreadCount =
        conversation.unreadCounts.get(socket.user._id.toString()) || 0;
      socket.emit("conversation:unread_count", {
        conversationId,
        unreadCount,
      });
    }

    // Get total unread count
    await emitTotalUnreadCount(socket);
  } catch (error) {
    console.error("Error emitting unread counts:", error);
  }
};

/**
 * Emit total unread count across all conversations
 * @param {Object} socket - Socket instance
 */
const emitTotalUnreadCount = async (socket) => {
  try {
    const conversations = await Conversation.find({
      participants: socket.user._id,
    });

    let totalUnreadCount = 0;
    conversations.forEach((conversation) => {
      const unreadCount =
        conversation.unreadCounts.get(socket.user._id.toString()) || 0;
      totalUnreadCount += unreadCount;
    });

    socket.emit("conversation:total_unread_count", {
      totalUnreadCount,
    });
  } catch (error) {
    console.error("Error calculating total unread count:", error);
  }
};

/**
 * Enhanced real-time notification sender
 * @param {Object} io - Socket.IO server instance
 * @param {Object} params - Notification parameters
 * @param {String} params.recipientId - Recipient user ID
 * @param {String} params.senderId - Sender user ID
 * @param {String} params.type - Notification type
 * @param {String} [params.relatedItem] - Related item ID
 * @param {Object} [params.metadata] - Additional metadata
 */
export const sendRealTimeNotification = async (io, params) => {
  try {
    // Use your existing notification service
    const notification = await sendNotification({
      ...params,
      io, // Pass io instance for real-time delivery
    });

    if (!notification) return; // Skip if notification was blocked by preferences

    // Emit to recipient's room
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "username profile.avatar")
      .populate({
        path: "relatedItem",
        select: "content images media name",
        options: { retainNullValues: true },
      })
      .lean();

    io.to(`user_${params.recipientId}`).emit(
      "notification:new",
      populatedNotification
    );

    // Update unread count
    const unreadCount = await Notification.countDocuments({
      recipient: params.recipientId,
      isRead: false,
    });

    io.to(`user_${params.recipientId}`).emit("notification:count", {
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to send real-time notification:", error);
  }
};

// ===================== EXPORTED UTILITY FUNCTIONS =====================

/**
 * Broadcast typing indicator
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 * @param {Boolean} isTyping - Typing status
 */
export const broadcastTyping = (io, userId, conversationId, isTyping) => {
  io.to(`conversation_${conversationId}`).emit(
    isTyping ? "typing:start" : "typing:stop",
    {
      userId,
      conversationId,
      timestamp: new Date(),
    }
  );
};

/**
 * Join user to conversation room
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 */
export const joinConversation = (io, userId, conversationId) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(`conversation_${conversationId}`);

      // Track presence
      if (!userPresence.has(conversationId)) {
        userPresence.set(conversationId, new Set());
      }
      userPresence.get(conversationId).add(userId.toString());
    }
  }
};

/**
 * Remove user from conversation room
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 */
export const leaveConversation = (io, userId, conversationId) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`conversation_${conversationId}`);

      // Remove from presence tracking
      if (userPresence.has(conversationId)) {
        userPresence.get(conversationId).delete(userId.toString());
      }
    }
  }
};

/**
 * Broadcast message to all participants in a conversation
 * @param {Object} io - Socket.IO server instance
 * @param {String} conversationId - Conversation ID
 * @param {Object} message - Message object
 */
export const broadcastMessage = (io, conversationId, message) => {
  io.to(`conversation_${conversationId}`).emit("message:new", {
    message,
    conversationId,
    timestamp: new Date(),
  });
};

/**
 * Update message status for all participants
 * @param {Object} io - Socket.IO server instance
 * @param {String} conversationId - Conversation ID
 * @param {String} messageId - Message ID
 * @param {String} status - New status
 * @param {String} userId - User ID who updated the status
 */
export const broadcastMessageStatus = (
  io,
  conversationId,
  messageId,
  status,
  userId
) => {
  io.to(`conversation_${conversationId}`).emit("message:status", {
    messageId,
    status,
    userId,
    timestamp: new Date(),
  });
};

/**
 * Notify user about unread count changes
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 * @param {Number} unreadCount - New unread count
 */
export const notifyUnreadCount = (io, userId, conversationId, unreadCount) => {
  io.to(`user_${userId}`).emit("conversation:unread_count", {
    conversationId,
    unreadCount,
    timestamp: new Date(),
  });
};

/**
 * Broadcast conversation update to all participants
 * @param {Object} io - Socket.IO server instance
 * @param {String} conversationId - Conversation ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastConversationUpdate = (
  io,
  conversationId,
  event,
  data
) => {
  io.to(`conversation_${conversationId}`).emit(event, {
    ...data,
    conversationId,
    timestamp: new Date(),
  });
};

/**
 * Get online users in a conversation
 * @param {String} conversationId - Conversation ID
 * @returns {Array} Array of online user IDs
 */
export const getOnlineUsersInConversation = (conversationId) => {
  const users = userPresence.get(conversationId);
  return users ? Array.from(users) : [];
};

/**
 * Check if user is online
 * @param {String} userId - User ID
 * @returns {Boolean} Online status
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

/**
 * Get user's socket ID
 * @param {String} userId - User ID
 * @returns {String|null} Socket ID or null if offline
 */
export const getUserSocketId = (userId) => {
  return connectedUsers.get(userId.toString()) || null;
};

/**
 * Broadcast to specific user
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, {
    ...data,
    timestamp: new Date(),
  });
};

/**
 * Force disconnect user
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} reason - Disconnect reason
 */
export const forceDisconnectUser = (
  io,
  userId,
  reason = "Force disconnect"
) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("force_disconnect", { reason });
      socket.disconnect(true);
    }
  }
};

/**
 * Get connected users count
 * @returns {Number} Number of connected users
 */
export const getConnectedUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Get all connected users
 * @returns {Array} Array of connected user IDs
 */
export const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

/**
 * Clean up inactive presence tracking
 * This should be called periodically to clean up stale presence data
 */
export const cleanupPresenceTracking = () => {
  userPresence.forEach((users, conversationId) => {
    const activeUsers = new Set();
    users.forEach((userId) => {
      if (connectedUsers.has(userId)) {
        activeUsers.add(userId);
      }
    });
    userPresence.set(conversationId, activeUsers);
  });
};

// Set up periodic cleanup (every 5 minutes)
setInterval(cleanupPresenceTracking, 5 * 60 * 1000);
