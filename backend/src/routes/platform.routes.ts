import { Router, Request, Response } from 'express';
import PlatformSettings from '../models/settings.model';
import { asyncHandler } from '../utils/asyncHandler';
import { getPublicPlatformConfig } from '../services/platformSettingsPolicy.service';
import { SUPPORTED_CITIES } from '../constants/supportedCities';

const router = Router();

/**
 * GET /api/platform/maintenance
 * Public maintenance status for SPA boot and polling (no auth).
 */
router.get(
  '/maintenance',
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await PlatformSettings.getSettings();

    res.json({
      success: true,
      data: {
        maintenanceMode: Boolean(settings.maintenanceMode),
        message:
          settings.maintenanceMessage ||
          'The platform is currently under maintenance. Please try again later.',
        estimatedDuration: settings.maintenanceEstimatedDuration || null,
        supportEmail: settings.supportEmail || null,
      },
    });
  })
);

/**
 * GET /api/platform/config
 * Public branding, locale, and feature flags for the SPA.
 */
router.get(
  '/config',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: getPublicPlatformConfig(),
    });
  })
);

/**
 * GET /api/platform/cities
 * Supported service cities for location pickers and geocoding fallback.
 */
router.get(
  '/cities',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: { cities: SUPPORTED_CITIES },
    });
  })
);

export default router;
