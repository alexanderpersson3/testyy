import { ZodType, ZodError } from 'zod';;
import logger from '../utils/logger.js';

export const validate = (
  schema: ZodType<any, any, any>,
  source: 'body' | 'query' | 'params' = 'body',
  errorMessage = 'Validation failed'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: errorMessage,
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      } else {
        next(error);
      }
    }
  };
};
