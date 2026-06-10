import mongoose, { Types } from 'mongoose';
import ChatRoom from '../models/chatRoom.model';
import Message from '../models/message.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { liveChatSessionStore } from './liveChatSessionStore';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ChatSessionStatus = 'waiting' | 'active' | 'ended' | 'transferred';
export type AgentStatus = 'available' | 'busy' | 'away' | 'offline';
export type ChatPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChatSession {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  agentId?: mongoose.Types.ObjectId;
  agentName?: string;
  status: ChatSessionStatus;
  priority: ChatPriority;
  queuePosition?: number;
  estimatedWaitTime?: number; // in minutes
  startedAt?: Date;
  endedAt?: Date;
  rating?: number;
  feedback?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  _id: mongoose.Types.ObjectId;
  chatRoomId: mongoose.Types.ObjectId;
  sessionId: string;
  senderId: mongoose.Types.ObjectId;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  readAt?: Date;
  createdAt: Date;
}

export interface Agent {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  status: AgentStatus;
  currentChats: number;
  maxChats: number;
  specialties: string[];
  avgResponseTime: number; // in seconds
  totalChats: number;
  rating: number;
}

export interface QueueEntry {
  position: number;
  estimatedWaitTime: number;
  priority: ChatPriority;
  customerId: string;
  sessionId: string;
  createdAt: Date;
}

// In-memory queue — hydrated from Redis on startup
const chatQueue: QueueEntry[] = [];
let queueHydrated = false;

// Agent session mapping
const agentSessions: Map<string, string[]> = new Map(); // agentId -> sessionIds

async function hydrateQueueFromRedis(): Promise<void> {
  if (queueHydrated) return;
  const stored = await liveChatSessionStore.getQueue();
  if (stored.length > 0) {
    chatQueue.splice(0, chatQueue.length, ...stored);
  }
  queueHydrated = true;
}

// ============================================
// LIVE CHAT SERVICE CLASS
// ============================================

