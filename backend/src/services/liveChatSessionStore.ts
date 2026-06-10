import { cache } from '../config/redis';
import logger from '../utils/logger';
import type { ChatSession, QueueEntry } from './liveChat.service';

const SESSION_PREFIX = 'livechat:session:';
const QUEUE_KEY = 'livechat:queue';
const SESSION_TTL = 86400; // 24 hours

export const liveChatSessionStore = {
  async saveSession(session: ChatSession): Promise<void> {
    const key = `${SESSION_PREFIX}${session.sessionId}`;
    await cache.set(key, JSON.stringify(session), SESSION_TTL);
  },

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const key = `${SESSION_PREFIX}${sessionId}`;
    const raw = await cache.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        _id: parsed._id,
        customerId: parsed.customerId,
        agentId: parsed.agentId,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
        startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
        endedAt: parsed.endedAt ? new Date(parsed.endedAt) : undefined,
      } as ChatSession;
    } catch {
      return null;
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    await cache.del(`${SESSION_PREFIX}${sessionId}`);
  },

  async getQueue(): Promise<QueueEntry[]> {
    const raw = await cache.get(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as QueueEntry[];
    } catch {
      return [];
    }
  },

  async setQueue(queue: QueueEntry[]): Promise<void> {
    await cache.set(QUEUE_KEY, JSON.stringify(queue), SESSION_TTL);
  },

  async addToQueue(entry: QueueEntry): Promise<void> {
    const queue = await this.getQueue();
    queue.push(entry);
    await this.setQueue(queue);
    logger.debug('Live chat queue updated', {
      sessionId: entry.sessionId,
      position: entry.position,
      action: 'LIVECHAT_QUEUE_ADD',
    });
  },

  async removeFromQueue(sessionId: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter((e) => e.sessionId !== sessionId);
    await this.setQueue(filtered);
  },
};
