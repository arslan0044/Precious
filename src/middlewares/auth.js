import jwt from "jsonwebtoken";
import config from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "../utils/apiError.js";
import User from "../models/User.js";

/**
 * Middleware to verify JWT access token
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authorization token missing or malformed");
    }

    const token = authHeader.split(" ")[1];
    const secret = config.get("jwtSecret");

    if (!secret) throw new Error("JWT secret not configured");

    const decoded = jwt.verify(token, secret);

    // Fetch user (optional but good for RBAC or user checks)
    const user = await User.findById(decoded._id);
    if (!user) throw new ForbiddenError("User no longer exists");

    // Optional: block non-active users
    if (user.status !== "active") {
      throw new ForbiddenError(`User account is ${user.status}`);
    }

    // Attach to request
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(
      err.name === "TokenExpiredError"
        ? new UnauthorizedError("Session expired, please login again")
        : new UnauthorizedError("Invalid or expired token")
    );
  }
};


/**
 * Middleware to verify the password reset JWT token.
 * The token must be provided via `Authorization: Bearer <token>` header.
 */
export function verifyPasswordResetToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token missing from authorization header");
    }

    const token = authHeader.split(" ")[1];
    const secret = config.get("jwtSecret");

    if (!secret) throw new Error("JWT_PASSWORD_RESET_SECRET is not set");

    const decoded = jwt.verify(token, secret);

    // You can optionally validate token purpose/type here
    if (decoded.purpose !== "password_reset") {
      throw new UnauthorizedError("Invalid token purpose");
    }

    // Attach decoded data to request
    req.user = decoded; // e.g. { email: ..., type: "password_reset" }

    next();
  } catch (err) {
    next(new UnauthorizedError(err.message));
  }
}