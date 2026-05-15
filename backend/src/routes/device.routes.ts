/**
 * Device Registration Routes
 *
 * Handles mobile device registration for push notifications
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Device, IDevice } from '../models/Device';

const router = Router();

// Validation middleware
const registerDeviceValidation = [
  body('token').isString().notEmpty().withMessage('Device token is required'),
  body('platform')
    .isIn(['android', 'ios'])
    .withMessage('Platform must be android or ios'),
  body('appVersion').optional().isString(),
];

/**
 * POST /api/devices/register
 * Register a device for push notifications
 */
router.post(
  '/register',
  registerDeviceValidation,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { token, platform, appVersion } = req.body;
      const userId = req.user?.id;

      // Find existing device or create new
      let device = await Device.findOne({ token });

      if (device) {
        // Update existing device
        device.platform = platform;
        device.appVersion = appVersion;
        device.lastActive = new Date();
        if (userId) {
          device.userId = userId;
        }
        await device.save();
      } else {
        // Create new device
        device = await Device.create({
          token,
          platform,
          appVersion,
          userId,
          lastActive: new Date(),
        });
      }

      res.status(200).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          deviceId: device._id,
          platform: device.platform,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/devices/:token
 * Unregister a device
 */
router.delete(
  '/:token',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      const userId = req.user?.id;

      const result = await Device.deleteOne({ token, userId });

      if (result.deletedCount === 0) {
        res.status(404).json({
          success: false,
          message: 'Device not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Device unregistered successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/devices
 * Get all devices for current user
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      const devices = await Device.find({ userId }).select('-token');

      res.status(200).json({
        success: true,
        data: {
          devices,
          count: devices.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
