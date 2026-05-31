import type { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExpressHandler = (req: Request, res: Response, next: NextFunction) => any;

export const asyncHandler = (fn: ExpressHandler): ExpressHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
