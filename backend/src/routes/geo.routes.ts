/**
 * Geo route aliases — forwards /api/geo/nearby/* to the nearby geolocation router
 */
import { Router } from 'express';
import geolocationRoutes from './geolocation.routes';

const router = Router();

router.use('/nearby', geolocationRoutes);

export default router;
