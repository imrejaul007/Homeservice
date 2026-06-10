import { Router } from 'express';
import addressController from '../controllers/address.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware.authenticate);

// Get all addresses
router.get('/', addressController.getAllAddresses);

// Add new address
router.post('/', addressController.addAddress);

// ============================================
// ROUTES WITH :id - Specific routes BEFORE parameterized /:id
// ============================================

// Update address
router.patch('/:id', addressController.editAddress);

// Delete address
router.delete('/:id', addressController.removeAddress);

// Set as default
router.patch('/:id/default', addressController.setDefault);

// Get single address (must be last for /:id routes)
router.get('/:id', addressController.getSingleAddress);

export default router;
