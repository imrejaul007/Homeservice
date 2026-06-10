import { Router } from 'express';
import { handleInboundEmail, verifyInboundWebhook } from '../../controllers/inboundEmail.controller';

const router = Router();

router.get('/', verifyInboundWebhook);
router.post('/', handleInboundEmail);

export default router;
