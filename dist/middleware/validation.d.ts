import { AnyZodObject } from 'zod';
export declare const validateRequest: (schema: AnyZodObject, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => Promise<any>;
export declare const validate: (schema: AnyZodObject, source?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => Promise<any>;
export declare const validateLogin: (import("express-validator").ValidationChain | ((req: Request, res: Response, next: NextFunction) => any))[];
export declare const validateRegister: (import("express-validator").ValidationChain | ((req: Request, res: Response, next: NextFunction) => any))[];
export declare const validateIngredient: (import("express-validator").ValidationChain | ((req: Request, res: Response, next: NextFunction) => any))[];
