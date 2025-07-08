import User from "../../models/User.js";
import {
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from "../../utils/apiError.js";

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
