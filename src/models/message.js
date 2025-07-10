import mongoose from "mongoose";
const { Schema, model } = mongoose;

const messageSchema = new Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      required: function () {
        return !this.media || this.media.length === 0;
      },
    },
    media: [
      {
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["image", "video", "audio", "file", "voice_note"],
          required: true,
        },
        width: {
          type: Number,
          required: function () {
            return this.type === "image" || this.type === "video";
          },
        },
        height: {
          type: Number,
          required: function () {
            return this.type === "image" || this.type === "video";
          },
        },
        duration: {
          type: Number,
          required: function () {
            return (
              this.type === "video" ||
              this.type === "audio" ||
              this.type === "voice_note"
            );
          },
        },
        fileName: String,
        fileSize: Number,
        thumbnailUrl: String,
        mimeType: String,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // Forward functionality
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    forwardedFromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    // Message type for different message types
    messageType: {
      type: String,
      enum: [
        "text",
        "media",
        "system",
        "location",
        "contact",
        "poll",
        "story_mention",
      ],
      default: "text",
    },
    // System message data
    systemMessage: {
      type: {
        type: String,
        enum: [
          "user_joined",
          "user_left",
          "admin_changed",
          "group_created",
          "group_name_changed",
          "group_photo_changed",
          "message_deleted",
          "user_added",
          "user_removed",
        ],
      },
      data: mongoose.Schema.Types.Mixed,
    },
    // Location data
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
      name: String,
    },
    // Contact data
    contact: {
      name: String,
      phone: String,
      email: String,
    },
    // Poll data
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [
            {
              user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "user",
              },
              votedAt: {
                type: Date,
                default: Date.now,
              },
            },
          ],
        },
      ],
      allowMultipleVotes: {
        type: Boolean,
        default: false,
      },
      expiresAt: Date,
    },
    // Story mention
    storyMention: {
      storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      },
      mentionedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    deletedAt: Date,
    // Enhanced status tracking
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read", "failed"],
      default: "sending",
    },
    // Read receipts with timestamps
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Delivered receipts with timestamps
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          validate: {
            validator: function (emoji) {
              return /\p{Emoji}/u.test(emoji);
            },
            message: (props) => `${props.value} is not a valid emoji`,
          },
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Message editing
    editedAt: Date,
    editHistory: [
      {
        content: String,
        media: [
          {
            url: String,
            type: String,
            fileName: String,
          },
        ],
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Scheduled messages
    scheduledFor: Date,
    isScheduled: {
      type: Boolean,
      default: false,
    },
    // Disappearing messages
    disappearingMessageTimer: Number, // in seconds
    disappearsAt: Date,
    // Pinned message
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: Date,
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    // Message priority
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    // Mentions in message
    mentions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        startIndex: Number,
        endIndex: Number,
      },
    ],
    // Hashtags
    hashtags: [String],
    // Link preview
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String,
    },
    metadata: {
      clientId: String,
      deviceId: String,
      platform: {
        type: String,
        enum: ["web", "ios", "android", "desktop"],
      },
      appVersion: String,
      userAgent: String,
      // For message synchronization
      localId: String,
      batchId: String,
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

// Compound indexes for better query performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, isPinned: 1 });
messageSchema.index({ conversation: 1, messageType: 1 });
messageSchema.index({ scheduledFor: 1, isScheduled: 1 });
messageSchema.index({ disappearsAt: 1 });
messageSchema.index({ "mentions.user": 1 });
messageSchema.index({ hashtags: 1 });
messageSchema.index({ "readBy.user": 1 });
messageSchema.index({ "deliveredTo.user": 1 });

// Text search index
messageSchema.index({
  content: "text",
  "contact.name": "text",
  "poll.question": "text",
});

// Virtual for sender details
messageSchema.virtual("senderDetails", {
  ref: "user",
  localField: "sender",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "username name profile.avatar isOnline",
  },
});

// Virtual for reply message details
messageSchema.virtual("replyToDetails", {
  ref: "Message",
  localField: "replyTo",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "content sender media createdAt messageType",
    match: { isDeleted: false },
  },
});

// Virtual for forwarded message details
messageSchema.virtual("forwardedFromDetails", {
  ref: "Message",
  localField: "forwardedFrom",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "content sender media createdAt messageType",
    match: { isDeleted: false },
  },
});

