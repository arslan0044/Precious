import config from "../config/env.js";
import jwt from "jsonwebtoken";

/**
 * Generate an OTP or token
 * @param {number} length - Desired length of the OTP/token
 * @param {Object} options - Configuration for characters
 * @param {boolean} options.numeric - Include numbers
 * @param {boolean} options.alphabet - Include alphabets (lowercase + uppercase)
 * @returns {string} Generated OTP/token
 */
export function generateOTP(
  length = 6,
  options = { numeric: true, alphabet: false }
) {
  let charset = "";

  if (options.numeric) charset += "0123456789";
  if (options.alphabet)
    charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  if (!charset) {
    throw new Error(
      "At least one character set (numeric or alphabet) must be enabled"
    );
  }

  let otp = "";
  for (let i = 0; i < length; i++) {
    const randomIdx = Math.floor(Math.random() * charset.length);
    otp += charset[randomIdx];
  }

  return otp;
}

/**
 * Generate an access token
 * @param {Object} payload - The data to encode into the token
 * @returns {string} JWT access token
 */
export function generateAccessToken(payload) {
  const secret = config.get("jwtSecret");
  const expiresInMs = config.get("jwtAccessExpiration");
  const expiresIn = `${Math.floor(expiresInMs / 1000)}s`; // Convert to "900s" style
  const audience = config.get("jwtAudience");
  const issuer = config.get("jwtIssuer");

  if (!secret) throw new Error("JWT_SECRET is not set");
  if (!issuer) throw new Error("JWT_ISSUER is not set");
  if (!audience) throw new Error("JWT_AUDIENCE is not set");
  return jwt.sign(payload, secret, { expiresIn, issuer, audience });
}

/**
 * Generate a refresh token
 * @param {Object} payload - The data to encode into the token
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(payload) {
  const secret = config.get("refreshSecret");
  const expiresInMs = config.get("jwtRefreshExpiration");
  const expiresIn = `${Math.floor(expiresInMs / 1000)}s`; // Convert to "900s" style
  const audience = config.get("jwtAudience");
  const issuer = config.get("jwtIssuer");

  if (!secret) throw new Error("JWT_SECRET is not set");
  if (!issuer) throw new Error("JWT_ISSUER is not set");
  if (!audience) throw new Error("JWT_AUDIENCE is not set");
  return jwt.sign(payload, secret, { expiresIn, issuer, audience });
}

/**
 * Verify an access or refresh token
 * @param {string} token - The JWT to verify
 * @param {boolean} isRefresh - Whether to use refreshSecret for verification
 * @returns {Object} Decoded payload
 */
export function verifyToken(token, isRefresh = false) {
  const secret = isRefresh ? config.refreshSecret : config.jwtSecret;
  return jwt.verify(token, secret, {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

/**
 * Decode and verify a JWT
 * @param {string} token - The JWT token to decode
 * @param {string} type - Token type: "access" or "refresh"
 * @returns {object} Decoded payload
 * @throws {UnauthorizedError} If token is invalid or expired
 */
export function decodeToken(token, type = "access") {
  try {
    const secret =
      type === "refresh"
        ? config.get("refreshSecret")
        : config.get("jwtSecret");

    if (!secret) throw new Error("JWT secret is missing");

    return jwt.verify(token, secret);
  } catch (err) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}


/**
 * Generate a short-lived token specifically for password update
 * @param {string} email - The user's email
 * @returns {string} JWT token
 */
export function generatePasswordUpdateToken(email) {
  const secret = config.get("jwtSecret");

  if (!secret) throw new Error("JWT secret not configured");

  const payload = {
    email,
    purpose: "password_reset",
  };

  return jwt.sign(payload, secret, {
    expiresIn: "5m", // 5 minutes
    issuer: config.get("jwtIssuer"),
    audience: config.get("jwtAudience"),
  });
}

export default generateOTP;
