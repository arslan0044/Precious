import { getAllConversations, getConversationMessages } from "./service.js";
import mongoose from "mongoose";

/**
 * @desc    Get all conversations for a user
 * @route   GET /api/conversations/:userId
 * @access  Private
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} - Returns conversations with pagination info or error
 */
export async function getConversations(req, res) {
  try {
    const { userId } = req.params;
    // Validate userId from params matches authenticated user
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access to conversations",
      });
    }

    // Extract pagination and options from query params
    const { page = 1, limit = 20, minimal = "false" } = req.query;

    // Convert query params to appropriate types
    const options = {
      page: parseInt(page),
      limit: parseInt(limit) > 50 ? 50 : parseInt(limit), // Enforce max limit
      populateParticipants: minimal.toLowerCase() !== "true",
      populateLastMessage: minimal.toLowerCase() !== "true",
    };

    // Call the service
    const result = await getAllConversations(userId, options);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // Format the response
    const response = {
      success: true,
      data: result.conversations,
      pagination: result.pagination,
    };

    // Cache control headers for performance
    res.set("Cache-Control", "private, max-age=60");

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getConversations controller:", error);

    // Handle specific error types
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID format",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error while retrieving conversations",
    });
  }
}

export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    // console.log(userId);
    // Validate conversationId format
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid conversation ID format",
      });
    }

    // Parse query parameters with validation
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const includeSystem = req.query.includeSystem !== "false";
    const includeDeleted = req.query.includeDeleted === "true";
    const sort = ["asc", "desc"].includes(req.query.sort)
      ? req.query.sort
      : "desc";

    // Validate date filters if provided
    let before, after;
    if (req.query.before) {
      before = new Date(req.query.before);
      if (isNaN(before.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid before date format. Use ISO 8601 format",
        });
      }
    }
    if (req.query.after) {
      after = new Date(req.query.after);
      if (isNaN(after.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid after date format. Use ISO 8601 format",
        });
      }
    }

    // Call the service
    const result = await getConversationMessages(conversationId, userId, {
      page,
      limit,
      before: req.query.before,
      after: req.query.after,
      includeSystem,
      includeDeleted,
      sort,
    });

    // Handle service errors
    if (!result.success) {
      const statusCode = result.error.includes("not found")
        ? 404
        : result.error.includes("access denied")
        ? 403
        : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
      });
    }

    // Set cache headers for performance
    res.set("Cache-Control", "private, max-age=60, stale-while-revalidate=30");

    // Successful response
    return res.status(200).json({
      success: true,
      messages: result.messages,
      pagination: result.pagination,
      conversationInfo: result.conversationInfo,
    });
  } catch (error) {
    console.error("Error in getMessages controller:", error);

    // Handle specific error types
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID format",
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      error: "Internal server error while retrieving messages",
    });
  }
}