export class LiveChatService {

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  /**
   * Start a new chat session
   */
  async startSession(
    customerId: string,
    customerName: string,
    customerEmail: string,
    initialMessage?: string,
    priority: ChatPriority = 'normal',
    tags: string[] = []
  ): Promise<{ session: ChatSession; chatRoomId: string }> {
    await hydrateQueueFromRedis();

    // Create a support chat room
    const chatRoom = new ChatRoom({
      type: 'support',
      name: `Support Chat - ${customerName}`,
      participants: [
        {
          userId: new Types.ObjectId(customerId),
          role: 'member',
          joinedAt: new Date()
        }
      ],
      status: 'active',
      settings: {
        allowMessages: true,
        notificationsEnabled: true
      }
    });

    await chatRoom.save();

    // Generate unique session ID
    const sessionId = `CS${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create session record (stored in memory for real-time, persisted to DB)
    const session: ChatSession = {
      _id: new Types.ObjectId(),
      sessionId,
      customerId: new Types.ObjectId(customerId),
      customerName,
      customerEmail,
      status: 'waiting',
      priority,
      tags,
      queuePosition: 1,
      estimatedWaitTime: this.calculateEstimatedWaitTime(),
      createdAt: new Date(),
      updatedAt: new Date()
    } as ChatSession;

    // Add to queue
    this.addToQueue(session);

    // Send initial message if provided
    if (initialMessage) {
      await this.addMessage(
        chatRoom._id.toString(),
        sessionId,
        customerId,
        'customer',
        customerName,
        initialMessage
      );
    }

    // Try to assign an agent
    const agentAssignment = await this.assignAgent(session);
    if (agentAssignment) {
      session.agentId = agentAssignment.agentId;
      session.agentName = agentAssignment.agentName;
      session.status = 'active';
      session.startedAt = new Date();
      session.queuePosition = undefined;
      session.estimatedWaitTime = undefined;

      // Add agent to chat room
      await ChatRoom.findByIdAndUpdate(chatRoom._id, {
        $push: {
          participants: {
            userId: agentAssignment.agentId,
            role: 'admin',
            joinedAt: new Date()
          }
        }
      });

      // Add system message
      await this.addSystemMessage(
        chatRoom._id.toString(),
        sessionId,
        `${agentAssignment.agentName} has joined the chat`
      );
    }

    await liveChatSessionStore.saveSession(session);

    logger.info('Chat session started', {
      context: 'LiveChatService',
      action: 'SESSION_STARTED',
      sessionId,
      customerId,
      agentId: session.agentId?.toString(),
      status: session.status
    });

    return { session, chatRoomId: chatRoom._id.toString() };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    const persisted = await liveChatSessionStore.getSession(sessionId);
    if (persisted) return persisted;

    const session = chatQueue.find(q => q.sessionId === sessionId);
    if (session) {
      return {
        _id: new Types.ObjectId(),
        sessionId: session.sessionId,
        customerId: new Types.ObjectId(session.customerId),
        customerName: '',
        customerEmail: '',
        status: 'waiting',
        priority: session.priority,
        queuePosition: session.position,
        estimatedWaitTime: session.estimatedWaitTime,
        tags: [],
        createdAt: session.createdAt,
        updatedAt: new Date()
      } as ChatSession;
    }
    return null;
  }

  /**
   * End a chat session
   */
  async endSession(sessionId: string, userId: string, userType: 'customer' | 'agent'): Promise<ChatSession> {
    // Find the chat room for this session
    const chatRoom = await ChatRoom.findOne({
      type: 'support',
      'participants.userId': new Types.ObjectId(userId)
    }).sort({ createdAt: -1 });

    if (!chatRoom) {
      throw new ApiError(404, 'Chat session not found');
    }

    // Update session status
    const sessionData: Partial<ChatSession> = {
      status: 'ended',
      endedAt: new Date()
    };

    // Add system message
    const enderName = userType === 'customer' ? 'Customer' : 'Agent';
    await this.addSystemMessage(
      chatRoom._id.toString(),
      sessionId,
      `${enderName} has ended the chat`
    );

    // Remove from queue if still waiting
    const queueIndex = chatQueue.findIndex(q => q.sessionId === sessionId);
    if (queueIndex !== -1) {
      chatQueue.splice(queueIndex, 1);
      this.updateQueuePositions();
    }

    // Remove agent from active sessions
    if (userType === 'agent') {
      this.removeAgentSession(userId, sessionId);
    }

    logger.info('Chat session ended', {
      context: 'LiveChatService',
      action: 'SESSION_ENDED',
      sessionId,
      endedBy: userId,
      userType
    });

    return {
      _id: chatRoom._id,
      sessionId,
      customerId: new Types.ObjectId(),
      customerName: '',
      customerEmail: '',
      status: 'ended',
      priority: 'normal',
      endedAt: new Date(),
      tags: [],
      createdAt: chatRoom.createdAt,
      updatedAt: new Date()
    } as ChatSession;
  }

  /**
   * Transfer chat to another agent
   */
  async transferSession(
    sessionId: string,
    fromAgentId: string,
    toAgentId?: string,
    reason?: string
  ): Promise<{ success: boolean; newAgentId?: string; newAgentName?: string }> {
    // Find the chat room
    const chatRoom = await ChatRoom.findOne({
      type: 'support',
      'participants.userId': new Types.ObjectId(fromAgentId)
    }).sort({ createdAt: -1 });

    if (!chatRoom) {
      throw new ApiError(404, 'Chat session not found');
    }

    // Remove old agent from participants
    chatRoom.participants = chatRoom.participants.filter(
      p => !p.userId.equals(new Types.ObjectId(fromAgentId)) || p.role !== 'admin'
    );

    // Find new agent
    let newAgentId = toAgentId;
    let newAgentName = 'Support Team';

    if (toAgentId) {
      const agent = await User.findById(toAgentId).select('firstName lastName');
      if (agent) {
        newAgentName = `${agent.firstName} ${agent.lastName}`;
      }
    } else {
      // Auto-assign to available agent
      const assignment = await this.assignAgentToQueue();
      if (assignment) {
        newAgentId = assignment.agentId;
        newAgentName = assignment.agentName;
      } else {
        // Put back in queue
        chatQueue.push({
          position: chatQueue.length + 1,
          estimatedWaitTime: this.calculateEstimatedWaitTime(),
          priority: 'normal',
          customerId: fromAgentId,
          sessionId,
          createdAt: new Date(),
        });
        return { success: true };
      }
    }

    if (newAgentId) {
      // Add new agent to participants
      chatRoom.participants.push({
        userId: new Types.ObjectId(newAgentId),
        role: 'admin',
        joinedAt: new Date()
      });
      await chatRoom.save();

      // Add system message
      await this.addSystemMessage(
        chatRoom._id.toString(),
        sessionId,
        `Chat transferred${reason ? `: ${reason}` : ''}. ${newAgentName} has joined.`
      );

      // Update agent sessions
      this.removeAgentSession(fromAgentId, sessionId);
      this.addAgentSession(newAgentId, sessionId);
    }

    logger.info('Chat session transferred', {
      context: 'LiveChatService',
      action: 'SESSION_TRANSFERRED',
      sessionId,
      fromAgentId,
      toAgentId: newAgentId,
      reason
    });

    return {
      success: true,
      newAgentId,
      newAgentName
    };
  }

  // ========================================
  // MESSAGE MANAGEMENT
  // ========================================

  /**
   * Add a message to the chat
   */
  async addMessage(
    chatRoomId: string,
    sessionId: string,
    senderId: string,
    senderType: 'customer' | 'agent' | 'system',
    senderName: string,
    content: string,
    type: 'text' | 'image' | 'file' | 'system' = 'text',
    attachments?: Array<{ url: string; filename: string; mimeType: string; size: number }>
  ): Promise<ChatMessage> {
    const message = new Message({
      chatRoom: new Types.ObjectId(chatRoomId),
      sender: new Types.ObjectId(senderId),
      senderType,
      senderName,
      content,
      type,
      attachments,
      readAt: senderType !== 'customer' ? new Date() : undefined,
      metadata: { sessionId }
    });

    await message.save();

    // Update chat room last message
    await ChatRoom.findByIdAndUpdate(chatRoomId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
      lastMessagePreview: content.substring(0, 100)
    });

    return {
      _id: message._id,
      chatRoomId: new Types.ObjectId(chatRoomId),
      sessionId,
      senderId: new Types.ObjectId(senderId),
      senderType,
      senderName,
      content,
      type,
      attachments,
      readAt: message.readAt,
      createdAt: message.createdAt
    } as ChatMessage;
  }

  /**
   * Add a system message
   */
  async addSystemMessage(
    chatRoomId: string,
    sessionId: string,
    content: string
  ): Promise<ChatMessage> {
    return this.addMessage(
      chatRoomId,
      sessionId,
      'system',
      'system',
      'System',
      content,
      'system'
    );
  }

  /**
   * Get messages for a chat room
   */
  async getMessages(
    chatRoomId: string,
    userId: string,
    limit: number = 50,
    before?: Date
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const query: Record<string, unknown> = { chatRoom: new Types.ObjectId(chatRoomId) };

    if (before) {
      query.createdAt = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Mark messages as read for the user
    const unreadMessages = resultMessages.filter(
      (m) => {
        const msg = m as any;
        return msg.senderId?.toString() !== userId && msg.sender?.toString() !== userId && !msg.readAt;
      }
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: unreadMessages.map(m => m._id) }
        },
        { readAt: new Date() }
      );
    }

    return {
      messages: resultMessages.reverse().map((m) => {
        const msg = m as any;
        return {
          _id: msg._id,
          chatRoomId: msg.chatRoomId ?? msg.chatRoom,
          sessionId: (msg.metadata as Record<string, string>)?.sessionId || '',
          senderId: msg.senderId ?? msg.sender,
          senderType: msg.senderType ?? 'customer',
          senderName: msg.senderName ?? 'User',
          content: msg.content,
          type: msg.type,
          attachments: msg.attachments,
          readAt: msg.readAt,
          createdAt: msg.createdAt,
        };
      }) as ChatMessage[],
      hasMore
    };
  }

  /**
   * Mark messages as read
   */
  async markAsRead(chatRoomId: string, userId: string): Promise<number> {
    const result = await Message.updateMany(
      {
        chatRoom: new Types.ObjectId(chatRoomId),
        sender: { $ne: new Types.ObjectId(userId) },
        readAt: { $exists: false }
      },
      { readAt: new Date() }
    );

    return result.modifiedCount;
  }

  // ========================================
  // AGENT MANAGEMENT
  // ========================================

  /**
   * Get available agents
   */
  async getAvailableAgents(): Promise<Agent[]> {
    // In production, query actual support agent users
    const agents = await User.find({
      role: 'admin',
      accountStatus: 'active'
    })
      .select('_id firstName lastName email')
      .lean();

    return agents.map(agent => ({
      _id: new Types.ObjectId(),
      userId: agent._id as mongoose.Types.ObjectId,
      name: `${agent.firstName} ${agent.lastName}`,
      email: agent.email,
      status: 'available' as AgentStatus,
      currentChats: agentSessions.get(agent._id.toString())?.length || 0,
      maxChats: 5,
      specialties: ['general', 'billing', 'technical'],
      avgResponseTime: 45,
      totalChats: Math.floor(Math.random() * 500) + 100,
      rating: 4.5 + Math.random() * 0.5
    }));
  }

  /**
   * Assign agent to session
   */
  async assignAgent(session: Partial<ChatSession>): Promise<{ agentId: mongoose.Types.ObjectId; agentName: string } | null> {
    const availableAgents = await this.getAvailableAgents();
    const agent = availableAgents.find(a => a.currentChats < a.maxChats);

    if (!agent) {
      return null;
    }

    return {
      agentId: agent.userId,
      agentName: agent.name
    };
  }

  /**
   * Assign agent from queue
   */
  private async assignAgentToQueue(): Promise<{ agentId: string; agentName: string } | null> {
    if (chatQueue.length === 0) return null;

    const entry = chatQueue[0];
    const agent = await this.assignAgent({
      priority: entry.priority
    } as Partial<ChatSession>);

    if (agent) {
      chatQueue.shift();
      this.updateQueuePositions();
      return {
        agentId: agent.agentId.toString(),
        agentName: agent.agentName
      };
    }

    return null;
  }

  /**
   * Set agent status
   */
  async setAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    // In production, update agent status in database
    logger.info('Agent status changed', {
      context: 'LiveChatService',
      action: 'AGENT_STATUS_CHANGED',
      agentId,
      status
    });

    // If going offline, reassign sessions
    if (status === 'offline') {
      const sessions = agentSessions.get(agentId) || [];
      for (const sessionId of sessions) {
        await this.transferSession(sessionId, agentId);
      }
    }
  }

  // ========================================
  // QUEUE MANAGEMENT
  // ========================================

  /**
   * Add session to queue
   */
  private addToQueue(session: ChatSession): void {
    // Insert based on priority
    let insertIndex = chatQueue.length;
    for (let i = 0; i < chatQueue.length; i++) {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      if (priorityOrder[session.priority] < priorityOrder[chatQueue[i].priority]) {
        insertIndex = i;
        break;
      }
    }

    chatQueue.splice(insertIndex, 0, {
      position: insertIndex + 1,
      estimatedWaitTime: this.calculateEstimatedWaitTime(),
      priority: session.priority,
      customerId: session.customerId.toString(),
      sessionId: session.sessionId,
      createdAt: new Date(),
    });

    this.updateQueuePositions();
    this.syncQueueToRedis().catch(() => {});
  }

  /**
   * Update queue positions
   */
  private updateQueuePositions(): void {
    chatQueue.forEach((entry, index) => {
      entry.position = index + 1;
      entry.estimatedWaitTime = this.calculateEstimatedWaitTime();
    });
  }

  private async syncQueueToRedis(): Promise<void> {
    await liveChatSessionStore.setQueue([...chatQueue]);
  }

  /**
   * Calculate estimated wait time based on queue
   */
  private calculateEstimatedWaitTime(): number {
    const avgHandlingTime = 5; // minutes per chat
    return chatQueue.length * avgHandlingTime;
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{ position: number; estimatedWaitTime: number; queueLength: number }> {
    return {
      position: chatQueue.length + 1,
      estimatedWaitTime: this.calculateEstimatedWaitTime(),
      queueLength: chatQueue.length
    };
  }

  // ========================================
  // AGENT SESSION TRACKING
  // ========================================

  private addAgentSession(agentId: string, sessionId: string): void {
    const sessions = agentSessions.get(agentId) || [];
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      agentSessions.set(agentId, sessions);
    }
  }

  private removeAgentSession(agentId: string, sessionId: string): void {
    const sessions = agentSessions.get(agentId) || [];
    const index = sessions.indexOf(sessionId);
    if (index !== -1) {
      sessions.splice(index, 1);
      agentSessions.set(agentId, sessions);
    }
  }

  // ========================================
  // CHAT HISTORY
  // ========================================

  /**
   * Get chat history for a user
   */
  async getChatHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ sessions: Partial<ChatSession>[]; total: number }> {
    const rooms = await ChatRoom.find({
      type: 'support',
      'participants.userId': new Types.ObjectId(userId),
      isDeleted: false
    })
      .sort({ lastMessageAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('lastMessage')
      .lean();

    const total = await ChatRoom.countDocuments({
      type: 'support',
      'participants.userId': new Types.ObjectId(userId),
      isDeleted: false
    });

    const sessions = rooms.map(room => ({
      _id: room._id,
      sessionId: room._id.toString(),
      customerId: room.participants.find(p => p.role === 'member')?.userId || new Types.ObjectId(),
      customerName: room.name?.replace('Support Chat - ', '') || 'Customer',
      status: room.lastMessageAt ? 'ended' as ChatSessionStatus : 'waiting' as ChatSessionStatus,
      tags: [],
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    }));

    return { sessions, total };
  }

  // ========================================
  // RATING & FEEDBACK
  // ========================================

  /**
   * Rate a chat session
   */
  async rateSession(
    sessionId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new ApiError(400, 'Rating must be between 1 and 5');
    }

    logger.info('Chat session rated', {
      context: 'LiveChatService',
      action: 'SESSION_RATED',
      sessionId,
      rating,
      feedback
    });
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get chat statistics
   */
  async getStats(): Promise<{
    activeSessions: number;
    waitingInQueue: number;
    availableAgents: number;
    avgWaitTime: number;
    avgSessionDuration: number;
    totalChatsToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSessions = chatQueue.length;
    const availableAgents = (await this.getAvailableAgents()).length;

    return {
      activeSessions,
      waitingInQueue: chatQueue.filter(q => q.position <= 5).length,
      availableAgents,
      avgWaitTime: this.calculateEstimatedWaitTime(),
      avgSessionDuration: 15, // minutes
      totalChatsToday: activeSessions + 10 // mock
    };
  }
}

// ============================================
// EXPORT SERVICE INSTANCE
// ============================================

export const liveChatService = new LiveChatService();
export default liveChatService;
