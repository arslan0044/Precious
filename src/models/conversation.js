import mongoose from "mongoose";
const { Schema, model } = mongoose;
import { isValidObjectId } from "../utils/_idvalidationhelper.js";
const conversationSchema = new Schema(
  {
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "member", "moderator"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: Date,
        isActive: {
          type: Boolean,
          default: true,
        },
        // Participant-specific settings
        permissions: {
          canSendMessages: {
            type: Boolean,
            default: true,
          },
          canSendMedia: {
            type: Boolean,
            default: true,
          },
          canAddMembers: {
            type: Boolean,
            default: false,
          },
          canRemoveMembers: {
            type: Boolean,
            default: false,
          },
          canEditGroupInfo: {
            type: Boolean,
            default: false,
          },
          canPinMessages: {
            type: Boolean,
            default: false,
          },
        },
        // Custom notification settings per participant
        customNotifications: {
          isMuted: {
            type: Boolean,
            default: false,
          },
          mutedUntil: Date,
          soundEnabled: {
            type: Boolean,
            default: true,
          },
          vibrationEnabled: {
            type: Boolean,
            default: true,
          },
          showPreviews: {
            type: Boolean,
            default: true,
          },
        },
      },
    ],

    // Conversation type
    type: {
      type: String,
      enum: ["direct", "group", "broadcast", "channel", "individual"],
      default: "direct",
    },

    // Group/Channel specific details
    name: {
      type: String,
      trim: true,
      required: function () {
        return (
          this.type === "group" ||
          this.type === "broadcast" ||
          this.type === "channel"
        );
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    photo: {
      url: String,
      thumbnailUrl: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
      uploadedAt: Date,
    },

    // Privacy settings
    privacy: {
      type: String,
      enum: ["public", "private", "secret"],
      default: function () {
        return this.type === "direct" ? "private" : "public";
      },
    },

    // Invite settings
    inviteLink: {
      code: String,
      expiresAt: Date,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
      maxUses: Number,
      currentUses: {
        type: Number,
        default: 0,
      },
    },

    // Message settings
    messageSettings: {
      // Disappearing messages
      disappearingMessages: {
        enabled: {
          type: Boolean,
          default: false,
        },
        duration: {
          type: Number, // in seconds
          default: 0,
        },
        enabledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        enabledAt: Date,
      },

      // Message approval (for channels/broadcasts)
      requireApproval: {
        type: Boolean,
        default: false,
      },

      // Only admins can send
      onlyAdminsCanSend: {
        type: Boolean,
        default: false,
      },

      // Media permissions
      mediaPermissions: {
        photos: {
          type: Boolean,
          default: true,
        },
        videos: {
          type: Boolean,
          default: true,
        },
        documents: {
          type: Boolean,
          default: true,
        },
        voiceNotes: {
          type: Boolean,
          default: true,
        },
        polls: {
          type: Boolean,
          default: true,
        },
        location: {
          type: Boolean,
          default: true,
        },
      },
    },

    // Last message info
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    // Unread counts per participant
    unreadCounts: {
      type: Map,
      of: {
        count: {
          type: Number,
          default: 0,
        },
        mentionsCount: {
          type: Number,
          default: 0,
        },
        lastReadMessageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
        lastReadAt: Date,
      },
      default: () => new Map(),
    },

    // Pinned messages
    pinnedMessages: [
      {
        message: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
        pinnedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        pinnedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Draft messages per participant
    drafts: {
      type: Map,
      of: {
        content: String,
        media: [
          {
            url: String,
            type: String,
            fileName: String,
          },
        ],
        replyTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
      default: () => new Map(),
    },

    // Participant-specific settings
    participantSettings: {
      type: Map,
      of: {
        isArchived: {
          type: Boolean,
          default: false,
        },
        isPinned: {
          type: Boolean,
          default: false,
        },
        pinnedAt: Date,
        customTitle: String, // Custom name for the conversation
        theme: {
          type: String,
          default: "default",
        },
        wallpaper: String,
        fontSize: {
          type: String,
          enum: ["small", "medium", "large"],
          default: "medium",
        },
      },
      default: () => new Map(),
    },

    // Conversation statistics
    stats: {
      totalMessages: {
        type: Number,
        default: 0,
      },
      totalMedia: {
        type: Number,
        default: 0,
      },
      totalParticipants: {
        type: Number,
        default: 0,
      },
      averageResponseTime: Number, // in milliseconds
      mostActiveParticipant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },

    // Message retention
    retention: {
      enabled: {
        type: Boolean,
        default: false,
      },
      duration: Number, // in days
      lastCleanupAt: Date,
    },

    // Blocked users (for direct conversations)
    blockedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        blockedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        blockedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],

    // Conversation tags/categories
    tags: [String],

    // Custom fields for extensibility
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },

    // Encryption settings
    encryption: {
      enabled: {
        type: Boolean,
        default: false,
      },
      keyId: String,
      algorithm: String,
    },

    // Auto-delete settings
    autoDelete: {
      enabled: {
        type: Boolean,
        default: false,
      },
      afterDays: Number,
      lastCleanup: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for better performance
conversationSchema.index({ "participants.user": 1, type: 1 });
conversationSchema.index({ "participants.user": 1, lastMessageAt: -1 });
conversationSchema.index({ type: 1, privacy: 1 });
conversationSchema.index({ "inviteLink.code": 1 });
conversationSchema.index({ tags: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ "stats.lastActivity": -1 });

// Text search index
conversationSchema.index({
  name: "text",
  description: "text",
  tags: "text",
});

// Virtuals
conversationSchema.virtual("participantDetails", {
  ref: "user",
  localField: "participants.user",
  foreignField: "_id",
  options: {
    select: "username name profile.avatar isOnline lastSeen",
  },
});

conversationSchema.virtual("lastMessageDetails", {
  ref: "Message",
  localField: "lastMessage",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "content sender createdAt status media messageType",
  },
});

conversationSchema.virtual("activeParticipants").get(function () {
  return this.participants.filter((p) => p.isActive);
});

conversationSchema.virtual("adminParticipants").get(function () {
  return this.participants.filter((p) => p.role === "admin" && p.isActive);
});

// Pre-save middleware
conversationSchema.pre("save", function (next) {
  // Update stats
  this.stats.totalParticipants = this.participants.filter(
    (p) => p.isActive
  ).length;
  this.stats.lastActivity = new Date();

  // Generate invite link if needed
  if (this.type === "group" && !this.inviteLink.code) {
    this.generateInviteLink();
  }

  next();
});
//  Helper method to safely initialize unread counts

conversationSchema.methods.initializeUnreadCounts = function(participantIds) {
  if (!this.unreadCounts || !(this.unreadCounts instanceof Map)) {
    this.unreadCounts = new Map();
  }

  participantIds.forEach(userId => {
    try {
      const userIdStr = userId.toString();
      const current = this.unreadCounts.get(userIdStr);
      
      // Only initialize if not already set or if invalid
      if (!current || typeof current !== "object") {
        this.unreadCounts.set(userIdStr, {
          count: 0,
          mentionsCount: 0,
          lastReadMessageId: null,
          lastReadAt: null
        });
      }
    } catch (err) {
      console.error(`Error initializing unread counts for user ${userId}:`, err);
    }
  });
};

// Instance methods
conversationSchema.methods.generateInviteLink = function (
  createdBy,
  expiresInDays = 7,
  maxUses = null
) {
  const code =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  this.inviteLink = {
    code,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    createdBy,
    maxUses,
    currentUses: 0,
  };

  return this.inviteLink;
};

conversationSchema.methods.isParticipant = function (userId) {
  return this.participants.some(
    (p) => p.user.toString() === userId.toString() && p.isActive
  );
};

conversationSchema.methods.isAdmin = function (userId) {
  return this.participants.some(
    (p) =>
      p.user.toString() === userId.toString() &&
      p.role === "admin" &&
      p.isActive
  );
};

conversationSchema.methods.canUserSendMessages = function (userId) {
  const participant = this.participants.find(
    (p) => p.user.toString() === userId.toString() && p.isActive
  );

  if (!participant) return false;

  // Check if only admins can send
  if (this.messageSettings.onlyAdminsCanSend) {
    return participant.role === "admin";
  }

  return participant.permissions.canSendMessages;
};

conversationSchema.methods.getUnreadCount = function (userId) {
  const unreadData = this.unreadCounts.get(userId.toString());
  return unreadData ? unreadData.count : 0;
};

conversationSchema.methods.getMentionsCount = function (userId) {
  const unreadData = this.unreadCounts.get(userId.toString());
  return unreadData ? unreadData.mentionsCount : 0;
};

// Static methods
conversationSchema.statics.findOrCreateDirectConversation = async function(participantIds) {
  // console.log("Finding or creating direct conversation for participants:", participantIds);
  if (!Array.isArray(participantIds) || participantIds.length !== 2) {
    throw new Error("Direct conversations must have exactly 2 participants");
  }

  // Ensure all IDs are valid ObjectIds
  const validParticipants = participantIds.map(id => {
    if (!mongoose.isValidObjectId(id)) {
      throw new Error(`Invalid participant ID: ${id}`);
    }
    return new mongoose.Types.ObjectId(id);
  });

  const sortedIds = [...validParticipants].sort();

  // Check if conversation already exists
  let conversation = await this.findOne({
    type: "individual",
    "participants.user": { $all: sortedIds },
    "participants.isActive": true,
    isDeleted: false,
  }).populate("participantDetails");

  if (!conversation) {
    const participants = sortedIds.map(userId => ({
      user: userId,
      role: "member",
      isActive: true,
      joinedAt: new Date(),
      permissions: {
        canSendMessages: true,
        canSendMedia: true,
        canAddMembers: false,
        canRemoveMembers: false,
        canEditGroupInfo: false,
        canPinMessages: false,
      },
    }));

    // Create new conversation with properly initialized fields
    conversation = new this({
      participants,
      type: "individual",
      privacy: "private",
      unreadCounts: new Map(),
      drafts: new Map(),
      participantSettings: new Map(),
      customFields: new Map(),
      stats: {
        totalMessages: 0,
        totalMedia: 0,
        totalParticipants: 2,
        lastActivity: new Date()
      }
    });

    // Initialize unread counts for both participants
    conversation.initializeUnreadCounts(sortedIds);
    await conversation.save();
    conversation = await this.findById(conversation._id).populate("participantDetails");
  }

  return conversation;
};

conversationSchema.statics.createGroupConversation = async function ({
  participantIds,
  name,
  description = "",
  adminId,
  photo = null,
  privacy = "public",
}) {
  if (participantIds.length < 2) {
    throw new Error("Group conversations must have at least 2 participants");
  }

  if (!participantIds.includes(adminId)) {
    throw new Error("Admin must be a participant");
  }

  const participants = participantIds.map((userId) => ({
    user: new mongoose.Types.ObjectId(userId),
    role: userId === adminId ? "admin" : "member",
    isActive: true,
    joinedAt: new Date(),
    permissions: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: userId === adminId,
      canRemoveMembers: userId === adminId,
      canEditGroupInfo: userId === adminId,
      canPinMessages: userId === adminId,
    },
  }));

  const conversation = await this.create({
    participants,
    type: "group",
    name,
    description,
    photo,
    privacy,
    unreadCounts: new Map(), // FIXED: Initialize properly
    drafts: new Map(),
    participantSettings: new Map(),
    customFields: new Map(),
  });
  conversation.initializeUnreadCounts(participantIds);
  await conversation.save();
  return this.findById(conversation._id).populate("participantDetails");
};

conversationSchema.statics.addParticipants = async function (
  conversationId,
  participantIds,
  addedBy
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type === "direct") {
    throw new Error("Cannot add participants to direct conversations");
  }

  // Check permissions
  if (!conversation.isAdmin(addedBy)) {
    const participant = conversation.participants.find(
      (p) => p.user.toString() === addedBy.toString()
    );

    if (!participant || !participant.permissions.canAddMembers) {
      throw new Error("You do not have permission to add participants");
    }
  }

  // Filter out existing participants
  const existingParticipantIds = conversation.participants
    .filter((p) => p.isActive)
    .map((p) => p.user.toString());

  const newParticipantIds = participantIds.filter(
    (id) => !existingParticipantIds.includes(id.toString())
  );

  if (newParticipantIds.length === 0) {
    return conversation;
  }

  // Add new participants
  const newParticipants = newParticipantIds.map((userId) => ({
    user: new mongoose.Types.ObjectId(userId),
    role: "member",
    isActive: true,
    joinedAt: new Date(),
    permissions: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: false,
      canRemoveMembers: false,
      canEditGroupInfo: false,
      canPinMessages: false,
    },
  }));

  conversation.participants.push(...newParticipants);
  conversation.initializeUnreadCounts(newParticipantIds);

  await conversation.save();

  return this.findById(conversation._id).populate("participantDetails");
};

