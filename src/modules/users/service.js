import User from "../../models/User.js";
import Address from "../../models/Address.js";
import {
  ApiError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
  DatabaseError,
} from "../../utils/apiError.js";
import Conversation from "../../models/conversation.js";
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

  // Check if already following
  if (follower.following.includes(userToFollow._id)) {
    throw new BadRequestError("Already following this user");
  }

  // Check if request already pending (only for private accounts)
  if (
    userToFollow.isPrivate &&
    userToFollow.pendingFollowRequests.some((id) => id.equals(follower._id))
  ) {
    throw new BadRequestError("Follow request already pending");
  }

  // Transaction-capable version
  const executeWithTransaction = async (session) => {
    if (userToFollow.allow_friends_Request) {
      // For private accounts, always add to pendingFollowRequests
      await User.findOneAndUpdate(
        { _id: userToFollow._id },
        {
          $addToSet: {
            pendingFollowRequests: follower._id,
            following: userToFollow._id,
          },
          $inc: { pendingFollowRequestsCount: 1, followingCount: 1 },
        },
        { session, new: true }
      );
      return { status: "requested" };
    } else {
      // For public accounts, follow directly
      await Promise.all([
        User.findOneAndUpdate(
          { _id: follower._id },
          {
            $addToSet: { following: userToFollow._id },
            $inc: { followingCount: 1 },
          },
          { session, new: true }
        ),
        User.findOneAndUpdate(
          { _id: userToFollow._id },
          {
            $addToSet: { followers: follower._id },
            $inc: { followersCount: 1 },
          },
          { session, new: true }
        ),
      ]);
      return { status: "following" };
    }
  };

  // Fallback version
  const executeWithoutTransaction = async () => {
    if (userToFollow.allow_friends_Request) {
      // For private accounts
      const updated = await User.findOneAndUpdate(
        { _id: userToFollow._id },
        {
          $addToSet: {
            pendingFollowRequests: follower._id,
            following: userToFollow._id,
          },
          $inc: { pendingFollowRequestsCount: 1, followingCount: 1 },
        },
        { new: true }
      );

      if (
        !updated.pendingFollowRequests.some((id) => id.equals(follower._id))
      ) {
        throw new Error("Failed to add follow request");
      }
      return { status: "requested" };
    } else {
      // For public accounts
      const [updatedFollower, updatedFollowee] = await Promise.all([
        User.findOneAndUpdate(
          { _id: follower._id },
          {
            $addToSet: { following: userToFollow._id },
            $inc: { followingCount: 1 },
          },
          { new: true }
        ),
        User.findOneAndUpdate(
          { _id: userToFollow._id },
          {
            $addToSet: { followers: follower._id },
            $inc: { followersCount: 1 },
          },
          { new: true }
        ),
      ]);

      if (
        !updatedFollower.following.some((id) => id.equals(userToFollow._id)) ||
        !updatedFollowee.followers.some((id) => id.equals(follower._id))
      ) {
        throw new Error("Failed to establish follow relationship");
      }
      return { status: "following" };
    }
  };

  try {
    // First attempt: try with transaction
    return await withTransaction(executeWithTransaction);
  } catch (transactionError) {
    if (
      transactionError.code === 20 ||
      transactionError.codeName === "IllegalOperation"
    ) {
      // Transaction not supported - fallback to atomic operations
      return await executeWithoutTransaction();
    }
    // Re-throw other errors
    throw transactionError;
  }
};

