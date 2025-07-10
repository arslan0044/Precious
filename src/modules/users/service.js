import User from "../../models/User.js";
import {
  ApiError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  DatabaseError,
} from "../../utils/apiError.js";
import mongoose from "mongoose";
export async function userinfo(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new BadRequestError("User not found");
  return user;
}

/**
 * @function updatePassword
 * @description Securely updates the user's password after verifying the old one
 * @param {string} email - User email (must be verified via middleware)
 * @param {string} oldPassword - Current password to verify identity
 * @param {string} newPassword - New password to be stored
 * @returns {Object} Success message
 * @throws {NotFoundError} If user not found
 * @throws {UnauthorizedError} If old password is incorrect
 * @throws {BadRequestError} If new password is same as old one
 */
export async function updatePassword(email, oldPassword, newPassword) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new NotFoundError("User not found");

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) throw new UnauthorizedError("Old password is incorrect");

  const isSame = await bcrypt.compare(newPassword, user.password);
  if (isSame)
    throw new BadRequestError(
      "New password cannot be the same as old password"
    );

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return { message: "Password updated successfully" };
}

/**
 * Dynamically update user fields
 * Only allows updates if user exists and status is 'active'
 *
 * @param {string} userId - The ID of the user to update
 * @param {Object} updates - Key-value pairs of fields to update
 * @returns {Object} Updated user object
 * @throws {NotFoundError} if user not found
 * @throws {ForbiddenError} if user status is not 'active'
 * @throws {BadRequestError} if update object is empty
 */
export async function updateUser(userId, updates = {}) {
  if (!userId) throw new BadRequestError("User ID is required");

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");

  if (user.status !== "active") {
    throw new ForbiddenError(
      `User account is ${user.status} and cannot be updated`
    );
  }

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError("No fields provided for update");
  }

  Object.assign(user, updates);
  await user.save();

  return user;
}

// Reusable transaction handler
const withTransaction = async (operations) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operations(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    if (error.errorLabels?.includes("TransientTransactionError")) {
      throw new ApiError(503, 503, "Transaction conflict, please retry");
    }
    // throw
    throw error;
  } finally {
    session.endSession();
  }
};

// Reusable relationship updater
const updateRelationship = async (
  userId,
  targetUserId,
  operation,
  field,
  counterField,
  session = null
) => {
  const update = { [operation]: { [field]: targetUserId } };
  if (counterField) {
    update.$inc = { [counterField]: operation === "$addToSet" ? 1 : -1 };
  }

  const options = session ? { session } : {};
  return User.findByIdAndUpdate(userId, update, options);
};

// Validate users exist and not blocked
const validateUsers = async (userId, targetUserId, checkBlocked = true) => {
  if (userId.equals(targetUserId)) {
    throw new BadRequestError("Cannot perform action on yourself");
  }

  const [user, targetUser] = await Promise.all([
    User.findById(userId),
    User.findById(targetUserId),
  ]);

  if (!user || !targetUser) {
    throw new NotFoundError("User not found");
  }

  if (
    checkBlocked &&
    (targetUser.blockedUsers.includes(userId) ||
      user.blockedUsers.includes(targetUserId))
  ) {
    throw new ForbiddenError("Action not allowed");
  }

  return { user, targetUser };
};

