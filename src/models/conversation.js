import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const conversationSchema = new Schema({
  // Participants in the conversation
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: {
      validator: function(participants) {
        return participants.length >= 2;
      },
      message: 'A conversation must have at least 2 participants'
    }
  }],

  // Group conversation details
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    trim: true,
    required: function() {
      return this.isGroup;
    }
  },
  groupPhoto: {
    type: String,
    default: null
  },
  groupAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.isGroup;
    }
  },

  // Message metadata
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },

  // Privacy and settings
  isArchived: {
    type: Map,
    of: Boolean,
    default: {}
  },
  isMuted: {
    type: Map,
    of: Boolean,
    default: {}
  },

  // System fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
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

// Virtual for participant details (when populated)
conversationSchema.virtual('participantDetails', {
  ref: 'User',
  localField: 'participants',
  foreignField: '_id',
  options: { 
    select: 'username name profile.avatar isOnline lastSeen'
  }
});

// Virtual for last message details (when populated)
conversationSchema.virtual('lastMessageDetails', {
  ref: 'Message',
  localField: 'lastMessage',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'content sender createdAt status media'
  }
});

// Indexes for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessage: 1 });
conversationSchema.index({ updatedAt: -1 });

/**
 * Find or create a conversation between users
 * @param {Array} participantIds - Array of user IDs
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.findOrCreateConversation = async function(participantIds) {
  if (participantIds.length < 2) {
    throw new Error('At least 2 participants are required');
  }

  // Sort participant IDs to ensure unique conversation for same participants
  const sortedIds = [...participantIds].sort();

  // Check if conversation already exists
  let conversation = await this.findOne({
    participants: { $all: sortedIds },
    isGroup: false
  }).populate('participantDetails');

  if (!conversation) {
    conversation = await this.create({
      participants: sortedIds,
      isGroup: false
    });
    conversation = await this.findById(conversation._id).populate('participantDetails');
  }

  return conversation;
};

/**
 * Create a group conversation
 * @param {Object} options
 * @param {Array} options.participantIds - Array of user IDs
 * @param {String} options.groupName - Name of the group
 * @param {String} options.adminId - ID of the group admin
 * @param {String} [options.groupPhoto] - URL of group photo
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.createGroupConversation = async function({ 
  participantIds, 
  groupName, 
  adminId, 
  groupPhoto = null 
}) {
  if (participantIds.length < 2) {
    throw new Error('At least 2 participants are required');
  }

  if (!participantIds.includes(adminId)) {
    throw new Error('Admin must be a participant');
  }

  const conversation = await this.create({
    participants: participantIds,
    isGroup: true,
    groupName,
    groupPhoto,
    groupAdmin: adminId
  });

  return this.findById(conversation._id).populate('participantDetails');
};

/**
 * Add participants to a group conversation
 * @param {String} conversationId 
 * @param {Array} participantIds 
 * @param {String} adminId 
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.addParticipants = async function(conversationId, participantIds, adminId) {
  const conversation = await this.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (!conversation.isGroup) {
    throw new Error('Only group conversations can have participants added');
  }

  if (conversation.groupAdmin.toString() !== adminId) {
    throw new Error('Only group admin can add participants');
  }

  // Filter out existing participants
  const newParticipants = participantIds.filter(
    id => !conversation.participants.includes(id)
  );

  if (newParticipants.length === 0) {
    return conversation;
  }

  conversation.participants.push(...newParticipants);
  await conversation.save();

  return this.findById(conversation._id).populate('participantDetails');
};

/**
 * Remove participant from group conversation
 * @param {String} conversationId 
 * @param {String} participantId 
 * @param {String} adminId 
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.removeParticipant = async function(conversationId, participantId, adminId) {
  const conversation = await this.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (!conversation.isGroup) {
    throw new Error('Only group conversations can have participants removed');
  }

  if (conversation.groupAdmin.toString() !== adminId) {
    throw new Error('Only group admin can remove participants');
  }

  if (conversation.groupAdmin.toString() === participantId) {
    throw new Error('Admin cannot remove themselves');
  }

  conversation.participants = conversation.participants.filter(
    id => id.toString() !== participantId
  );

  await conversation.save();
  return this.findById(conversation._id).populate('participantDetails');
};

/**
 * Update conversation last message and unread counts
 * @param {String} conversationId 
 * @param {String} messageId 
 * @param {String} senderId 
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.updateLastMessage = async function(conversationId, messageId, senderId) {
  const conversation = await this.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Increment unread count for all participants except sender
  conversation.participants.forEach(participantId => {
    if (participantId.toString() !== senderId) {
      const currentCount = conversation.unreadCount.get(participantId.toString()) || 0;
      conversation.unreadCount.set(participantId.toString(), currentCount + 1);
    }
  });

  conversation.lastMessage = messageId;
  conversation.updatedAt = new Date();
  await conversation.save();

  return conversation;
};

/**
 * Mark conversation as read for a user
 * @param {String} conversationId 
 * @param {String} userId 
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.markAsRead = async function(conversationId, userId) {
  const conversation = await this.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.unreadCount.has(userId)) {
    conversation.unreadCount.set(userId, 0);
    await conversation.save();
  }

  return conversation;
};

const Conversation = model('Conversation', conversationSchema);

export default Conversation;