conversationSchema.statics.removeParticipant = async function (
  conversationId,
  participantId,
  removedBy
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type === "direct") {
    throw new Error("Cannot remove participants from direct conversations");
  }

  // Check permissions
  if (removedBy !== participantId && !conversation.isAdmin(removedBy)) {
    const participant = conversation.participants.find(
      (p) => p.user.toString() === removedBy.toString()
    );

    if (!participant || !participant.permissions.canRemoveMembers) {
      throw new Error("You do not have permission to remove participants");
    }
  }

  // Find and deactivate participant
  const participant = conversation.participants.find(
    (p) => p.user.toString() === participantId.toString()
  );

  if (!participant) {
    throw new Error("Participant not found");
  }

  participant.isActive = false;
  participant.leftAt = new Date();

  await conversation.save();
  return this.findById(conversation._id).populate("participantDetails");
};

conversationSchema.statics.updateLastMessage = async function(
  conversationId,
  messageId,
  senderId
) {
  const conversation = await this.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Ensure unreadCounts exists
  if (!conversation.unreadCounts) {
    conversation.unreadCounts = new Map();
  }

  // Update unread counts for all participants except sender
  conversation.participants.forEach(participant => {
    if (participant.user.toString() !== senderId.toString() && participant.isActive) {
      const userId = participant.user.toString();
      const current = conversation.unreadCounts.get(userId) || {
        count: 0,
        mentionsCount: 0,
        lastReadMessageId: null,
        lastReadAt: null
      };

      conversation.unreadCounts.set(userId, {
        ...current,
        count: current.count + 1
      });
    }
  });

  // Update last message info
  conversation.lastMessage = messageId;
  conversation.lastMessageAt = new Date();
  conversation.stats.totalMessages = (conversation.stats.totalMessages || 0) + 1;

  await conversation.save();
  return conversation;
};

