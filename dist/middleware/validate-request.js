import { z } from 'zod';
import logger from '../utils/logger.js';
export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            if ('body' in schema || 'query' in schema || 'params' in schema) {
                // Handle ValidationSchema
                const validationSchema = schema;
                if (validationSchema.body) {
                    req.body = await validationSchema.body.parseAsync(req.body);
                }
                if (validationSchema.query) {
                    req.query = await validationSchema.query.parseAsync(req.query);
                }
                if (validationSchema.params) {
                    req.params = await validationSchema.params.parseAsync(req.params);
                }
            }
            else {
                // Handle single ZodType
                await schema.parseAsync(req.body);
            }
            next();
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                const issues = error.issues.map(issue => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                }));
                logger.error('Validation error:', { issues });
                res.status(400).json({ error: 'Validation failed', issues });
            }
            else {
                logger.error('Validation error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    };
};
//# sourceMappingURL=validate-request.js.map