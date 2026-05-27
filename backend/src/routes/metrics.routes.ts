import { Router, Request, Response } from 'express';
// @ts-expect-error prom-client types will be installed
import { register } from 'prom-client';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