conversationSchema.statics.markAsRead = async function (
  conversationId,
  userId,
  lastReadMessageId = null
) {
  const conversation = await this.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const userIdStr = userId.toString();
  const current = conversation.unreadCounts.get(userIdStr) || {
    count: 0,
    mentionsCount: 0,
    lastReadMessageId: null,
    lastReadAt: null,
  };

  conversation.unreadCounts.set(userIdStr, {
    count: 0,
    mentionsCount: 0,
    lastReadMessageId: lastReadMessageId || conversation.lastMessage,
    lastReadAt: new Date(),
  });

  await conversation.save();
  return conversation;
};

conversationSchema.statics.updateMentionsCount = async function (
  conversationId,
  mentionedUserIds
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }
  if (!conversation.unreadCounts) {
    conversation.unreadCounts = new Map();
  }
  if (!conversation.isParticipant(userId)) {
    throw new Error("User not in conversation");
  }
  mentionedUserIds.forEach((userId) => {
    const userIdStr = userId.toString();
    const currentUnread = conversation.unreadCounts.get(userIdStr) || {
      count: 0,
      mentionsCount: 0,
    };

    conversation.unreadCounts.set(userIdStr, {
      ...currentUnread,
      mentionsCount: currentUnread.mentionsCount + 1,
    });
  });

  await conversation.save();
  return conversation;
};

