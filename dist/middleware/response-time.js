export const responseTime = (req, res, next) => {
    const start = process.hrtime();
    try {
        res.on('finish', () => {
            const diff = process.hrtime(start);
            const time = diff[0] * 1e3 + diff[1] * 1e-6;
            res.setHeader('X-Response-Time', `${time.toFixed(3)}ms`);
        });
    }
    catch (error) {
        console.error('Response time tracking error:', error);
    }
    next();
};
//# sourceMappingURL=response-time.js.map