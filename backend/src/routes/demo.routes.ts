/**
 * Demo Routes
 *
 * Endpoints for investor demo functionality (development/staging only).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import * as demoController from '../controllers/demo.controller';

const router = Router();

const blockInProduction = (_req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      error: 'Not found',
      message: 'Demo endpoints are disabled in production',
    });
  }
  return next();
};

router.use(blockInProduction);
router.use(authenticate);
router.use(requireRole('admin'));

// Demo configuration
router.get('/config', demoController.getDemoConfig);
router.patch('/config', demoController.updateDemoConfig);

// Demo account generation
router.post('/account/generate', demoController.generateDemoAccount);
router.post('/data/create', demoController.createDemoData);

// Session management
router.delete('/session/:sessionId', demoController.cleanupSession);
router.post('/session/end', demoController.endSession);

// Metrics
router.get('/metrics', demoController.getDemoMetrics);
router.get('/scenarios', demoController.getDemoScenarios);

// Launch readiness
router.get('/launch-readiness', demoController.getLaunchReadiness);
router.get('/launch/funnel', demoController.getOnboardingFunnel);
router.get('/launch/conversions', demoController.getConversionData);
router.get('/launch/kpis', demoController.getLaunchKPIs);

// Scenario management
router.post('/scenario/start', demoController.startScenario);
router.post('/scenario/step', demoController.completeStep);

// Interaction tracking
router.post('/interaction', demoController.recordInteraction);

export default router;
