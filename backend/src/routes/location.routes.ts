import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';

const router = Router();

const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
const OPENCAGE_BASE_URL = 'https://api.opencagedata.com/geocode/v1/json';

/** Forward geocode — place search for provider service areas */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10);

    if (q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    if (!OPENCAGE_API_KEY) {
      logger.warn('OpenCage API key not configured');
      return res.status(503).json({
        success: false,
        message: 'Location search is not configured. Set OPENCAGE_API_KEY on the server.',
        results: [],
      });
    }

    const response = await axios.get(OPENCAGE_BASE_URL, {
      params: {
        key: OPENCAGE_API_KEY,
        q,
        limit,
        format: 'json',
        language: 'en',
        countrycode: 'ae,sa',
        no_annotations: 1,
      },
      timeout: 8000,
    });

    const results = (response.data?.results || []).map((result: any) => {
      const components = result.components || {};
      return {
        label:
          result.formatted ||
          [components.city || components.town, components.country].filter(Boolean).join(', '),
        formattedAddress: result.formatted,
        street: components.road || components.pedestrian || components.neighbourhood,
        city: components.city || components.town || components.village || components.county,
        state: components.state,
        zipCode: components.postcode,
        country: components.country,
        lat: result.geometry?.lat,
        lng: result.geometry?.lng,
      };
    }).filter((r: { lat?: number; lng?: number }) => r.lat != null && r.lng != null);

    return res.json({ success: true, results });
  } catch (error) {
    logger.error('OpenCage search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search locations',
      results: [],
    });
  }
});

router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    if (!OPENCAGE_API_KEY) {
      logger.warn('OpenCage API key not configured, using fallback geocoding');
      return res.json({
        formattedAddress: `Location at ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
        city: 'Unknown',
        state: 'Unknown',
        country: 'Unknown',
        postalCode: '',
      });
    }

    const response = await axios.get(OPENCAGE_BASE_URL, {
      params: {
        key: OPENCAGE_API_KEY,
        q: `${latitude},${longitude}`,
        format: 'json',
        language: 'en',
      },
    });

    const data = response.data;

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.components;

      return res.json({
        formattedAddress: result.formatted,
        city: components.city || components.town || components.village || components.county || 'Unknown',
        state: components.state || 'Unknown',
        country: components.country || 'Unknown',
        postalCode: components.postcode || '',
      });
    }

    return res.json({
      formattedAddress: `Location at ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
      city: 'Unknown',
      state: 'Unknown',
      country: 'Unknown',
      postalCode: '',
    });
  } catch (error) {
    logger.error('Geocoding error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to geocode location',
    });
  }
});

export default router;
