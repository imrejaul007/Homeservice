import { Request, Response } from 'express';
import { IAAgent, IAAgentCategory, IAAgentType, IAAgentStatus } from '../models/iaAgent.model';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

/**
 * Get all IA Agents with optional filtering
 * GET /api/ia-agents
 * @access Admin
 */
export const getAllAgents = asyncHandler(async (req: Request, res: Response) => {
  const { category, type, status, isActive } = req.query;

  const filter: Record<string, unknown> = {};

  if (category && Object.values(IAAgentCategory).includes(category as IAAgentCategory)) {
    filter.category = category;
  }
  if (type && Object.values(IAAgentType).includes(type as IAAgentType)) {
    filter.type = type;
  }
  if (status && Object.values(IAAgentStatus).includes(status as IAAgentStatus)) {
    filter.status = status;
  }
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const agents = await IAAgent.find(filter).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      agents,
      total: agents.length,
    },
  });
});

/**
 * Get single IA Agent by ID
 * GET /api/ia-agents/:id
 * @access Admin
 */
export const getAgentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const agent = await IAAgent.findById(id).lean();

  if (!agent) {
    res.status(404).json({
      success: false,
      message: 'IA Agent not found',
    });
    return;
  }

  res.json({
    success: true,
    data: agent,
  });
});

/**
 * Create new IA Agent
 * POST /api/ia-agents
 * @access Admin
 */