conversationSchema.statics.getUserConversations = async function (
  userId,
  options = {}
) {
  const {
    limit = 50,
    offset = 0,
    type = null,
    archived = false,
    search = null,
  } = options;

  const query = {
    "participants.user": userId,
    "participants.isActive": true,
    isDeleted: false,
  };

  if (type) {
    query.type = type;
  }

  let conversations = await this.find(query)
    .sort({ lastMessageAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate("participantDetails")
    .populate("lastMessageDetails")
    .lean();

  // Filter based on user-specific settings
  conversations = conversations.filter((conversation) => {
    const userSettings =
      conversation.participantSettings?.get?.(userId.toString()) || {};
    return userSettings.isArchived === archived;
  });

  // Apply search filter if provided
  if (search) {
    const searchRegex = new RegExp(search, "i");
    conversations = conversations.filter((conversation) => {
      if (conversation.type === "direct") {
        // For direct conversations, search in participant names
        return conversation.participantDetails.some(
          (participant) =>
            participant._id.toString() !== userId.toString() &&
            (participant.name?.match(searchRegex) ||
              participant.username?.match(searchRegex))
        );
      } else {
        // For group conversations, search in name and description
        return (
          conversation.name?.match(searchRegex) ||
          conversation.description?.match(searchRegex)
        );
      }
    });
  }

  return conversations;
};

conversationSchema.statics.searchConversations = async function (
  userId,
  searchTerm,
  options = {}
) {
  const { limit = 20, type = null } = options;

  const query = {
    "participants.user": userId,
    "participants.isActive": true,
    isDeleted: false,
    $text: { $search: searchTerm },
  };

  if (type) {
    query.type = type;
  }

  return this.find(query)
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .populate("participantDetails")
    .populate("lastMessageDetails")
    .lean();
};

conversationSchema.statics.joinByInviteLink = async function (
  inviteCode,
  userId
) {
  const conversation = await this.findOne({
    "inviteLink.code": inviteCode,
    "inviteLink.expiresAt": { $gt: new Date() },
    isDeleted: false,
  });

  if (!conversation) {
    throw new Error("Invalid or expired invite link");
  }

  // Check if user is already a participant
  if (conversation.isParticipant(userId)) {
    throw new Error("You are already a member of this conversation");
  }

  // Check max uses
  if (
    conversation.inviteLink.maxUses &&
    conversation.inviteLink.currentUses >= conversation.inviteLink.maxUses
  ) {
    throw new Error("Invite link has reached maximum uses");
  }

  // Add user as participant
  conversation.participants.push({
    user: new mongoose.Types.ObjectId(userId),
    role: "member",
    isActive: true,
    joinedAt: new Date(),
    permissions: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: false,
      canRemoveMembers: false,
      canEditGroupInfo: false,
      canPinMessages: false,
    },
  });

  // Update invite link usage
  conversation.inviteLink.currentUses += 1;
  conversation.initializeUnreadCounts([userId]);

  await conversation.save();
  return this.findById(conversation._id).populate("participantDetails");
};

conversationSchema.statics.updateParticipantPermissions = async function (
  conversationId,
  participantId,
  permissions,
  updatedBy
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!conversation.isAdmin(updatedBy)) {
    throw new Error("Only admins can update participant permissions");
  }

  const participant = conversation.participants.find(
    (p) => p.user.toString() === participantId.toString() && p.isActive
  );

  if (!participant) {
    throw new Error("Participant not found");
  }

  participant.permissions = { ...participant.permissions, ...permissions };
  await conversation.save();

  return conversation;
};

