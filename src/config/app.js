import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import logger, { httpLogger } from "./logger.js";
import redis from "./redis.js";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { connectMongoDB } from "./mongodb.js";
import mongoose from "mongoose";
import session from "express-session";
import config from "./env.js";
import routes from "../modules/index.js";
import admin from "./firebase.js";
// // import prisma, { connectDB as connectPostgres } from "./database.js";
// // import { errorHandler } from "../middlewares/errorHandler.js";
// // import initializePassport from "./passport.js";
// // import passport from "passport";
// // import { initializeCasbin } from "../config/casbin.js";
// // import { swaggerDocs } from "./swagger.js";
// // import { setupWebSocket, getIO } from "../websocket/index.js";
// // import { createServer } from "http";
// import { sessionMiddleware } from "./session.js";
import { ApiError } from "../utils/apiError.js";
import { swaggerDocs } from "./swagger.js";
const app = express();
// // const server = createServer(app);
app.use(express.static("public"));
// // ========================
// // Security Middleware
// // ========================
admin;
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.valid-cdn.com"],
        connectSrc: ["'self'", "https://*.valid-api.com"],
      },
    },
  })
);
// app.set('trust proxy', true);
// // ========================
// // Session Middleware
// // =========================
// app.use(sessionMiddleware);
app.use(
  session({
    secret:
      config.get("sessionSecrate") || crypto.randomBytes(64).toString("hex"),
    resave: false,
    saveUninitialized: false, // Changed for GDPR compliance
    store:
      config.get("env") === "production"
        ? new RedisStore({ client: redisClient })
        : null,
    cookie: {
      secure: false,
      secure: config.get("env") === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// // ========================
// // CORS Configuration
// // ========================
// // temprarily disabled for local development
app.use(
  cors({
    origin: "*", // Update for production security
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: false,
  })
);
// app.options("*", cors());
// //
// //=====================================
// // Initialize Casbin on startup
// //======================================
// // initializeCasbin();
// // ========================
// // Passport Middleware
// // ========================
// // initializePassport(passport);
// // app.use(passport.initialize());
// // app.use(passport.session());
// // Setup WebSocket
// // setupWebSocket(server);
// // ========================
// // Rate Limiting
// // ========================
// app.set("trust proxy", true);
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.use(
  rateLimit({
    validate: {
      validationsConfig: false,
      default: true,
    },
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests, please try again later.",
  })
);

// // ========================
// // Request Parsing
// // ========================
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// Custom error handler for JSON parse failures
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      code: "INVALID_JSON",
      message: "Malformed JSON. Please fix your syntax.",
      example: {
        correctFormat: {
          email: "user@example.com",
          password: "yourPassword123",
        },
      },
    });
  }
  next(err); // Pass to next error handler
});

// // ========================
// // Logging
// // ========================
app.use(httpLogger);

// // ========================
// // Database Connections
// // ========================

// await connectPostgres();
await connectMongoDB();

// // ========================
// // Enhanced Health Check
// // ========================
app.get("/", async (req, res) => {
  const healthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      // postgresql: "unhealthy",
      mongodb: "unhealthy",
      redis: "unhealthy",
    },
    ApiDocs: "/api-docs",
    ApiJson: "/api-docs.json",
    massage: "Welcome to the API  This is a health check endpoint and api documentation  Please visit /api-docs for more information. Thank you for using our service!",
  };

  // try {
  //   // PostgreSQL Check
  //   await prisma.$queryRaw`SELECT 1`;
  //   healthCheck.services.postgresql = "healthy";
  // } catch (error) {
  //   healthCheck.status = "degraded";
  //   logger.error("PostgreSQL health check failed:", error);
  // }

  try {
    if (mongoose.connection.readyState === 1) {
      healthCheck.services.mongodb = "healthy";
    } else {
      healthCheck.status = "degraded";
      logger.error("MongoDB is not connected properly.");
    }
  } catch (error) {
    healthCheck.status = "degraded";
    logger.error("MongoDB health check failed:", error);
  }

  // Redis Check
  try {
    const redisPing = await redis.ping();
    healthCheck.services.redis = redisPing === "PONG" ? "healthy" : "unhealthy";
  } catch (error) {
    healthCheck.status = "degraded";
    logger.error("Redis health check failed:", error);
  }

  // Determine overall status
  if (Object.values(healthCheck.services).every((s) => s === "healthy")) {
    healthCheck.status = "ok";
  } else if (
    Object.values(healthCheck.services).some((s) => s === "unhealthy")
  ) {
    healthCheck.status = "degraded";
  }

  res.status(healthCheck.status === "ok" ? 200 : 503).json(healthCheck);
});

// // ========================
// // Application Routes
// // ========================
app.use("/api", routes);
swaggerDocs(app);

// // ========================
// // Error Handling
// // ========================
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return err.format(res); // ✅ returns structured JSON
  }

  // Fallback for unhandled errors
  logger.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
    status: 500,
    timestamp: new Date().toISOString(),
  });
});
export default app;

// app.get("/", (req, res) => {
//   res.status(200).json({
//     status: "ok",
//     message: "Welcome to the API",
//     timestamp: new Date().toISOString(),
//   });
// });
// export default app;
