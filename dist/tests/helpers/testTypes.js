export const createTestResponse = () => {
    const res = {
        body: {},
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
        setHeader(name, value) {
            return this;
        },
        getHeader(name) {
            return undefined;
        },
        cookie(name, val, options) {
            return this;
        }
    };
    return res;
};
//# sourceMappingURL=testTypes.js.map