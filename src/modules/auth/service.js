import TempUser from "../../models/TempUser.js";
import User from "../../models/User.js";
import {
  generateOTP,
  generateAccessToken,
  generateRefreshToken,
  decodeToken,
  generatePasswordUpdateToken,
} from "../../utils/Generator.js";
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "../../utils/apiError.js";
import bcrypt from "bcrypt";
import admin from "../../config/firebase.js";
import { sendEmail } from "../../utils/emailHelper.js";
import config from "../../config/env.js";
const OTP_EXPIRY_MINUTES = 10;

// STEP 1: Send OTP to Email
export async function sendOtp(email) {
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ConflictError("Email already registered");

  const code = generateOTP(6, { numeric: true });
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await TempUser.findOneAndUpdate(
    { email, type: "verification" },
    { code, expiresAt, type: "verification", attempts: 0 },
    { upsert: true, new: true }
  );

  // Send OTP via email (stubbed)
  await sendEmail({
    to: email,
    subject: "Your OTP Code",
    html: `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Hello 👋</h2>
      <p>Use the following One-Time Password (OTP) to complete your verification:</p>
      <h1 style="background: #f3f3f3; padding: 10px 20px; border-radius: 6px; display: inline-block;">
        ${code}
      </h1>
      <p>This OTP will expire in <strong>10 minutes</strong>.</p>
      <p>If you didn’t request this, please ignore this email.</p>
      <br />
      <p>Thanks,<br />The Utecho Team</p>
    </div>
  `,
    // text: `Your OTP code is: ${code}`,
  });
  return { message: "OTP sent to your email", code };
}

// STEP 2: Verify OTP
export async function verifyOtp(email, code) {
  const tempUser = await TempUser.findOne({ email, type: "verification" });
  if (!tempUser)
    throw new NotFoundError("OTP not found. Please request a new one.");
  if (tempUser.attempts >= 5)
    throw new BadRequestError("Too many invalid attempts");
  if (Date.now() > new Date(tempUser.expiresAt).getTime()) {
    await TempUser.deleteOne({ email });
    throw new BadRequestError("OTP expired. Please request a new one.");
  }

  if (tempUser.code !== code) {
    await TempUser.updateOne({ email }, { $inc: { attempts: 1 } });
    throw new BadRequestError("Invalid OTP");
  }

  return { message: "OTP verified successfully" };
}

// STEP 3: Register User
export async function registerUser({ email, name, username, password }) {
  const checkUser = await User.findOne({ email });
  if (checkUser) throw new BadRequestError("Email is already in use");

  const tempUser = await TempUser.findOne({ email });
  if (!tempUser) throw new BadRequestError("OTP not verified");

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    username,
    email,
    password: hashedPassword,
    isEmailVerified: true,
  });

  await TempUser.deleteOne({ email, type: "verification" });

  const payload = { _id: user._id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  console.log(refreshToken);
  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      //   role: user.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

/**
 * Login user using email and password
 * @param {Object} payload
 * @param {string} payload.email
 * @param {string} payload.password
 * @returns {Object} user + tokens
 */
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== "active") {
    throw new ForbiddenError(`Your account is ${user.status}`);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const payload = { _id: user._id, email: user.email };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

/**
 * Login/Register using Google OAuth Token (from Firebase)
 * @param {string} idToken - Google ID token from Firebase
 * @returns {Object} user + tokens
 */
export async function loginWithGoogle(idToken) {
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired Google token");
  }

  const { email, name, picture, uid } = decoded;

  if (!email) {
    throw new UnauthorizedError(
      "Google account does not contain a verified email"
    );
  }

  let user = await User.findOne({ email });

  if (!user) {
    // Create new user
    user = await User.create({
      name: name || "Google User",
      email,
      googleId: uid,
      profile: { avatar: picture },
      authProvider: "google",
      isEmailVerified: true,
      status: "active",
    });
  }

  if (user.status !== "active") {
    throw new UnauthorizedError(`Your account is ${user.status}`);
  }

  const payload = { _id: user._id, email: user.email };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.profile.avatar,
      role: user.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function forgotPasswordOTP(email) {
  const user = await User.findOne({ email });
  if (!user) throw new NotFoundError("User with this email does not exist");

  const code = generateOTP(6, { numeric: true });
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await TempUser.findOneAndUpdate(
    { email, type: "forgot" },
    { code, expiresAt, type: "forgot", attempts: 0 },
    { upsert: true, new: true }
  );

  // TODO: Integrate with your email service
  // await sendEmail(email, `Your password reset OTP is ${code}`);

  return { message: "Password reset OTP sent to your email", code };
}

/**
 * Verifies the OTP sent for password reset and issues a temporary password update token
 *
 * @param {string} code - OTP code submitted by the user
 * @returns {Object} - Contains success message and password update token
 * @throws {NotFoundError} - If no valid OTP is found
 * @throws {BadRequestError} - If OTP is expired or maximum attempts exceeded
 */
export async function forgetPasswordOTPVerification(code) {
  // Find OTP entry by code and type
  const tempUser = await TempUser.findOne({ code, type: "forgot" });

  // If no entry found, throw error
  if (!tempUser) {
    throw new NotFoundError("Invalid or expired OTP code");
  }

  // Check if maximum attempts exceeded
  if (tempUser.attempts >= 5) {
    throw new BadRequestError("Too many invalid attempts");
  }

  // Check if OTP is expired
  if (Date.now() > new Date(tempUser.expiresAt).getTime()) {
    await TempUser.deleteOne({ email: tempUser.email, type: "forgot" });
    throw new BadRequestError("OTP expired. Please request a new one.");
  }

  // OTP is valid – clean up temp record
  await TempUser.deleteOne({ email: tempUser.email, type: "forgot" });

  // Generate short-lived token to allow password reset
  const token = generatePasswordUpdateToken(tempUser.email);

  return {
    message: "OTP verified successfully",
    token,
  };
}
/**
 * Update user's password after token verification
 * @param {string} email - User's email from the verified reset token
 * @param {string} newPassword - New password to be set
 */
export async function updatePassword(email, newPassword) {
  if (!email || !newPassword)
    throw new BadRequestError("Email and password required");

  const user = await User.findOne({ email });
  if (!user) throw new NotFoundError("User not found");

  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await user.save();

  return { message: "Password updated successfully" };
}
/**
 * Refresh JWT access and refresh tokens
 * @param {string} token - The refresh token
 * @returns {Object} - New accessToken and refreshToken
 */
export async function refreshTokens(token) {
  if (!token) throw new UnauthorizedError("Refresh token missing");

  const decoded = decodeToken(token, "refresh");
  const payload = { _id: decoded._id, email: decoded.email };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}
