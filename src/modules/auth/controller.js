import {
  sendOtp,
  verifyOtp,
  registerUser,
  loginUser,
  forgotPasswordOTP,
  loginWithGoogle,
  refreshTokens,
  forgetPasswordOTPVerification,
  updatePassword,
} from "./service.js";
import { ApiError } from "../../utils/apiError.js";

// POST /auth/send-otp
export async function sendOtpController(req, res, next) {
  try {
    const { email } = req.body;
    const result = await sendOtp(email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError("SEND_OTP_FAILED", 500, err.message)
    );
  }
}

// POST /auth/verify-otp
export async function verifyOtpController(req, res, next) {
  try {
    const { email, code } = req.body;
    const result = await verifyOtp(email, code);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError("VERIFY_OTP_FAILED", 500, err.message)
    );
  }
}

// POST /auth/register
export async function registerUserController(req, res, next) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError("REGISTER_FAILED", 500, err.message)
    );
  }
}

// POST /auth/login
export async function loginUserController(req, res, next) {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError("LOGIN_FAILED", 500, err.message)
    );
  }
}

// POST /auth/google
export async function googleLoginController(req, res, next) {
  try {
    const { idToken } = req.body;
    const result = await loginWithGoogle(idToken);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(
      err instanceof ApiError
        ? err
        : new ApiError("GOOGLE_LOGIN_FAILED", 500, err.message)
    );
  }
}

/**
 * @desc Forgot Password Controller
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPasswordOTPController = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      throw new BadRequestError("Valid email is required");
    }

    const result = await forgotPasswordOTP(email);
    res.status(200).json({
      success: true,
      message: result.message,
      // Remove this in production
      code: result.code,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Controller to verify OTP for password reset and return update token
 * @route POST /api/auth/verify-forgot-otp
 * @access Public
 */
export async function verifyForgotOtpController(req, res, next) {
  try {
    const { code } = req.body;

    if (!code) throw new BadRequestError("OTP code is required");

    const result = await forgetPasswordOTPVerification(code);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc Controller to update user password after token verification
 * @route PATCH /api/auth/update-password
 * @access Public (Token-based access via middleware)
 */
export async function updatePasswordController(req, res, next) {
  try {
    const { email } = req.user; // comes from reset token middleware
    const { newPassword } = req.body;

    const result = await updatePassword(email, newPassword);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc Handle refresh token and return new access/refresh tokens
 * @route POST /auth/refresh-token
 * @access Public
 */
export async function refreshTokenController(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ApiError(
        "REFRESH_TOKEN_REQUIRED",
        400,
        "Refresh token is required"
      );
    }

    const data = await refreshTokens(refreshToken);
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      ...data,
    });
  } catch (err) {
    next(err);
  }
}