conversationSchema.statics.saveDraft = async function (
  conversationId,
  userId,
  draftData
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }
  if (!conversation.drafts) {
    conversation.drafts = new Map();
  }
  conversation.drafts.set(userId.toString(), {
    ...draftData,
    updatedAt: new Date(),
  });

  await conversation.save();
  return conversation;
};

conversationSchema.statics.getDraft = async function (conversationId, userId) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return conversation.drafts.get(userId.toString()) || null;
};

conversationSchema.statics.clearDraft = async function (
  conversationId,
  userId
) {
  const conversation = await this.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  conversation.drafts.delete(userId.toString());
  await conversation.save();

  return conversation;
};
// Add before model export
conversationSchema.methods.safeSetUnreadCount = function (userId, count) {
  const userIdStr = userId.toString();
  const current = this.unreadCounts.get(userIdStr) || {
    count: 0,
    mentionsCount: 0,
    lastReadMessageId: null,
    lastReadAt: null,
  };

  this.unreadCounts.set(userIdStr, {
    ...current,
    count: count,
  });
};

conversationSchema.methods.safeSetMentionsCount = function (userId, count) {
  const userIdStr = userId.toString();
  const current = this.unreadCounts.get(userIdStr) || {
    count: 0,
    mentionsCount: 0,
    lastReadMessageId: null,
    lastReadAt: null,
  };

  this.unreadCounts.set(userIdStr, {
    ...current,
    mentionsCount: count,
  });
};

