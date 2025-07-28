import mongoose from "mongoose";
const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    name: {
      type: String,
      require: true,
      trim: true,
    },
    email: {
      type: String,
      require: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false,
      require: true,
    },
    phoneNumber: {
      type: String,
      // validate: [validator.isMobilePhone, 'Invalid phone number']
    },

    username: {
      type: String,
      require: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 30,
      index: true,
      // lowercase: true,
    },
    profile: {
      avatar: { type: String },
      phone: { type: String },
      bio: { type: String },
      website: { type: String },
      gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
      },
      dob: {
        type: Date,
        require: true,
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    role: {
      type: String,
      enum: ["user", "admin", "moderator", "owner"],
      default: "user",
    },

    fcmTokens: {
      type: [String],
      default: [],
    },
    notificationPreferences: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "deleted"],
      default: "active",
    },
    showActivityStatus: {
      type: String,
      enum: ["online", "away", "busy", "offline"],
      default: "offline",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    allow_friends_Request: {
      type: Boolean,
      default: false,
    },
    // Social Graph (consider separate collections for large-scale)
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    pendingFollowRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    // Counters for fast access (denormalized)
    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    pendingFollowRequestsCount: {
      type: Number,
      default: 0,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    privacySettings: {
      showActivityStatus: { type: Boolean, default: true },
      allowSharing: { type: Boolean, default: true },
      allowTagging: { type: Boolean, default: true },
      searchVisibility: { type: Boolean, default: true },
    },
    contentPreferences: {
      sensitiveContentFilter: { type: Boolean, default: true },
      language: { type: String, default: "en" },
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "light",
      },
    },
    lastActive: Date,
    deactivatedAt: Date,
    deletionRequestedAt: Date,
    messagingPreferences: {
      whoCanMessage: {
        type: String,
        enum: ["everyone", "people_you_follow", "nobody"],
        default: "everyone",
      },
      messageRequests: {
        type: Boolean,
        default: true,
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
    },

    // Last seen for messaging
    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Online status
    isOnline: {
      type: Boolean,
      default: false,
    },
    addresses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ username: "text", name: "text" });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ followersCount: -1 });
const User = model("user", userSchema);
export default User;
