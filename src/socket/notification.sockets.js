import NotificationService from '../services/notification.service.js';

export const initNotificationSockets = (io) => {
  const notificationNamespace = io.of('/notifications');
  
  notificationNamespace.use(async (socket, next) => {
    try {
      // Reuse your existing auth logic
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      
      const secret = config.get("jwtSecret");
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select('_id username notificationPreferences');
      
      if (!user) return next(new Error('User not found'));
      
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  notificationNamespace.on('connection', (socket) => {
    console.log(`Notification socket connected: ${socket.user._id}`);

    // Join user-specific room
    socket.join(`user_${socket.user._id}`);

    // Real-time notification status updates
    socket.on('notification:read', async (data) => {
      try {
        await NotificationService.markNotificationsAsRead(
          socket.user._id, 
          data.notificationIds
        );
        
        // Send updated unread count
        const unreadCount = await NotificationService.getUnreadNotificationCount(socket.user._id);
        socket.emit('notification:status', { unreadCount });
      } catch (error) {
        socket.emit('notification:error', { error: error.message });
      }
    });

    // Request initial unread count
    socket.on('notification:request_count', async () => {
      const unreadCount = await NotificationService.getUnreadNotificationCount(socket.user._id);
      socket.emit('notification:count', { unreadCount });
    });

    socket.on('disconnect', () => {
      console.log(`Notification socket disconnected: ${socket.user._id}`);
    });
  });
};

/**
 * Enhanced real-time notification emitter
 * @param {Object} io - Socket.IO instance
 * @param {Object} params - { recipientId, senderId, type, relatedItem, metadata }
 */
export const emitRealTimeNotification = async (io, params) => {
  try {
    // Create notification using your service
    const notification = await NotificationService.sendNotification({
      ...params,
      io // Pass io instance for real-time delivery
    });

    if (!notification) return; // Skip if notification was blocked by preferences

    // Get populated notification data
    const populated = await Notification.findById(notification._id)
      .populate('sender', 'username profile.avatar')
      .populate({
        path: 'relatedItem',
        select: 'content images media',
        options: { retainNullValues: true }
      })
      .lean();

    // Emit to recipient's room
    io.of('/notifications')
      .to(`user_${params.recipientId}`)
      .emit('notification:new', populated);

    // Update unread count
    const unreadCount = await NotificationService.getUnreadNotificationCount(params.recipientId);
    io.of('/notifications')
      .to(`user_${params.recipientId}`)
      .emit('notification:count', { unreadCount });

  } catch (error) {
    console.error('Real-time notification error:', error);
  }
};