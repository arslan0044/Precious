import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const notificationSchema = new Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'like', 
      'comment', 
      'follow', 
      'follow_request',
      'follow_request_accepted',
      'mention',
      'message',
      'message_request',
      'post_shared',
      'tagged',
      'new_post', // For close friends
      'story_mention',
      'story_reply',
      'live_started'
    ]
  },
  relatedItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return !['follow', 'follow_request', 'follow_request_accepted'].includes(this.type);
    },
    refPath: 'relatedItemModel'
  },
  relatedItemModel: {
    type: String,
    required: function() {
      return !['follow', 'follow_request', 'follow_request_accepted'].includes(this.type);
    },
    enum: [
      'Post', 
      'Comment', 
      'Message', 
      'Story',
      'Conversation'
    ]
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isSeen: {
    type: Boolean,
    default: false // For app badge counts
  },
  metadata: {
    // Additional context for the notification
    commentPreview: String,
    postPreviewUrl: String,
    storyThumbnail: String,
    liveThumbnail: String
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for optimized queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ isSeen: 1 });
notificationSchema.index({ type: 1 });

// Virtual for sender details (when populated)
notificationSchema.virtual('senderDetails', {
  ref: 'User',
  localField: 'sender',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'username name profile.avatar isVerified'
  }
});

// Virtual for related item details (when populated)
notificationSchema.virtual('relatedItemDetails', {
  ref: function() {
    return this.relatedItemModel;
  },
  localField: 'relatedItem',
  foreignField: '_id',
  justOne: true
});

/**
 * Create a new notification
 * @param {Object} notificationData 
 * @returns {Promise<Notification>}
 */
notificationSchema.statics.createNotification = async function(notificationData) {
  const notification = await this.create(notificationData);
  
  // Populate sender details before returning
  return this.findById(notification._id)
    .populate('senderDetails')
    .populate('relatedItemDetails');
};

/**
 * Get notifications for a user with pagination
 * @param {String} userId 
 * @param {Object} options 
 * @param {Number} [options.limit=20] 
 * @param {Date} [options.before] 
 * @returns {Promise<Array<Notification>>}
 */
notificationSchema.statics.getUserNotifications = async function(userId, { limit = 20, before } = {}) {
  const query = { recipient: userId };
  
  if (before) {
    query.createdAt = { $lt: before };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderDetails')
    .populate('relatedItemDetails')
    .lean();
};

/**
 * Mark notifications as read
 * @param {String|Array<String>} notificationIds 
 * @returns {Promise<Object>}
 */
notificationSchema.statics.markAsRead = async function(notificationIds) {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
  
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { isRead: true } }
  );
};

/**
 * Mark all notifications as seen for a user
 * @param {String} userId 
 * @returns {Promise<Object>}
 */
notificationSchema.statics.markAllAsSeen = async function(userId) {
  return this.updateMany(
    { recipient: userId, isSeen: false },
    { $set: { isSeen: true } }
  );
};

/**
 * Get unread notification count for a user
 * @param {String} userId 
 * @returns {Promise<Number>}
 */
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ 
    recipient: userId, 
    isRead: false 
  });
};

/**
 * Get unseen notification count for a user
 * @param {String} userId 
 * @returns {Promise<Number>}
 */
notificationSchema.statics.getUnseenCount = async function(userId) {
  return this.countDocuments({ 
    recipient: userId, 
    isSeen: false 
  });
};

/**
 * Delete notifications older than specified days
 * @param {Number} days 
 * @returns {Promise<Object>}
 */
notificationSchema.statics.cleanupOldNotifications = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.deleteMany({ 
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

const Notification = model('Notification', notificationSchema);

export default Notification;