import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deployAgent,
  suspendAgent,
  deleteAgent,
  getAgentsByCategory,
  getAgentStats,
} from '../controllers/iaAgent.controller';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// Get agent statistics
router.get('/stats', getAgentStats);

// Get all agents with optional filtering
router.get('/', getAllAgents);

// Get agents by category
router.get('/category/:category', getAgentsByCategory);

// Get single agent by ID
router.get('/:id', getAgentById);

// Create new agent
router.post('/', createAgent);

// Update agent
router.put('/:id', updateAgent);

// Deploy agent
router.post('/:id/deploy', deployAgent);

// Suspend agent
router.post('/:id/suspend', suspendAgent);

// Delete (archive) agent
router.delete('/:id', deleteAgent);

export default router;
