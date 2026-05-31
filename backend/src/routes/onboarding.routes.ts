/**
 * Onboarding Routes
 *
 * Handles customer onboarding checklist operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createOnboardingChecklist,
  completeTask,
  getUserChecklist,
  getNextRecommendedTask,
  hasCompletedRequiredTasks,
  getOnboardingStats,
} from '../automation/onboardingChecklist';

const router = Router();

/**
 * GET /api/onboarding/checklist
 * Get current user's onboarding checklist
 */
router.get(
  '/checklist',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      let checklist = await getUserChecklist(userId as any);

      // Create checklist if it doesn't exist
      if (!checklist) {
        checklist = await createOnboardingChecklist(userId as any);
      }

      res.status(200).json({
        success: true,
        data: checklist,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get onboarding checklist',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/onboarding/checklist/:taskId/complete
 * Mark a task as completed
 */
router.post(
  '/checklist/:taskId/complete',
  authenticate,
  [
    param('taskId').isString().notEmpty(),
    body('completedData').optional().isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { taskId } = req.params;
      const { completedData } = req.body;

      const result = await completeTask(userId as any, taskId, completedData);

      res.status(200).json({
        success: true,
        message: 'Task completed successfully',
        data: {
          checklist: result.checklist,
          isCompleted: result.isCompleted,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to complete task',
        error: message,
      });
    }
  })
);

/**
 * POST /api/onboarding/checklist/:taskId/skip
 * Skip an optional task
 */
router.post(
  '/checklist/:taskId/skip',
  authenticate,
  [param('taskId').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { taskId } = req.params;
      const checklist = await getUserChecklist(userId as any);

      if (!checklist) {
        res.status(404).json({
          success: false,
          message: 'Checklist not found',
        });
        return;
      }

      const task = checklist.tasks.find((t: any) => t.taskId === taskId);

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
        });
        return;
      }

      if (task.priority === 'required') {
        res.status(400).json({
          success: false,
          message: 'Cannot skip required tasks',
        });
        return;
      }

      await completeTask(userId as any, taskId);

      res.status(200).json({
        success: true,
        message: 'Task skipped',
        data: checklist,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to skip task',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/onboarding/next-task
 * Get next recommended task
 */
router.get(
  '/next-task',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const nextTask = await getNextRecommendedTask(userId as any);

      res.status(200).json({
        success: true,
        data: nextTask,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get next task',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/onboarding/status
 * Get onboarding completion status
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const checklist = await getUserChecklist(userId as any);
      const hasCompletedRequired = await hasCompletedRequiredTasks(userId as any);

      res.status(200).json({
        success: true,
        data: {
          hasChecklist: !!checklist,
          checklist,
          hasCompletedRequired,
          progressPercentage: checklist?.progressPercentage || 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get onboarding status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
