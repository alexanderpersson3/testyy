export const asyncHandler = (fn) => {
    return (req, res, next) => {
        if (req.user) {
            Promise.resolve(fn(req, res, next)).catch(next);
        }
        else {
            Promise.resolve(fn(req, res, next)).catch(next);
        }
    };
};
//# sourceMappingURL=asyncHandler.js.map