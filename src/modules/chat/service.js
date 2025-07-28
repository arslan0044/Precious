import Conversation from "../../models/conversation.js";
import mongoose from "mongoose";
import User from "../../models/User.js";
import Message from "../../models/message.js";

/**
 * Service to get all conversations for a user with pagination and population
 * @param {string} userId - The ID of the user whose conversations to retrieve
 * @param {Object} options - Additional options for the query
 * @param {number} [options.page=1] - Page number for pagination
 * @param {number} [options.limit=20] - Number of conversations per page
 * @param {boolean} [options.populateParticipants=true] - Whether to populate participant details
 * @param {boolean} [options.populateLastMessage=true] - Whether to populate the last message
 * @returns {Promise<Object>} - Returns an object containing conversations and pagination info
 */
export async function getAllConversations(userId, options = {}) {
  try {
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }
    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Set default options
    const {
      page = 1,
      limit = 20,
      populateParticipants = true,
      populateLastMessage = true,
    } = options;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // In the query construction:
    const query = Conversation.find({
      "participants.user": { $in: [userIdObj] }, // Query nested user field
      "participants.isActive": true, // Only include active participants
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Population options
    if (populateParticipants) {
      query.populate({
        path: "participants.user", // Note the nested path
        // select: "_id username profilePic status lastSeen",
        match: { _id: { $ne: userIdObj } },
      });
    }

    if (populateLastMessage) {
      query.populate({
        path: "lastMessage",
        select: "sender content createdAt read", // Only include necessary fields
        populate: {
          path: "sender",
          select: "username profilePic", // Basic sender info
        },
      });
    }

    // Execute the query
    const conversations = await query.exec();

    // Get total count for pagination info
    const total = await Conversation.countDocuments({
      "participants.user": { $in: [userIdObj] },
      "participants.isActive": true,
    });

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      conversations,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Error in getAllConversations service:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve conversations",
    };
  }
}

/**
 * Service to get all messages in a conversation
 * @param {string} conversationId - ID of the conversation
 * @param {string} userId - ID of the requesting user (for permission checks)
 * @param {Object} options - Additional options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=50] - Messages per page (max 100)
 * @param {string} [options.before] - Get messages before this date (ISO string)
 * @param {string} [options.after] - Get messages after this date (ISO string)
 * @param {boolean} [options.includeSystem=true] - Include system messages
 * @param {boolean} [options.includeDeleted=false] - Include deleted messages
 * @param {string} [options.sort='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} - Messages with pagination info
 */
export async function getConversationMessages(
  conversationId,
  userId,
  options = {}
) {
  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error("Invalid conversation ID");
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const conversationIdObj = new mongoose.Types.ObjectId(conversationId);
    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationIdObj,
      "participants.user": userIdObj,
      "participants.isActive": true,
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    // Set default options
    const {
      page = 1,
      limit = 50,
      before = null,
      after = null,
      includeSystem = true,
      includeDeleted = false,
      sort = "desc",
    } = options;

    // Validate and adjust limit
    const adjustedLimit = Math.min(parseInt(limit), 100);

    // Calculate skip
    const skip = (page - 1) * adjustedLimit;

    // Build query conditions
    const conditions = {
      conversation: conversationIdObj,
    };

    // Date filters
    if (before) {
      conditions.createdAt = { $lt: new Date(before) };
    }
    if (after) {
      conditions.createdAt = { ...conditions.createdAt, $gt: new Date(after) };
    }

    // Message type filters
    if (!includeSystem) {
      conditions.messageType = { $ne: "system" };
    }

    // Deleted messages filter
    if (!includeDeleted) {
      conditions.$or = [
        { isDeleted: false },
        {
          isDeleted: true,
          "deleted.by": userIdObj, // Allow users to see their own deleted messages
        },
      ];
    }

    // Build query
    const query = Message.find(conditions)
      .sort({ createdAt: sort === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(adjustedLimit)
      .populate({
        path: "sender",
        // select: "_id username profilePic",
      })
      .populate({
        path: "replyTo",
        select: "content sender createdAt",
        populate: {
          path: "sender",
          // select: "username profilePic",
        },
      });

    // Execute query and get count in parallel
    const [messages, total] = await Promise.all([
      query.exec(),
      Message.countDocuments(conditions),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / adjustedLimit);

    return {
      success: true,
      messages,
      pagination: {
        total,
        page,
        limit: adjustedLimit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      conversationInfo: {
        id: conversation._id,
        type: conversation.type,
        name: conversation.name,
        participants: conversation.participants.length,
      },
    };
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return {
      success: false,
      error: error.message || "Failed to retrieve messages",
    };
  }
}