// Follow/Request Follow
export const requestFollow = async (followerId, userIdToFollow) => {
  const { user: follower, targetUser: userToFollow } = await validateUsers(
    followerId,
    userIdToFollow
  );

  if (follower.following.includes(userToFollow._id)) {
    throw new BadRequestError("Already following this user");
  }

  return withTransaction(async (session) => {
    if (userToFollow.isPrivate && userToFollow.allowFollowRequests) {
      // Private account - request follow
      await updateRelationship(
        userToFollow._id,
        follower._id,
        "$addToSet",
        "pendingFollowRequests",
        "pendingFollowRequestsCount",
        session
      );

      // await NotificationService.sendNotification({
      //   recipient: userToFollow._id,
      //   sender: follower._id,
      //   type: "follow_request",
      //   message: `${follower.username} wants to follow you`,
      // });

      return { status: "requested" };
    } else if (!userToFollow.isPrivate) {
      // Public account - follow directly
      await Promise.all([
        updateRelationship(
          follower._id,
          userToFollow._id,
          "$addToSet",
          "following",
          "followingCount",
          session
        ),
        updateRelationship(
          userToFollow._id,
          follower._id,
          "$addToSet",
          "followers",
          "followersCount",
          session
        ),
      ]);

      // await NotificationService.createNotification({
      //   recipient: userToFollow._id,
      //   sender: follower._id,
      //   type: "new_follower",
      //   message: `${follower.username} started following you`,
      // });

      return { status: "following" };
    } else {
      throw new ForbiddenError("This user is not accepting follow requests");
    }
  });
};

// Accept Follow Request
export const acceptFollowRequest = async (userId, requesterId) => {
  const { targetUser: requester } = await validateUsers(userId, requesterId);

  return withTransaction(async (session) => {
    // Remove from pending and add to followers
    await Promise.all([
      updateRelationship(
        userId,
        requester._id,
        "$pull",
        "pendingFollowRequests",
        "pendingFollowRequestsCount",
        session
      ),
      updateRelationship(
        userId,
        requester._id,
        "$addToSet",
        "followers",
        "followersCount",
        session
      ),
      updateRelationship(
        requester._id,
        userId,
        "$addToSet",
        "following",
        "followingCount",
        session
      ),
    ]);

    // await NotificationService.createNotification({
    //   recipient: requester._id,
    //   sender: userId,
    //   type: "follow_request_accepted",
    //   message: `Your follow request was accepted`,
    // });

    return { status: "following" };
  });
};

// Reject Follow Request
export const rejectFollowRequest = async (userId, requesterId) => {
  await validateUsers(userId, requesterId);

  await updateRelationship(
    userId,
    requesterId,
    "$pull",
    "pendingFollowRequests",
    "pendingFollowRequestsCount"
  );

  return { status: "rejected" };
};

// Unfollow
export const unfollow = async (userId, userIdToUnfollow) => {
  const { user, targetUser } = await validateUsers(userId, userIdToUnfollow);

  if (!user.following.includes(targetUser._id)) {
    throw new NotFoundError("Not following this user");
  }

  return withTransaction(async (session) => {
    await Promise.all([
      updateRelationship(
        userId,
        targetUser._id,
        "$pull",
        "following",
        "followingCount",
        session
      ),
      updateRelationship(
        targetUser._id,
        userId,
        "$pull",
        "followers",
        "followersCount",
        session
      ),
    ]);

    return { status: "unfollowed" };
  });
};

// Block User
export const blockUser = async (userId, userIdToBlock) => {
  const { user, targetUser } = await validateUsers(
    userId,
    userIdToBlock,
    false
  );

  return withTransaction(async (session) => {
    const operations = [
      updateRelationship(
        userId,
        targetUser._id,
        "$addToSet",
        "blockedUsers",
        null,
        session
      ),
    ];

    // Remove any existing follow relationships
    if (user.following.includes(targetUser._id)) {
      operations.push(
        updateRelationship(
          userId,
          targetUser._id,
          "$pull",
          "following",
          "followingCount",
          session
        )
      );
    }

    if (targetUser.followers.includes(user._id)) {
      operations.push(
        updateRelationship(
          targetUser._id,
          user._id,
          "$pull",
          "followers",
          "followersCount",
          session
        )
      );
    }

    if (user.pendingFollowRequests.includes(targetUser._id)) {
      operations.push(
        updateRelationship(
          userId,
          targetUser._id,
          "$pull",
          "pendingFollowRequests",
          "pendingFollowRequestsCount",
          session
        )
      );
    }

    await Promise.all(operations);
    return { status: "blocked" };
  });
};

