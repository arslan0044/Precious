import { userinfo, updatePassword, updateUser } from "./service.js";
import { InternalServerError, BadRequestError } from "../../utils/apiError.js";

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
