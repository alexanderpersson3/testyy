import { AnyZodObject, ZodError } from 'zod';
;
import logger from '../utils/logger.js';
export const validateRequest = (schema, source = 'body') => {
    return async (req, res, next) => {
        try {
            const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
            await schema.parseAsync(data);
            next();
        }
        catch (error) {
            logger.error('Validation error:', error);
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            res.status(400).json({ error: 'Invalid request data' });
        }
    };
};
// For backward compatibility
export const validate = validateRequest;
export const validateLogin = [
    check('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    check('password').notEmpty().withMessage('Password is required'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];
export const validateRegister = [
    check('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
    check('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
        .withMessage('Password must contain at least one letter and one number'),
    check('name').trim().notEmpty().withMessage('Name is required'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];
export const validateIngredient = [
    check('name').trim().notEmpty().withMessage('Name is required'),
    check('category')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Category cannot be empty if provided'),
    check('unit').optional().trim().notEmpty().withMessage('Unit cannot be empty if provided'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];
//# sourceMappingURL=validation.js.map