conversationSchema.pre("save", function(next) {
  // Ensure unreadCounts is properly initialized
  if (!(this.unreadCounts instanceof Map)) {
    this.unreadCounts = new Map();
  }

  // Clean up invalid unreadCounts entries
  for (const [key, value] of this.unreadCounts) {
    if (typeof value !== "object" || value === null) {
      this.unreadCounts.set(key, {
        count: typeof value === "number" ? value : 0,
        mentionsCount: 0,
        lastReadMessageId: null,
        lastReadAt: null
      });
    }
  }

  // Filter and validate participants
  this.participants = this.participants
    .filter(p => p && (p.user instanceof mongoose.Types.ObjectId || mongoose.isValidObjectId(p.user)))
    .map(p => ({
      ...p,
      user: p.user instanceof mongoose.Types.ObjectId ? p.user : new mongoose.Types.ObjectId(p.user)
    }));

  // Update stats
  this.stats = this.stats || {};
  this.stats.totalParticipants = this.participants.filter(p => p.isActive).length;
  this.stats.lastActivity = new Date();

  next();
});

conversationSchema.statics.fixCorruptedConversations = async function() {
  const conversations = await this.find({});
  
  for (const conv of conversations) {
    try {
      let needsSave = false;
      
      // Fix unreadCounts
      if (!(conv.unreadCounts instanceof Map)) {
        conv.unreadCounts = new Map();
        needsSave = true;
      }
      
      // Fix participants
      const validParticipants = conv.participants
        .filter(p => p && (p.user instanceof mongoose.Types.ObjectId || mongoose.isValidObjectId(p.user)))
        .map(p => ({
          ...p,
          user: p.user instanceof mongoose.Types.ObjectId ? p.user : new mongoose.Types.ObjectId(p.user)
        }));
      
      if (validParticipants.length !== conv.participants.length) {
        conv.participants = validParticipants;
        needsSave = true;
      }
      
      // Ensure stats exist
      if (!conv.stats) {
        conv.stats = {
          totalMessages: 0,
          totalMedia: 0,
          totalParticipants: validParticipants.filter(p => p.isActive).length,
          lastActivity: new Date()
        };
        needsSave = true;
      }
      
      if (needsSave) {
        await conv.save();
      }
    } catch (err) {
      console.error(`Error fixing conversation ${conv._id}:`, err);
    }
  }
};

const Conversation = model("Conversation", conversationSchema);

export default Conversation;
