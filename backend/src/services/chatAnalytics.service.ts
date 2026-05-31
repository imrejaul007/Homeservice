import mongoose, { Types, PipelineStage } from 'mongoose';
import Message, { IMessage } from '../models/message.model';
import ChatRoom, { IChatRoom } from '../models/chatRoom.model';
import logger from '../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface MessageMetrics {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  mediaMessages: number;
  fileMessages: number;
  averageMessageLength: number;
}

export interface ResponseTimeMetrics {
  averageResponseTimeMs: number;
  medianResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  responseRate: number; // Percentage of messages that received a response
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  averageConversationDurationHours: number;
  messagesPerConversation: number;
}

export interface UserChatMetrics {
  userId: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  averageResponseTimeMs: number;
  responseRate: number;
  conversationsStarted: number;
  lastActiveAt: Date;
}

export interface DailyChatStats {
  date: string;
  totalMessages: number;
  uniqueUsers: number;
  uniqueConversations: number;
  averageResponseTimeMs: number;
}

// =============================================================================
// Chat Analytics Service
// =============================================================================

export class ChatAnalyticsService {
  // =============================================================================
  // Message Metrics
  // =============================================================================

  /**
   * Get message metrics for a user
   */
  async getMessageMetrics(userId: string, startDate?: Date, endDate?: Date): Promise<MessageMetrics> {
    const matchStage: Record<string, unknown> = {
      isDeleted: false,
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) (matchStage.createdAt as Record<string, unknown>)['$gte'] = startDate;
      if (endDate) (matchStage.createdAt as Record<string, unknown>)['$lte'] = endDate;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: {
            $sum: { $cond: [{ $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] }, 1, 0] }
          },
          receivedMessages: {
            $sum: { $cond: [{ $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] }, 1, 0] }
          },
          mediaMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'image'] }, 1, 0] }
          },
          fileMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'file'] }, 1, 0] }
          },
          totalLength: { $sum: { $strLenCP: '$content' } }
        }
      },
      {
        $project: {
          _id: 0,
          totalMessages: 1,
          sentMessages: 1,
          receivedMessages: 1,
          mediaMessages: 1,
          fileMessages: 1,
          averageMessageLength: {
            $cond: [
              { $gt: ['$totalMessages', 0] },
              { $divide: ['$totalLength', '$totalMessages'] },
              0
            ]
          }
        }
      }
    ];

    const result = await Message.aggregate(pipeline);

    return result[0] || {
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      mediaMessages: 0,
      fileMessages: 0,
      averageMessageLength: 0
    };
  }

  /**
   * Get message metrics for a chat room
   */
  async getChatRoomMessageMetrics(chatRoomId: string): Promise<MessageMetrics> {
    const pipeline = [
      {
        $match: {
          chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          sentMessages: { $sum: 1 },
          mediaMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'image'] }, 1, 0] }
          },
          fileMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'file'] }, 1, 0] }
          },
          totalLength: { $sum: { $cond: [{ $eq: ['$type', 'text'] }, { $strLenCP: '$content' }, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalMessages: 1,
          sentMessages: 1,
          receivedMessages: { $literal: 0 }, // Not applicable for room
          mediaMessages: 1,
          fileMessages: 1,
          averageMessageLength: {
            $cond: [
              { $gt: ['$totalMessages', 0] },
              { $divide: ['$totalLength', '$totalMessages'] },
              0
            ]
          }
        }
      }
    ];

    const result = await Message.aggregate(pipeline);

    return result[0] || {
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      mediaMessages: 0,
      fileMessages: 0,
      averageMessageLength: 0
    };
  }

  // =============================================================================
  // Response Time Metrics
  // =============================================================================

  /**
   * Calculate response time metrics for a user in a specific conversation
   */
  async getResponseTimeMetrics(
    userId: string,
    chatRoomId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ResponseTimeMetrics> {
    const matchStage: Record<string, unknown> = {
      isDeleted: false,
      receiverId: new mongoose.Types.ObjectId(userId)
    };

    if (chatRoomId) {
      matchStage.chatRoomId = new mongoose.Types.ObjectId(chatRoomId);
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) (matchStage.createdAt as Record<string, unknown>)['$gte'] = startDate;
      if (endDate) (matchStage.createdAt as Record<string, unknown>)['$lte'] = endDate;
    }

    // Get all messages sent to this user, sorted by conversation and time
    const messagesToUser = await Message.aggregate([
      { $match: matchStage },
      { $sort: { chatRoomId: 1, createdAt: 1 } },
      {
        $group: {
          _id: '$chatRoomId',
          messages: {
            $push: {
              _id: '$_id',
              senderId: '$senderId',
              createdAt: '$createdAt'
            }
          }
        }
      }
    ]);

    const responseTimes: number[] = [];
    let responsesWithReply = 0;
    let totalMessages = 0;

    for (const room of messagesToUser) {
      for (let i = 0; i < room.messages.length - 1; i++) {
        const currentMsg = room.messages[i];
        const nextMsg = room.messages[i + 1];

        // If next message is from a different user (a response)
        if (currentMsg.senderId.toString() !== nextMsg.senderId.toString()) {
          const responseTime = new Date(nextMsg.createdAt).getTime() - new Date(currentMsg.createdAt).getTime();
          responseTimes.push(responseTime);
          responsesWithReply++;
        }
        totalMessages++;
      }
    }

    if (responseTimes.length === 0) {
      return {
        averageResponseTimeMs: 0,
        medianResponseTimeMs: 0,
        minResponseTimeMs: 0,
        maxResponseTimeMs: 0,
        responseRate: 0
      };
    }

    responseTimes.sort((a, b) => a - b);

    const sum = responseTimes.reduce((acc, val) => acc + val, 0);
    const medianIndex = Math.floor(responseTimes.length / 2);

    return {
      averageResponseTimeMs: Math.round(sum / responseTimes.length),
      medianResponseTimeMs: responseTimes[medianIndex],
      minResponseTimeMs: responseTimes[0],
      maxResponseTimeMs: responseTimes[responseTimes.length - 1],
      responseRate: totalMessages > 0 ? (responsesWithReply / totalMessages) * 100 : 0
    };
  }

  /**
   * Get average response time across all user conversations
   */
  async getOverallResponseTimeMetrics(userId: string): Promise<ResponseTimeMetrics> {
    return this.getResponseTimeMetrics(userId);
  }

  // =============================================================================
  // Conversation Stats
  // =============================================================================

  /**
   * Get conversation statistics for a user
   */
  async getConversationStats(userId: string): Promise<ConversationStats> {
    const rooms = await ChatRoom.find({
      'participants.userId': new mongoose.Types.ObjectId(userId),
      isDeleted: false
    });

    const activeRooms = rooms.filter(r => r.status === 'active');
    const archivedRooms = rooms.filter(r => r.status === 'archived');

    // Calculate average conversation duration
    let totalDurationHours = 0;
    for (const room of rooms) {
      const createdAt = new Date(room.createdAt);
      const lastMessageAt = room.lastMessageAt ? new Date(room.lastMessageAt) : new Date();
      const durationHours = (lastMessageAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      totalDurationHours += durationHours;
    }

    // Get message counts per conversation
    const roomIds = rooms.map(r => r._id);
    const messageCounts = await Message.aggregate([
      {
        $match: {
          chatRoomId: { $in: roomIds },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$chatRoomId',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalMessages = messageCounts.reduce((acc, val) => acc + val.count, 0);

    return {
      totalConversations: rooms.length,
      activeConversations: activeRooms.length,
      archivedConversations: archivedRooms.length,
      averageConversationDurationHours: rooms.length > 0 ? totalDurationHours / rooms.length : 0,
      messagesPerConversation: rooms.length > 0 ? totalMessages / rooms.length : 0
    };
  }

  /**
   * Get chat room statistics
   */
  async getChatRoomStats(chatRoomId: string): Promise<{
    totalMessages: number;
    participantCount: number;
    messageCount: number;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
    averageMessagesPerDay: number;
    activeDays: number;
  }> {
    const room = await ChatRoom.findById(chatRoomId);
    if (!room) {
      throw new Error('Chat room not found');
    }

    const messageStats = await Message.aggregate([
      {
        $match: {
          chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          firstMessageAt: { $min: '$createdAt' },
          lastMessageAt: { $max: '$createdAt' }
        }
      }
    ]);

    // Get unique active days
    const activeDaysResult = await Message.aggregate([
      {
        $match: {
          chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          }
        }
      },
      {
        $count: 'activeDays'
      }
    ]);

    const stats = messageStats[0] || { totalMessages: 0, firstMessageAt: null, lastMessageAt: null };
    const activeDays = activeDaysResult[0]?.activeDays || 0;

    let averageMessagesPerDay = 0;
    if (stats.firstMessageAt && stats.lastMessageAt && activeDays > 0) {
      const durationDays = (new Date(stats.lastMessageAt).getTime() - new Date(stats.firstMessageAt).getTime()) / (1000 * 60 * 60 * 24);
      averageMessagesPerDay = durationDays > 0 ? stats.totalMessages / Math.max(durationDays, 1) : stats.totalMessages;
    }

    return {
      totalMessages: stats.totalMessages,
      participantCount: room.participants.length,
      messageCount: stats.totalMessages,
      firstMessageAt: stats.firstMessageAt,
      lastMessageAt: stats.lastMessageAt,
      averageMessagesPerDay: Math.round(averageMessagesPerDay * 100) / 100,
      activeDays
    };
  }

  // =============================================================================
  // User Chat Metrics
  // =============================================================================

  /**
   * Get detailed chat metrics for a specific user
   */
  async getUserChatMetrics(userId: string): Promise<UserChatMetrics> {
    const [sentCount, receivedCount, responseTimeMetrics] = await Promise.all([
      Message.countDocuments({
        senderId: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      }),
      Message.countDocuments({
        receiverId: new mongoose.Types.ObjectId(userId),
        isDeleted: false
      }),
      this.getResponseTimeMetrics(userId)
    ]);

    // Count conversations started by user
    const roomsStarted = await ChatRoom.countDocuments({
      'participants.userId': new mongoose.Types.ObjectId(userId),
      'participants.role': 'owner',
      isDeleted: false
    });

    // Get last activity
    const lastMessage = await Message.findOne({
      $or: [
        { senderId: new mongoose.Types.ObjectId(userId) },
        { receiverId: new mongoose.Types.ObjectId(userId) }
      ],
      isDeleted: false
    }).sort({ createdAt: -1 });

    return {
      userId,
      totalMessagesSent: sentCount,
      totalMessagesReceived: receivedCount,
      averageResponseTimeMs: responseTimeMetrics.averageResponseTimeMs,
      responseRate: responseTimeMetrics.responseRate,
      conversationsStarted: roomsStarted,
      lastActiveAt: lastMessage?.createdAt || new Date()
    };
  }

  // =============================================================================
  // Daily Statistics
  // =============================================================================

  /**
   * Get daily chat statistics for a date range
   */
  async getDailyChatStats(
    startDate: Date,
    endDate: Date,
    chatRoomId?: string
  ): Promise<DailyChatStats[]> {
    const matchStage: Record<string, unknown> = {
      isDeleted: false,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (chatRoomId) {
      matchStage.chatRoomId = new mongoose.Types.ObjectId(chatRoomId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalMessages: { $sum: 1 },
          uniqueUsers: { $addToSet: '$senderId' },
          uniqueConversations: { $addToSet: '$chatRoomId' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalMessages: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          uniqueConversations: { $size: '$uniqueConversations' },
          averageResponseTimeMs: { $literal: 0 } // Placeholder
        }
      },
      { $sort: { date: 1 as const } }
    ] as PipelineStage[];

    return Message.aggregate(pipeline) as Promise<DailyChatStats[]>;
  }

  /**
   * Get hourly message distribution for a specific day
   */
  async getHourlyDistribution(date: Date): Promise<Array<{ hour: number; count: number }>> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const pipeline = [
      {
        $match: {
          isDeleted: false,
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          count: 1
        }
      },
      { $sort: { hour: 1 as const } }
    ] as PipelineStage[];

    return Message.aggregate(pipeline);
  }

  // =============================================================================
  // Top Participants
  // =============================================================================

  /**
   * Get top messaging participants in a chat room
   */
  async getTopParticipants(
    chatRoomId: string,
    limit: number = 10
  ): Promise<Array<{ userId: string; messageCount: number; percentage: number }>> {
    const pipeline = [
      {
        $match: {
          chatRoomId: new mongoose.Types.ObjectId(chatRoomId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$senderId',
          messageCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          messageCount: 1
        }
      },
      { $sort: { messageCount: -1 as const } },
      { $limit: limit }
    ] as PipelineStage[];

    const participants = await Message.aggregate(pipeline);
    const totalMessages = participants.reduce((acc, p) => acc + p.messageCount, 0);

    return participants.map(p => ({
      userId: p.userId.toString(),
      messageCount: p.messageCount,
      percentage: totalMessages > 0 ? Math.round((p.messageCount / totalMessages) * 100) : 0
    }));
  }

  // =============================================================================
  // Activity Reports
  // =============================================================================

  /**
   * Get chat activity summary for admin dashboard
   */
  async getActivitySummary(days: number = 7): Promise<{
    totalMessages: number;
    uniqueActiveUsers: number;
    activeConversations: number;
    averageResponseTimeMs: number;
    dailyAverage: number;
    peakHour: number;
    peakDay: string;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [messageStats, userStats, roomStats, responseTimeStats, hourlyStats, dailyStats] = await Promise.all([
      Message.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: startDate } } },
        { $count: 'total' }
      ]),
      Message.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: startDate } } },
        { $group: { _id: '$senderId' } },
        { $count: 'count' }
      ]),
      ChatRoom.countDocuments({ status: 'active', isDeleted: false }),
      this.getOverallResponseTimeMetrics('000000000000000000000000'), // Placeholder - won't work
      this.getHourlyDistribution(new Date()),
      this.getDailyChatStats(startDate, new Date())
    ]);

    const totalMessages = messageStats[0]?.total || 0;
    const uniqueActiveUsers = userStats[0]?.count || 0;

    // Find peak hour
    let peakHour = 0;
    let maxHourCount = 0;
    for (const stat of hourlyStats) {
      if (stat.count > maxHourCount) {
        maxHourCount = stat.count;
        peakHour = stat.hour;
      }
    }

    // Find peak day
    let peakDay = '';
    let maxDayCount = 0;
    for (const stat of dailyStats) {
      if (stat.totalMessages > maxDayCount) {
        maxDayCount = stat.totalMessages;
        peakDay = stat.date;
      }
    }

    return {
      totalMessages,
      uniqueActiveUsers,
      activeConversations: roomStats,
      averageResponseTimeMs: 0, // Would need proper user context
      dailyAverage: Math.round(totalMessages / days),
      peakHour,
      peakDay
    };
  }
}

// =============================================================================
// Export
// =============================================================================

export const chatAnalyticsService = new ChatAnalyticsService();
export default chatAnalyticsService;
