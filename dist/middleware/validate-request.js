import { ZodError } from 'zod';
export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ errors: error.errors });
            }
            else {
                next(error);
            }
        }
    };
};
//# sourceMappingURL=validate-request.js.map