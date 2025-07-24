import {
  userinfo,
  updatePassword,
  updateUser,
  requestFollow,
  rejectFollowRequest,
  acceptFollowRequest,
  unfollow,
  blockUser,
  unblockUser,
  getFollowStatus,
  getUserRelationships,
  getAllUsers
} from "./service.js";
import {
  InternalServerError,
  BadRequestError,
  ForbiddenError,
  ApiError,
} from "../../utils/apiError.js";
import redis from "../../config/redis.js";

/**
 * @desc Get logged-in user's information
 * @route GET /api/user/me
 * @access Private
 */
export async function userInfoController(req, res, next) {
  try {
    const userId = req.user._id;
    const user = await userinfo(userId);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(
      error instanceof Error ? error : new InternalServerError("Unknown error")
    );
  }
}

/**
 * Controller to update user password after verifying old password
 * Assumes `req.user.email` is set via authentication middleware
 */
export async function updatePasswordController(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const email = req.user?.email;

    if (!oldPassword || !newPassword)
      throw new BadRequestError("Old and new password are required");

    const result = await updatePassword(email, oldPassword, newPassword);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc Update the authenticated user's profile
 * @route PUT /api/user/profile
 * @access Private (requires JWT)
 */
export async function updateProfileController(req, res, next) {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const user = await userinfo(userId);

    if (user.status !== "active") {
      throw new ForbiddenError(
        `User account is ${user.status} and cannot be updated`
      );
    }

    const updatedUser = await updateUser(userId, updates);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Request to follow another user
 * @route   POST /api/users/:userId/follow
 * @access  Private
 * @param   {string} req.params.userId - ID of user to follow
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'following'|'requested' }
 */
export const requestFollowController = async (req, res, next) => {
  try {
    const result = await requestFollow(req.user._id, req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept a pending follow request
 * @route   POST /api/users/:requesterId/accept
 * @access  Private
 * @param   {string} req.params.requesterId - ID of user who requested to follow
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'following' }
 */
export const acceptFollowRequestController = async (req, res, next) => {
  try {
    const result = await acceptFollowRequest(
      req.user._id,
      req.params.requesterId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a pending follow request
 * @route   POST /api/users/:requesterId/reject
 * @access  Private
 * @param   {string} req.params.requesterId - ID of user who requested to follow
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'rejected' }
 */
export const rejectFollowRequestController = async (req, res, next) => {
  try {
    const result = await rejectFollowRequest(
      req.user._id,
      req.params.requesterId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/users/:userId/unfollow
 * @access  Private
 * @param   {string} req.params.userId - ID of user to unfollow
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'unfollowed' }
 */
export const unfollowUserController = async (req, res, next) => {
  try {
    const result = await unfollow(req.user._id, req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Block a user
 * @route   POST /api/users/:userId/block
 * @access  Private
 * @param   {string} req.params.userId - ID of user to block
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'blocked' }
 */
export const blockUserController = async (req, res, next) => {
  try {
    const result = await blockUser(req.user._id, req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unblock a user
 * @route   DELETE /api/users/:userId/unblock
 * @access  Private
 * @param   {string} req.params.userId - ID of user to unblock
 * @param   {string} req.user._id - ID of authenticated user
 * @returns {Object} { status: 'unblocked' }
 */
export const unblockUserController = async (req, res, next) => {
  try {
    const result = await unblockUser(req.user._id, req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get relationship status between users
 * @route   GET /api/user/:userId/status
 * @access  Private
 * @param   {string} req.params.userId - ID of profile user
 * @param   {string} req.user._id - ID of viewing user
 * @returns {Object} { status: 'self'|'blocked'|'following'|'requested'|'not_following', isFollowing: boolean, hasPendingRequest: boolean, isPrivate: boolean }
 */
export const getFollowStatusController = async (req, res, next) => {
  try {
    const result = await getFollowStatus(req.user._id, req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a user's relationships
 * @route   GET /api/user/:userId/relationships
 * @access  Private (user can only access their own relationships)
 */
export const getUserRelationshipsController = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id;
    // Validate that the requesting user can only access their own relationships
    if (userId !== requestingUserId.toString()) {
      throw new ForbiddenError("You can only view your own relationships");
    }
    console.log(userId, requestingUserId);

    // Get query parameters
    const {
      types = "followers,following,pendingFollowRequests,blockedUsers",
      include_counts = "true",
      limit = "100",
      page = "1",
    } = req.query;

    // Parse and validate parameters
    const relationshipTypes = types.split(",").filter(Boolean);
    const options = {
      includeCounts: include_counts === "true",
      limit: Math.min(parseInt(limit), 1000), // Cap at 1000 for safety
      page: Math.max(parseInt(page), 1),
    };

    // Generate cache key
    const cacheKey = `user:relationships:${userId}:${relationshipTypes.join(
      ","
    )}:${options.limit}:${options.page}`;

    // Try to get cached data
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Get fresh data from service
    const relationships = await getUserRelationships(
      userId,
      relationshipTypes,
      options
    );
    console.log("Fetched relationships:", relationships);
    // Cache the data for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(relationships));

    res.status(200).json(relationships);
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Relationship controller error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const getAllUsersController = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "",
    } = req.query;

    const users = await getAllUsers({
      page: Number(page),
      limit: Number(limit),
      sortBy,
      sortOrder,
      search: search.trim(),
    });

    res.status(200).json({
      success: true,
      data: users.data,
      meta: users.meta,
    });
  } catch (error) {
    next(
      error instanceof Error
        ? error
        : new InternalServerError("Unknown error")
    );
  }
};