// Accept Follow Request
export const acceptFollowRequest = async (userId, requesterId) => {
  const { targetUser: requester } = await validateUsers(userId, requesterId);

  // Transaction-capable version
  const executeWithTransaction = async (session) => {
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
    // Create conversation between users after successful follow
    await Conversation.findOrCreateDirectConversation([
      userId,
      requester._id.toString(),
    ])

    return { status: "following" };
  };

  // Fallback version
  const executeWithoutTransaction = async () => {
    // Atomic operations instead of transaction
    await Promise.all([
      User.updateOne(
        { _id: userId },
        {
          $pull: { pendingFollowRequests: requester._id },
          $inc: { pendingFollowRequestsCount: -1 },
          $addToSet: { followers: requester._id },
          $inc: { followersCount: 1 },
        }
      ).exec(),
      User.updateOne(
        { _id: requester._id },
        {
          $addToSet: { following: userId },
          $inc: { followingCount: 1 },
        }
      ).exec(),
    ]);

    await Conversation.findOrCreateDirectConversation([
      userId,
      requester._id.toString(),
    ]);

    return { status: "following" };
  };

  try {
    // First attempt with transaction
    return await withTransaction(executeWithTransaction);
  } catch (transactionError) {
    if (
      transactionError.code === 20 ||
      transactionError.codeName === "IllegalOperation"
    ) {
      // Transaction not supported - use atomic fallback
      return await executeWithoutTransaction();
    }
    throw transactionError;
  }
};

// Reject Follow Request
export const rejectFollowRequest = async (userId, requesterId) => {
  await validateUsers(userId, requesterId);

  // Transaction-capable version
  const executeWithTransaction = async (session) => {
    await updateRelationship(
      userId,
      requesterId,
      "$pull",
      "pendingFollowRequests",
      "pendingFollowRequestsCount",
      session
    );
    return { status: "rejected" };
  };

  // Fallback version
  const executeWithoutTransaction = async () => {
    // Atomic operation - single update doesn't need transaction
    await User.updateOne(
      { _id: userId },
      {
        $pull: { pendingFollowRequests: requesterId },
        $inc: { pendingFollowRequestsCount: -1 },
      }
    ).exec();
    return { status: "rejected" };
  };

  try {
    // First attempt with transaction
    return await withTransaction(executeWithTransaction);
  } catch (transactionError) {
    if (
      transactionError.code === 20 ||
      transactionError.codeName === "IllegalOperation"
    ) {
      // Transaction not supported - use atomic fallback
      return await executeWithoutTransaction();
    }
    throw transactionError;
  }
};

// Unfollow
export const unfollow = async (userId, userIdToUnfollow) => {
  const { user, targetUser } = await validateUsers(userId, userIdToUnfollow);

  if (!user.following.includes(targetUser._id)) {
    throw new NotFoundError("Not following this user");
  }

  // Transaction-capable version
  const executeWithTransaction = async (session) => {
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
  };

  // Atomic fallback version
  const executeWithoutTransaction = async () => {
    await Promise.all([
      User.updateOne(
        { _id: userId },
        {
          $pull: { following: targetUser._id },
          $inc: { followingCount: -1 },
        }
      ).exec(),
      User.updateOne(
        { _id: targetUser._id },
        {
          $pull: { followers: userId },
          $inc: { followersCount: -1 },
        }
      ).exec(),
    ]);
    return { status: "unfollowed" };
  };

  try {
    // First attempt with transaction
    return await withTransaction(executeWithTransaction);
  } catch (transactionError) {
    if (
      transactionError.code === 20 ||
      transactionError.codeName === "IllegalOperation"
    ) {
      // Transaction not supported - use atomic fallback
      return await executeWithoutTransaction();
    }
    throw transactionError;
  }
};

