import { Router } from 'express';
import addressController from '../controllers/address.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware.authenticate);

// Get all addresses
router.get('/', addressController.getAllAddresses);

// Get single address
router.get('/:id', addressController.getSingleAddress);

// Add new address
router.post('/', addressController.addAddress);

// Update address
router.patch('/:id', addressController.editAddress);

// Delete address
router.delete('/:id', addressController.removeAddress);

// Set as default
router.patch('/:id/default', addressController.setDefault);

export default router;
