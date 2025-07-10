import convict from "convict";
import dotenv from "dotenv";
import { format } from "morgan";

dotenv.config(); // Load .env variables

const config = convict({
  env: {
    doc: "The application environment.",
    format: ["production", "development", "test"],
    default: "development",
    env: "NODE_ENV",
  },
  port: {
    doc: "The port the server runs on",
    format: "port",
    default: 8000,
    env: "PORT",
  },
  databaseUrl: {
    doc: "Database connection URL",
    format: String,
    default: "",
    env: "DATABASE_URL",
  },
  jwtSecret: {
    doc: "JWT Secret Key for Access Token",
    format: String,
    default: "your_jwt_secret",
    env: "JWT_SECRET",
    sensitive: true,
  },
  refreshSecret: {
    doc: "JWT Secret Key for Refresh Token",
    format: String,
    default: "your_refresh_secret",
    env: "REFRESH_SECRET",
    sensitive: true,
  },
  jwtAccessExpiration: {
    doc: "JWT Access Token Expiration Time in milliseconds",
    format: Number,
    default: 90000000, // 15 minutes in milliseconds
    env: "JWT_ACCESS_EXPIRATION",
  },
  jwtRefreshExpiration: {
    doc: "JWT Refresh Token Expiration Time in milliseconds",
    format: Number,
    default: 604800000,
    env: "JWT_REFRESH_EXPIRATION",
  },
  jwtIssuer: {
    doc: "JWT Issuer",
    format: String,
    default: "your_jwt_issuer",
    env: "JWT_ISSUER",
  },
  jwtAudience: {
    doc: "JWT Audience",
    format: String,
    default: "your_jwt_audience",
    env: "JWT_AUDIENCE",
  },
  redisUrl: {
    doc: "Redis connection URL",
    format: String,
    default: "redis://127.0.0.1:6379",
    env: "REDIS_URL",
  },
  frontendUrl: {
    doc: "Frontend URL",
    format: String,
    default: "http://localhost",
    env: "FRONTEND_URL",
  },
  googleClientId: {
    doc: "Google Client ID",
    format: String,
    default:
      "1073930846177-docvkc3l97sa6didhrrrr7jkr07302vq.apps.googleusercontent.com",
    env: "GOOGLE_CLIENT_ID",
  },
  googleClientSecret: {
    doc: "Google Client Secret",
    format: String,
    default: "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",
    env: "GOOGLE_CLIENT_SECRET",
    sensitive: true,
  },
  googleCallbackURL: {
    doc: "Google OAuth callback URL",
    format: String,
    default: "http://localhost:3000/api/auth/google/callback",
    env: "GOOGLE_CALLBACK_URL",
  },
  email: {
    host: {
      doc: "Email SMTP host",
      format: String,
      default: "smtp.ethereal.email",
      env: "MAIL_HOST",
    },
    port: {
      doc: "Email SMTP port",
      format: "port",
      default: 2525,
      env: "MAIL_PORT",
    },
    secure: {
      doc: "Email SMTP secure connection",
      format: Boolean,
      default: false,
      env: "EMAIL_SECURE",
    },
    user: {
      doc: "Email SMTP user",
      format: String,
      default: "",
      env: "MAIL_USER",
    },
    pass: {
      doc: "Email SMTP password",
      format: String,
      default: "",
      env: "MAIL_PASS",
      sensitive: true,
    },
  },
  casbin: {
    policyVersion: "1.0.0",
    reloadInterval: 300000, // 5 minutes
    defaultRole: "guest",
    requiredPolicies: [
      { role: "admin", resource: "*", action: "*" },
      { role: "user", resource: "profile", action: "read" },
    ],
  },
  mongodb: {
    doc: "MongoDB connection URL",
    format: String,
    default: "",
    env: "MONGODB_URI",
  },
  sessionSecrate: {
    default: "your_session_secret",
    doc: "Session secret key",
    format: String,
    env: "SESSION_SECRET",
  },
  frontendSuccessUrl: {
    doc: "Frontend success URL",
    format: String,
    default: "http://localhost:3000/",
    env: "FRONTEND_SUCCESS_URL",
  },
  login: {
    maxAttempts: {
      doc: "Max login attempts",
      format: Number,
      default: 5,
      env: "LOGIN_MAX_ATTEMPTS",
    },
    banTime: {
      doc: "Lock time in milliseconds",
      format: Number,
      default: 300, // 1 minute
      env: "LOGIN_LOCK_TIME",
    },
  },
  firebase: {
    type: {
      doc: "Firebase service type",
      format: String,
      default: "",
      env: "FIREBASE_PROJECT_TYPE",
    },
    projectId: {
      doc: "Firebase project ID",
      format: String,
      default: "",
      env: "FIREBASE_PROJECT_ID",
    },
    privateKeyId: {
      doc: "Firebase private key ID",
      format: String,
      default: "",
      env: "FIREBASE_PRIVATE_KEY_ID",
      sensitive: true,
    },
    privateKey: {
      doc: "Firebase private key",
      format: String,
      default: "",
      env: "FIREBASE_PRIVATE_KEY",
      sensitive: true,
    },
    clientEmail: {
      doc: "Firebase client email",
      format: String,
      default: "",
      env: "FIREBASE_CLIENT_EMAIL",
    },
    clientId: {
      doc: "Firebase client ID",
      format: String,
      default: "",
      env: "FIREBASE_CLIENT_ID",
      sensitive: true,
    },
    authURI: {
      doc: "OAuth2 auth URI",
      format: String,
      default: "",
      env: "FIREBASE_AUTH_URI",
    },
    tokenURI: {
      doc: "OAuth2 token URI",
      format: String,
      default: "",
      env: "FIREBASE_TOKEN_URI",
    },
    authProviderCertURL: {
      doc: "OAuth2 provider cert URL",
      format: String,
      default: "",
      env: "FIREBASE_AUTH_PROVIDER_CERT_URL",
    },
    clientCertURL: {
      doc: "Firebase client cert URL",
      format: String,
      default: "",
      env: "FIREBASE_CLIENT_CERT_URL",
    },
    universeDomain: {
      doc: "Google API universe domain",
      format: String,
      default: "",
      env: "FIREBASE_UNIVERSE_DOMAIN",
    },
  },
  appinfo:{
    name:{
      doc:"Application Name",
      format:String,
      env:"APP_NAME",
      default:"Backend"
    },
    description:{
      doc:"Application Description",
      format:String,
      env:"APP_DESCRIPTION",
      default:"Backend"
    },
    supportEmail:{
      doc:"Application Support Email",
      format:String,
      env:"APP_SUPPORT_EMAIL",
      default:"admin@backend.com"
    },
    backendURL:{
      doc:"Application Support Email",
      format:String,
      env:"APP_BACKEND_DOMAIN",
      default:"https://api.backend.com"
    },
  }
});

// Perform validation
config.validate({ allowed: "strict" });

export default config;