// Block User
export const blockUser = async (userId, userIdToBlock) => {
  const { user, targetUser } = await validateUsers(
    userId,
    userIdToBlock,
    false
  );

  // Transaction-capable version
  const executeWithTransaction = async (session) => {
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

    // Remove any existing relationships
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
  };

  // Atomic fallback version
  const executeWithoutTransaction = async () => {
    const updates = [
      // Always block the user
      User.updateOne(
        { _id: userId },
        { $addToSet: { blockedUsers: targetUser._id } }
      ).exec(),
    ];

    // Conditional relationship removals
    if (user.following.includes(targetUser._id)) {
      updates.push(
        User.updateOne(
          { _id: userId },
          {
            $pull: { following: targetUser._id },
            $inc: { followingCount: -1 },
          }
        ).exec()
      );
    }

    if (targetUser.followers.includes(user._id)) {
      updates.push(
        User.updateOne(
          { _id: targetUser._id },
          {
            $pull: { followers: userId },
            $inc: { followersCount: -1 },
          }
        ).exec()
      );
    }

    if (user.pendingFollowRequests.includes(targetUser._id)) {
      updates.push(
        User.updateOne(
          { _id: userId },
          {
            $pull: { pendingFollowRequests: targetUser._id },
            $inc: { pendingFollowRequestsCount: -1 },
          }
        ).exec()
      );
    }

    await Promise.all(updates);
    return { status: "blocked" };
  };

  try {
    // First attempt with transaction
    return await withTransaction(executeWithTransaction);
  } catch (transactionError) {
    if (
      transactionError.code === 20 ||
      transactionError.codeName === "IllegalOperation"
    ) {
      // Transaction not supported - use atomic fallback
      return await executeWithoutTransaction();
    }
    throw transactionError;
  }
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
        select: "_id username profile.avatar isOnline lastSeen ",
        options: { limit, skip },
      })
      .lean();

    if (!user) {
      throw new BadRequestError("User not found");
    }
    // console.log("Fetched user relationships:", user);

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

export const getAllUsers = async (options = {}) => {
  const {
    limit = 100,
    page = 1,
    sortBy = "createdAt",
    sortOrder = "desc", // "asc" or "desc"
    search = "", // new
  } = options;

  const sanitizedLimit = Math.max(1, Math.min(parseInt(limit), 1000));
  const sanitizedPage = Math.max(1, parseInt(page));
  const skip = (sanitizedPage - 1) * sanitizedLimit;

  // Base query: only active users with "user" role
  const query = {
    role: "user",
    status: "active",
  };

  // Add case-insensitive search on username or name
  if (search?.trim()) {
    query.$or = [
      { username: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select("-password -__v -fcmTokens")
        .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(sanitizedLimit)
        .lean(),
      User.countDocuments(query),
    ]);

    return {
      success: true,
      data: users,
      meta: {
        totalCount,
        totalPages: Math.ceil(totalCount / sanitizedLimit),
        currentPage: sanitizedPage,
        pageSize: sanitizedLimit,
      },
    };
  } catch (error) {
    throw new DatabaseError(500, "Failed to fetch users", error?.message);
  }
};

/**
 * Create a new address for a user
 * @param {Object} addressData - The address details to be stored
 * @param {string} addressData.user - The user ID owning the address
 * @param {string} addressData.type - Type of address (billing, delivery, profile)
 * @param {string} addressData.fullName - Recipient's full name
 * @param {string} addressData.phone - Valid phone number
 * @param {string} addressData.country - Country name
 * @param {string} addressData.state - State or province (optional)
 * @param {string} addressData.city - City
 * @param {string} addressData.street - Street name and number
 * @param {string} addressData.zip - Postal/ZIP code
 * @param {boolean} [addressData.isDefault=false] - Whether this address should be default
 * @param {Object} [addressData.coordinates] - Optional geolocation in GeoJSON format
 * @returns {Promise<Object>} Created address object
 * @throws {HttpError} 400 for bad input, 404 if user not found, 500 for server errors
 */
export const postAddress = async (addressData) => {
  const {
    userId,
    type,
    country,
    state,
    city,
    street,
    zip,
    isDefault = false,
  } = addressData;
  const requiredFields = ["userId", "type", "country", "city", "street", "zip"];

  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new BadRequestError(
      `Missing required address field(s): ${missingFields.join(", ")}`
    );
  }
  const existingUser = await User.findById(userId);
  if (!existingUser) {
    throw new NotFoundError("User not found.");
  }
  // If isDefault is true, unset other default addresses of same type
  if (isDefault) {
    await Address.updateMany(
      { user, type, isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  const address = new Address({
    userId,
    type,
    country,
    state,
    city,
    street,
    zip,
  });
  try {
    const savedAddress = await address.save();
    return savedAddress.toObject();
  } catch (err) {
    console.error("Error saving address:", err);
    throw createHttpError(500, "Failed to save address.");
  }
};