// TTL index for disappearing messages
messageSchema.index({ disappearsAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware
messageSchema.pre("save", function (next) {
  // Set disappearing message timer
  if (this.disappearingMessageTimer && !this.disappearsAt) {
    this.disappearsAt = new Date(
      Date.now() + this.disappearingMessageTimer * 1000
    );
  }

  // Extract mentions from content
  if (this.content && this.isModified("content")) {
    this.extractMentions();
  }

  // Extract hashtags from content
  if (this.content && this.isModified("content")) {
    this.extractHashtags();
  }

  next();
});

// Instance method to extract mentions
messageSchema.methods.extractMentions = function () {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(this.content)) !== null) {
    mentions.push({
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Note: You'll need to resolve usernames to user IDs in your application logic
  return mentions;
};

// Instance method to extract hashtags
messageSchema.methods.extractHashtags = function () {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;

  while ((match = hashtagRegex.exec(this.content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }

  this.hashtags = [...new Set(hashtags)]; // Remove duplicates
};

/**
 * Create a new message with enhanced features
 */
messageSchema.statics.createMessage = async function (messageData) {
  const message = await this.create(messageData);

  return this.findById(message._id)
    .populate("senderDetails")
    .populate("replyToDetails")
    .populate("forwardedFromDetails")
    .populate("mentions.user", "username name profile.avatar");
};

/**
 * Get messages with enhanced filtering and pagination
 */
messageSchema.statics.getMessages = async function (
  conversationId,
  {
    limit = 20,
    before,
    after,
    messageType,
    search,
    userId,
    includeDeleted = false,
  } = {}
) {
  const query = { conversation: conversationId };

  if (!includeDeleted) {
    query.$and = [{ isDeleted: false }, { deletedFor: { $nin: [userId] } }];
  }

  if (messageType) {
    query.messageType = messageType;
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (before) {
    query.createdAt = { $lt: before };
  }

  if (after) {
    query.createdAt = { $gt: after };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderDetails")
    .populate("replyToDetails")
    .populate("forwardedFromDetails")
    .populate("mentions.user", "username name profile.avatar")
    .populate("reactions.user", "username name profile.avatar")
    .lean();
};

/**
 * Mark message as read by user
 */
messageSchema.statics.markAsRead = async function (messageId, userId) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Check if already read
  const alreadyRead = message.readBy.some(
    (read) => read.user.toString() === userId
  );

  if (!alreadyRead) {
    message.readBy.push({ user: userId, readAt: new Date() });
    await message.save();
  }

  return message;
};

/**
 * Mark message as delivered to user
 */
messageSchema.statics.markAsDelivered = async function (messageId, userId) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  const alreadyDelivered = message.deliveredTo.some(
    (delivered) => delivered.user.toString() === userId
  );

  if (!alreadyDelivered) {
    message.deliveredTo.push({ user: userId, deliveredAt: new Date() });
    await message.save();
  }

  return message;
};

/**
 * Edit message content
 */
messageSchema.statics.editMessage = async function (
  messageId,
  userId,
  newContent,
  newMedia = []
) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.sender.toString() !== userId) {
    throw new Error("Only sender can edit the message");
  }

  // Check if message is too old to edit (15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    throw new Error("Message is too old to edit");
  }

  // Store edit history
  message.editHistory.push({
    content: message.content,
    media: message.media,
    editedAt: new Date(),
  });

  message.content = newContent;
  message.media = newMedia;
  message.editedAt = new Date();

  await message.save();

  return this.findById(message._id)
    .populate("senderDetails")
    .populate("replyToDetails");
};

/**
 * Pin/Unpin message
 */
messageSchema.statics.togglePin = async function (
  messageId,
  userId,
  conversationId
) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Check if user has permission to pin (admin check would be done in conversation logic)
  message.isPinned = !message.isPinned;

  if (message.isPinned) {
    message.pinnedAt = new Date();
    message.pinnedBy = userId;
  } else {
    message.pinnedAt = null;
    message.pinnedBy = null;
  }

  await message.save();
  return message;
};

/**
 * Vote on poll
 */
messageSchema.statics.voteOnPoll = async function (
  messageId,
  userId,
  optionIndex
) {
  const message = await this.findById(messageId);

  if (!message || !message.poll) {
    throw new Error("Poll not found");
  }

  if (message.poll.expiresAt && message.poll.expiresAt < new Date()) {
    throw new Error("Poll has expired");
  }

  const option = message.poll.options[optionIndex];
  if (!option) {
    throw new Error("Invalid option");
  }

  // Check if user already voted
  const existingVote = option.votes.find(
    (vote) => vote.user.toString() === userId
  );

  if (existingVote) {
    // Remove existing vote
    option.votes = option.votes.filter(
      (vote) => vote.user.toString() !== userId
    );
  } else {
    // Add new vote
    option.votes.push({ user: userId, votedAt: new Date() });
  }

  await message.save();
  return message;
};

// Rest of the existing methods...
messageSchema.statics.deleteMessage = async function (
  messageId,
  userId,
  forEveryone = false
) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (forEveryone) {
    if (message.sender.toString() !== userId) {
      throw new Error("Only sender can delete for everyone");
    }
    message.isDeleted = true;
    message.deletedAt = new Date();
  } else {
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }
  }

  await message.save();
  return message;
};

messageSchema.statics.addReaction = async function (messageId, userId, emoji) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  message.reactions = message.reactions.filter(
    (reaction) => reaction.user.toString() !== userId
  );

  message.reactions.push({ user: userId, emoji });
  await message.save();

  return this.findById(message._id)
    .populate("senderDetails")
    .populate("reactions.user", "username name profile.avatar");
};

messageSchema.statics.removeReaction = async function (messageId, userId) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  message.reactions = message.reactions.filter(
    (reaction) => reaction.user.toString() !== userId
  );

  await message.save();
  return this.findById(message._id)
    .populate("senderDetails")
    .populate("reactions.user", "username name profile.avatar");
};
messageSchema.statics.updateStatus = async function (
  messageId,
  status,
  userId
) {
  const message = await this.findById(messageId);
  if (!message) {
    throw new Error("Message not found");
  }
  if (!["sending", "sent", "delivered", "read", "failed"].includes(status)) {
    throw new Error("Invalid status");
  }
  message.status = status;
  if (status === "delivered" || status === "read") {
    const alreadyDelivered = message.deliveredTo.some(
      (delivered) => delivered.user.toString() === userId
    );
    if (!alreadyDelivered) {
      message.deliveredTo.push({ user: userId, deliveredAt: new Date() });
    }
  } else if (status === "read") {
    const alreadyRead = message.readBy.some(
      (read) => read.user.toString() === userId
    );
    if (!alreadyRead) {
      message.readBy.push({ user: userId, readAt: new Date() });
    }
  }
  await message.save();
  console.log(`Message status updated to ${status} for user ${userId}`);
  return this.findById(message._id)
    .populate("senderDetails")
    .populate("reactions.user", "username name profile.avatar");
};
const Message = model("Message", messageSchema);

export default Message;