// Unblock User
export const unblockUser = async (userId, userIdToUnblock) => {
  await validateUsers(userId, userIdToUnblock, false);

  await updateRelationship(userId, userIdToUnblock, "$pull", "blockedUsers");

  return { status: "unblocked" };
};

// Get Follow Status
export const getFollowStatus = async (viewerId, profileUserId) => {
  if (viewerId.equals(profileUserId)) {
    return { status: "self" };
  }

  const [viewer, profileUser] = await Promise.all([
    User.findById(viewerId).select("following blockedUsers"),
    User.findById(profileUserId).select(
      "followers isPrivate pendingFollowRequests blockedUsers"
    ),
  ]);

  if (!viewer || !profileUser) {
    throw new NotFoundError("User not found");
  }

  if (
    profileUser.blockedUsers.includes(viewerId) ||
    viewer.blockedUsers.includes(profileUserId)
  ) {
    return { status: "blocked" };
  }

  const isFollowing = viewer.following.includes(profileUserId);
  const hasPendingRequest =
    profileUser.pendingFollowRequests.includes(viewerId);

  return {
    isFollowing,
    hasPendingRequest,
    isPrivate: profileUser.isPrivate,
    status: isFollowing
      ? "following"
      : hasPendingRequest
      ? "requested"
      : "not_following",
  };
};

/**
 * Get relationship data for a user with counts
 * @param {string} userId - The user ID to fetch relationships for
 * @param {Array<string>} keys - Relationship types to fetch (followers, following, pendingFollowRequests, blockedUsers)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.includeCounts=true] - Whether to include counts
 * @param {number} [options.limit=100] - Maximum number of results per relationship type
 * @param {number} [options.page=1] - Pagination page number
 * @returns {Promise<Object>} Relationship data with counts
 */
export const getUserRelationships = async (
  userId,
  keys = ["followers", "following", "pendingFollowRequests", "blockedUsers"],
  options = {}
) => {
  // Validate input
  if (!userId) throw new BadRequestError("User ID is required");
  if (!Array.isArray(keys)) throw new BadRequestError("Keys must be an array");

  const validKeys = [
    "followers",
    "following",
    "pendingFollowRequests",
    "blockedUsers",
  ];
  const invalidKeys = keys.filter((key) => !validKeys.includes(key));
  if (invalidKeys.length > 0) {
    throw new BadRequestError(
      `Invalid relationship keys: ${invalidKeys.join(", ")}`
    );
  }

  // Set default options
  const { includeCounts = true, limit = 100, page = 1 } = options;

  const skip = (page - 1) * limit;

  try {
    // Base query projection
    const projection = {
      _id: 0,
      ...(includeCounts && {
        followersCount: 1,
        followingCount: 1,
        pendingFollowRequestsCount: 1,
      }),
    };

    // Add requested relationship fields to projection
    keys.forEach((key) => {
      projection[key] = 1;
    });

    // Fetch user with relationships
    const user = await User.findById(userId)
      .select(projection)
      .populate({
        path: keys.join(" "),
        select: "_id username profile.avatar isOnline lastSeen",
        options: { limit, skip },
      })
      .lean();

    if (!user) {
      throw new BadRequestError("User not found");
    }

    // Transform the result
    const result = {
      ...(includeCounts && {
        counts: {
          ...(keys.includes("followers") && {
            followers: user.followersCount || 0,
          }),
          ...(keys.includes("following") && {
            following: user.followingCount || 0,
          }),
          ...(keys.includes("pendingFollowRequests") && {
            pendingRequests: user.pendingFollowRequestsCount || 0,
          }),
        },
      }),
      relationships: {},
    };

    // Add the actual relationship data
    keys.forEach((key) => {
      result.relationships[key] = user[key] || [];
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new DatabaseError(
      500,
      "Failed to fetch relationships",
      error.message
    );
  }
};
