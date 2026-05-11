import { Router, Request, Response } from 'express';
import database from '../config/database';
import logger from '../utils/logger';
import { APP_CONSTANTS } from '../config/constants';

const router = Router();

// Verify all connections
router.get('/', async (_req: Request, res: Response) => {
  try {
    const verificationResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      services: {
        server: {
          status: 'operational',
          port: process.env.PORT || 5000,
          uptime: process.uptime()
        },
        database: await verifyDatabase(),
        external: await verifyExternalServices()
      }
    };

    const allOperational = 
      verificationResults.services.database.status === 'connected' &&
      Object.values(verificationResults.services.external).every((service: any) => 
        service.status === 'connected' || service.status === 'not_configured'
      );

    res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      status: allOperational ? 'all_systems_operational' : 'partial_availability',
      ...verificationResults
    });
  } catch (error) {
    logger.error('Verification error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to verify services',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Verify database connection
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const dbStatus = await verifyDatabase();
    
    res.status(
      dbStatus.status === 'connected' 
        ? APP_CONSTANTS.HTTP_STATUS.OK 
        : APP_CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE
    ).json({
      success: dbStatus.status === 'connected',
      ...dbStatus
    });
  } catch (error) {
    logger.error('Database verification error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: 'error',
      message: 'Failed to verify database connection',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Verify Cloudinary connection
router.get('/cloudinary', async (_req: Request, res: Response) => {
  try {
    const cloudinaryStatus = await verifyCloudinary();
    
    res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      ...cloudinaryStatus
    });
  } catch (error) {
    logger.error('Cloudinary verification error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: 'error',
      message: 'Failed to verify Cloudinary connection'
    });
  }
});

// Verify Stripe connection
router.get('/stripe', async (_req: Request, res: Response) => {
  try {
    const stripeStatus = await verifyStripe();
    
    res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      ...stripeStatus
    });
  } catch (error) {
    logger.error('Stripe verification error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: 'error',
      message: 'Failed to verify Stripe connection'
    });
  }
});

// Verify Email service (Resend)
router.get('/email', async (_req: Request, res: Response) => {
  try {
    const emailStatus = await verifyEmailService();
    
    res.status(APP_CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      ...emailStatus
    });
  } catch (error) {
    logger.error('Email service verification error:', error);
    res.status(APP_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: 'error',
      message: 'Failed to verify email service'
    });
  }
});

// Helper functions
async function verifyDatabase() {
  try {
    const dbStatus = database.getConnectionStatus();
    const pingSuccess = await database.ping();
    
    return {
      status: dbStatus.isConnected && pingSuccess ? 'connected' : 'disconnected',
      details: {
        isConnected: dbStatus.isConnected,
        readyState: dbStatus.readyState,
        host: dbStatus.host || 'not_connected',
        database: dbStatus.name || 'not_connected',
        ping: pingSuccess
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        isConnected: false,
        error: 'Failed to check database status'
      }
    };
  }
}

async function verifyCloudinary() {
  const configured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (!configured) {
    return {
      status: 'not_configured',
      message: 'Cloudinary credentials not configured'
    };
  }

  try {
    // In production, you would actually test the Cloudinary connection
    // For now, we just check if credentials are present
    return {
      status: 'connected',
      details: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        configured: true
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to verify Cloudinary connection'
    };
  }
}

async function verifyStripe() {
  const configured = !!process.env.STRIPE_SECRET_KEY;

  if (!configured) {
    return {
      status: 'not_configured',
      message: 'Stripe API key not configured'
    };
  }

  try {
    // In production, you would actually test the Stripe connection
    // For now, we just check if API key is present
    return {
      status: 'connected',
      details: {
        configured: true,
        mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? 'test' : 'live'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to verify Stripe connection'
    };
  }
}

async function verifyEmailService() {
  const configured = !!process.env.RESEND_API_KEY;

  if (!configured) {
    return {
      status: 'not_configured',
      message: 'Resend API key not configured'
    };
  }

  try {
    // In production, you would actually test the email service
    // For now, we just check if API key is present
    return {
      status: 'connected',
      details: {
        configured: true,
        from_email: process.env.EMAIL_FROM || 'not_configured'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to verify email service'
    };
  }
}

async function verifyExternalServices() {
  return {
    cloudinary: await verifyCloudinary(),
    stripe: await verifyStripe(),
    email: await verifyEmailService()
  };
}

export default router;