export const createAgent = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, category, type, status, configuration, instructions, knowledgeBase } = req.body;

  // Validate required fields
  if (!name || !category || !type || !instructions) {
    res.status(400).json({
      success: false,
      message: 'Name, category, type, and instructions are required',
    });
    return;
  }

  // Validate enum values
  if (!Object.values(IAAgentCategory).includes(category)) {
    res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${Object.values(IAAgentCategory).join(', ')}`,
    });
    return;
  }

  if (!Object.values(IAAgentType).includes(type)) {
    res.status(400).json({
      success: false,
      message: `Invalid type. Must be one of: ${Object.values(IAAgentType).join(', ')}`,
    });
    return;
  }

  const agent = new IAAgent({
    name,
    description: description || '',
    category,
    type,
    status: status || IAAgentStatus.Draft,
    configuration: configuration || {},
    instructions,
    knowledgeBase: knowledgeBase || [],
    isActive: true,
    version: 1,
  });

  await agent.save();

  logger.info('IA Agent created', {
    context: 'IAAgentController',
    action: 'CREATE_AGENT',
    agentId: agent._id.toString(),
    name: agent.name,
    category: agent.category,
  });

  res.status(201).json({
    success: true,
    data: agent,
    message: 'IA Agent created successfully',
  });
});

/**
 * Update IA Agent
 * PUT /api/ia-agents/:id
 * @access Admin
 */
export const updateAgent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const agent = await IAAgent.findById(id);

  if (!agent) {
    res.status(404).json({
      success: false,
      message: 'IA Agent not found',
    });
    return;
  }

  // Validate enum values if provided
  if (updates.category && !Object.values(IAAgentCategory).includes(updates.category)) {
    res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${Object.values(IAAgentCategory).join(', ')}`,
    });
    return;
  }

  if (updates.type && !Object.values(IAAgentType).includes(updates.type)) {
    res.status(400).json({
      success: false,
      message: `Invalid type. Must be one of: ${Object.values(IAAgentType).join(', ')}`,
    });
    return;
  }

  if (updates.status && !Object.values(IAAgentStatus).includes(updates.status)) {
    res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${Object.values(IAAgentStatus).join(', ')}`,
    });
    return;
  }

  // Apply updates
  const allowedUpdates = ['name', 'description', 'category', 'type', 'status', 'configuration', 'instructions', 'knowledgeBase', 'isActive'];
  allowedUpdates.forEach((field) => {
    if (updates[field] !== undefined) {
      (agent as unknown as Record<string, unknown>)[field] = updates[field];
    }
  });

  await agent.save();

  logger.info('IA Agent updated', {
    context: 'IAAgentController',
    action: 'UPDATE_AGENT',
    agentId: agent._id.toString(),
    name: agent.name,
  });

  res.json({
    success: true,
    data: agent,
    message: 'IA Agent updated successfully',
  });
});

/**
 * Deploy IA Agent
 * POST /api/ia-agents/:id/deploy
 * @access Admin
 */
export const deployAgent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const agent = await IAAgent.findById(id);

  if (!agent) {
    res.status(404).json({
      success: false,
      message: 'IA Agent not found',
    });
    return;
  }

  if (agent.status === IAAgentStatus.Deployed) {
    res.status(400).json({
      success: false,
      message: 'Agent is already deployed',
    });
    return;
  }

  if (agent.status === IAAgentStatus.Archived) {
    res.status(400).json({
      success: false,
      message: 'Cannot deploy an archived agent',
    });
    return;
  }

  await agent.deploy();

  logger.info('IA Agent deployed', {
    context: 'IAAgentController',
    action: 'DEPLOY_AGENT',
    agentId: agent._id.toString(),
    name: agent.name,
    version: agent.version,
  });

  res.json({
    success: true,
    data: agent,
    message: 'IA Agent deployed successfully',
  });
});

/**
 * Suspend IA Agent
 * POST /api/ia-agents/:id/suspend
 * @access Admin
 */
export const suspendAgent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const agent = await IAAgent.findById(id);

  if (!agent) {
    res.status(404).json({
      success: false,
      message: 'IA Agent not found',
    });
    return;
  }

  if (agent.status !== IAAgentStatus.Deployed) {
    res.status(400).json({
      success: false,
      message: 'Only deployed agents can be suspended',
    });
    return;
  }

  await agent.suspend();

  logger.info('IA Agent suspended', {
    context: 'IAAgentController',
    action: 'SUSPEND_AGENT',
    agentId: agent._id.toString(),
    name: agent.name,
  });

  res.json({
    success: true,
    data: agent,
    message: 'IA Agent suspended successfully',
  });
});

/**
 * Delete IA Agent
 * DELETE /api/ia-agents/:id
 * @access Admin
 */
export const deleteAgent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const agent = await IAAgent.findById(id);

  if (!agent) {
    res.status(404).json({
      success: false,
      message: 'IA Agent not found',
    });
    return;
  }

  // Soft delete by setting isActive to false
  agent.isActive = false;
  agent.status = IAAgentStatus.Archived;
  await agent.save();

  logger.info('IA Agent deleted (archived)', {
    context: 'IAAgentController',
    action: 'DELETE_AGENT',
    agentId: agent._id.toString(),
    name: agent.name,
  });

  res.json({
    success: true,
    message: 'IA Agent archived successfully',
  });
});

/**
 * Get agents by category
 * GET /api/ia-agents/category/:category
 * @access Admin
 */
export const getAgentsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;

  if (!Object.values(IAAgentCategory).includes(category as IAAgentCategory)) {
    res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${Object.values(IAAgentCategory).join(', ')}`,
    });
    return;
  }

  const agents = await IAAgent.find({ category, isActive: true }).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      agents,
      category,
      total: agents.length,
    },
  });
});

/**
 * Get agent statistics
 * GET /api/ia-agents/stats
 * @access Admin
 */
export const getAgentStats = asyncHandler(async (_req: Request, res: Response) => {
  const [total, deployed, testing, draft, suspended, archived] = await Promise.all([
    IAAgent.countDocuments({ isActive: true }),
    IAAgent.countDocuments({ status: IAAgentStatus.Deployed, isActive: true }),
    IAAgent.countDocuments({ status: IAAgentStatus.Testing, isActive: true }),
    IAAgent.countDocuments({ status: IAAgentStatus.Draft, isActive: true }),
    IAAgent.countDocuments({ status: IAAgentStatus.Suspended, isActive: true }),
    IAAgent.countDocuments({ status: IAAgentStatus.Archived, isActive: true }),
  ]);

  const byCategory = await IAAgent.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const byType = await IAAgent.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({
    success: true,
    data: {
      total,
      deployed,
      testing,
      draft,
      suspended,
      archived,
      byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
      byType: byType.map((t) => ({ type: t._id, count: t.count })),
    },
  });
});
