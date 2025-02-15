export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
export function asyncAuthHandler(fn) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new Error('Authentication required'));
        }
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=asyncHandler.js.map