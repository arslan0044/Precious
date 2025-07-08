import mongoose from "mongoose";
import User from "../models/User.js";
import Notification from "../models/notification.js";

// Notification types configuration
const NOTIFICATION_TYPES = {
  LIKE: "like",
  COMMENT: "comment",
  FOLLOW: "follow",
  FOLLOW_REQUEST: "follow_request",
  FOLLOW_REQUEST_ACCEPTED: "follow_request_accepted",
  MENTION: "mention",
  MESSAGE: "message",
  MESSAGE_REQUEST: "message_request",
  POST_SHARED: "post_shared",
  TAGGED: "tagged",
  NEW_POST: "new_post",
  STORY_MENTION: "story_mention",
  STORY_REPLY: "story_reply",
  LIVE_STARTED: "live_started",
};

// Notification templates
const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.LIKE]: (sender, post) =>
    `${sender.username} liked your post`,
  [NOTIFICATION_TYPES.COMMENT]: (sender, post) =>
    `${sender.username} commented on your post`,
  [NOTIFICATION_TYPES.FOLLOW]: (sender) =>
    `${sender.username} started following you`,
  [NOTIFICATION_TYPES.FOLLOW_REQUEST]: (sender) =>
    `${sender.username} wants to follow you`,
  [NOTIFICATION_TYPES.FOLLOW_REQUEST_ACCEPTED]: (sender) =>
    `${sender.username} accepted your follow request`,
  [NOTIFICATION_TYPES.MENTION]: (sender, item) =>
    `${sender.username} mentioned you in a ${item.modelName.toLowerCase()}`,
  [NOTIFICATION_TYPES.MESSAGE]: (sender) =>
    `${sender.username} sent you a message`,
  [NOTIFICATION_TYPES.MESSAGE_REQUEST]: (sender) =>
    `${sender.username} sent you a message request`,
  [NOTIFICATION_TYPES.POST_SHARED]: (sender, post) =>
    `${sender.username} shared your post`,
  [NOTIFICATION_TYPES.TAGGED]: (sender, post) =>
    `${sender.username} tagged you in a post`,
  [NOTIFICATION_TYPES.NEW_POST]: (sender) =>
    `${sender.username} posted something new`,
  [NOTIFICATION_TYPES.STORY_MENTION]: (sender, story) =>
    `${sender.username} mentioned you in their story`,
  [NOTIFICATION_TYPES.STORY_REPLY]: (sender, story) =>
    `${sender.username} replied to your story`,
  [NOTIFICATION_TYPES.LIVE_STARTED]: (sender) =>
    `${sender.username} started a live video`,
};

/**
 * Global function to send notifications
 * @param {Object} params
 * @param {String} params.recipientId - ID of user receiving notification
 * @param {String} params.senderId - ID of user triggering notification
 * @param {String} params.type - Notification type from NOTIFICATION_TYPES
 * @param {Object} [params.relatedItem] - Related item (post, comment, etc.)
 * @param {Object} [params.metadata] - Additional notification data
 * @returns {Promise<Object>} Created notification
 */
export const sendNotification = async ({
  recipientId,
  senderId,
  type,
  relatedItem = null,
  metadata = {},
}) => {
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  // Check if recipient has disabled this notification type
  const recipient = await User.findById(recipientId).select(
    "notificationPreferences"
  );
  if (!recipient) {
    throw new Error("Recipient not found");
  }

  // Skip if user has disabled this notification type
  if (recipient.notificationPreferences?.[type] === false) {
    return null;
  }

  // Get sender details
  const sender = await User.findById(senderId).select("username");
  if (!sender) {
    throw new Error("Sender not found");
  }

  // Generate notification message
  const message = NOTIFICATION_TEMPLATES[type](sender, relatedItem);

  // Prepare notification data
  const notificationData = {
    recipient: recipientId,
    sender: senderId,
    type,
    message,
    metadata,
  };

  // Add related item if provided
  if (relatedItem) {
    notificationData.relatedItem = relatedItem._id;
    notificationData.relatedItemModel = relatedItem.constructor.modelName;

    // Add relevant metadata based on item type
    if (relatedItem.constructor.modelName === "Post") {
      notificationData.metadata.postPreviewUrl = relatedItem.images?.[0]?.url;
    } else if (relatedItem.constructor.modelName === "Story") {
      notificationData.metadata.storyThumbnail = relatedItem.media?.url;
    }
  }

  // Create and return notification
  return Notification.create(notificationData);
};

/**
 * Get user notifications with pagination
 * @param {String} userId
 * @param {Object} options
 * @param {Number} options.limit
 * @param {String} options.before - ISO date string for pagination
 * @returns {Promise<Array>} Array of notifications
 */
export const getUserNotifications = async (
  userId,
  { limit = 20, before } = {}
) => {
  const query = { recipient: userId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  return Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "username name profile.avatar")
    .populate({
      path: "relatedItem",
      select: "content images media",
      options: { retainNullValues: true },
    })
    .lean();
};

/**
 * Mark notifications as read
 * @param {String} userId
 * @param {Array<String>} notificationIds
 * @returns {Promise<Object>} MongoDB update result
 */
export const markNotificationsAsRead = async (userId, notificationIds) => {
  return Notification.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId,
    },
    { $set: { isRead: true } }
  );
};

/**
 * Mark all notifications as seen for user
 * @param {String} userId
 * @returns {Promise<Object>} MongoDB update result
 */
export const markAllNotificationsAsSeen = async (userId) => {
  return Notification.updateMany(
    { recipient: userId, isSeen: false },
    { $set: { isSeen: true } }
  );
};

/**
 * Get unread notification count for user
 * @param {String} userId
 * @returns {Promise<Number>} Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  return Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

/**
 * Clean up old notifications
 * @param {Number} daysOld - Delete notifications older than this many days
 * @returns {Promise<Object>} MongoDB delete result
 */
export const cleanupOldNotifications = async (daysOld = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return Notification.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

// Utility function to send push notifications
const sendPushNotification = async (userId, notification) => {
  // Implementation would depend on your push notification service
  // (Firebase, APNs, etc.)
};

export default {
  NOTIFICATION_TYPES,
  sendNotification,
  getUserNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsSeen,
  getUnreadNotificationCount,
  cleanupOldNotifications,
};
