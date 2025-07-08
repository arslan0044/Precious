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
      ref: "User",
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
          enum: ["image", "video", "audio", "file"],
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
            return this.type === "video" || this.type === "audio";
          },
        },
        fileName: String,
        fileSize: Number,
        thumbnailUrl: String,
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read", "failed"],
      default: "sending",
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
          validate: {
            validator: function (emoji) {
              // Simple emoji validation (can be enhanced)
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
    metadata: {
      clientId: String, // For client-side message tracking
      deviceId: String, // For multi-device sync
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

// Virtual for sender details (when populated)
messageSchema.virtual("senderDetails", {
  ref: "User",
  localField: "sender",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "username name profile.avatar",
  },
});

// Virtual for reply message details (when populated)
messageSchema.virtual("replyToDetails", {
  ref: "Message",
  localField: "replyTo",
  foreignField: "_id",
  justOne: true,
  options: {
    select: "content sender media createdAt",
    match: { isDeleted: false },
  },
});

// Indexes for optimized queries
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ "reactions.user": 1 });

/**
 * Create a new message
 * @param {Object} messageData
 * @returns {Promise<Message>}
 */
messageSchema.statics.createMessage = async function (messageData) {
  const message = await this.create(messageData);

  // Populate sender details before returning
  return this.findById(message._id)
    .populate("senderDetails")
    .populate("replyToDetails");
};

/**
 * Get messages for a conversation with pagination
 * @param {String} conversationId
 * @param {Object} options
 * @param {Number} [options.limit=20]
 * @param {Date} [options.before]
 * @returns {Promise<Array<Message>>}
 */
messageSchema.statics.getMessages = async function (
  conversationId,
  { limit = 20, before } = {}
) {
  const query = { conversation: conversationId, isDeleted: false };

  if (before) {
    query.createdAt = { $lt: before };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderDetails")
    .populate("replyToDetails")
    .lean();
};

/**
 * Delete a message (soft delete)
 * @param {String} messageId
 * @param {String} userId
 * @param {Boolean} forEveryone
 * @returns {Promise<Message>}
 */
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
    // Only sender can delete for everyone
    if (message.sender.toString() !== userId) {
      throw new Error("Only sender can delete for everyone");
    }
    message.isDeleted = true;
    message.deletedFor = message.conversation.participants;
  } else {
    // Delete for this user only
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }
  }

  await message.save();
  return message;
};

/**
 * Add reaction to a message
 * @param {String} messageId
 * @param {String} userId
 * @param {String} emoji
 * @returns {Promise<Message>}
 */
messageSchema.statics.addReaction = async function (messageId, userId, emoji) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Remove existing reaction from this user
  message.reactions = message.reactions.filter(
    (reaction) => reaction.user.toString() !== userId
  );

  // Add new reaction
  message.reactions.push({ user: userId, emoji });
  await message.save();

  return this.findById(message._id)
    .populate("senderDetails")
    .populate("reactions.user", "username name profile.avatar");
};

/**
 * Remove reaction from a message
 * @param {String} messageId
 * @param {String} userId
 * @returns {Promise<Message>}
 */
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

/**
 * Update message status
 * @param {String} messageId
 * @param {String} status
 * @returns {Promise<Message>}
 */
messageSchema.statics.updateStatus = async function (messageId, status) {
  const validStatuses = ["sending", "sent", "delivered", "read", "failed"];

  if (!validStatuses.includes(status)) {
    throw new Error("Invalid message status");
  }

  const message = await this.findByIdAndUpdate(
    messageId,
    { status },
    { new: true }
  );

  if (!message) {
    throw new Error("Message not found");
  }

  return message;
};

const Message = model("Message", messageSchema);

export default Message;
