import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { sendNotification } from '../utils/notification.js';
import User from '../models/User.js';
import config from "../config/env.js";

// Map to track connected users (userId -> socketId)
const connectedUsers = new Map();

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {socketIO.Server} Configured Socket.IO server
 */
export const initSocket = (server) => {
   const io = new Server(server, {
    // cors: {
    //   origin: process.env.CLIENT_URL,
    //   methods: ['GET', 'POST'],
    //   credentials: true
    // },
    transports: ['websocket', 'polling']
  }
);

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
    const secret = config.get("jwtSecret");
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.id).select('_id username isOnline');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id} (User: ${socket.user._id})`);

    // Add user to connected users map
    connectedUsers.set(socket.user._id.toString(), socket.id);
    
    // Update user online status
    User.findByIdAndUpdate(socket.user._id, { 
      isOnline: true,
      lastSeen: new Date()
    }).exec();

    // Join user to their personal room
    socket.join(`user_${socket.user._id}`);

    // Notification handler
    socket.on('notification:read', async (notificationId) => {
      try {
        await markNotificationsAsRead(socket.user._id, [notificationId]);
        socket.emit('notification:read:success', { notificationId });
      } catch (error) {
        socket.emit('notification:read:error', { error: error.message });
      }
    });

    // Typing indicator handler
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit('typing:start', {
        userId: socket.user._id,
        conversationId
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation_${conversationId}`).emit('typing:stop', {
        userId: socket.user._id,
        conversationId
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id} (User: ${socket.user._id})`);
      connectedUsers.delete(socket.user._id.toString());
      
      // Update user online status with delay to account for reconnects
      setTimeout(async () => {
        if (!connectedUsers.has(socket.user._id.toString())) {
          await User.findByIdAndUpdate(socket.user._id, { 
            isOnline: false,
            lastSeen: new Date()
          }).exec();
        }
      }, 5000); // 5 second delay
    });
  });

  return io;
};

/**
 * Send real-time notification to user
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - Recipient user ID
 * @param {Object} notification - Notification data
 */
export const sendRealTimeNotification = (io, userId, notification) => {
  const socketId = connectedUsers.get(userId.toString());
  
  if (socketId) {
    io.to(`user_${userId}`).emit('notification:new', notification);
  }
  
  // Also send push notification if user is offline
  if (!socketId) {
    sendPushNotification(userId, notification);
  }
};

/**
 * Broadcast typing indicator
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - Typing user ID
 * @param {String} conversationId - Conversation ID
 * @param {Boolean} isTyping - Typing status
 */
export const broadcastTyping = (io, userId, conversationId, isTyping) => {
  io.to(`conversation_${conversationId}`).emit(
    isTyping ? 'typing:start' : 'typing:stop',
    { userId, conversationId }
  );
};

/**
 * Join conversation room
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 */
export const joinConversation = (io, userId, conversationId) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.sockets.sockets.get(socketId)?.join(`conversation_${conversationId}`);
  }
};

/**
 * Leave conversation room
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} conversationId - Conversation ID
 */
export const leaveConversation = (io, userId, conversationId) => {
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.sockets.sockets.get(socketId)?.leave(`conversation_${conversationId}`);
  }
};

// Helper function to send push notifications (would integrate with FCM/APNs)
const sendPushNotification = async (userId, notification) => {
  // Implementation would depend on your push notification service
  console.log(`Sending push notification to user ${userId}:`, notification);
};