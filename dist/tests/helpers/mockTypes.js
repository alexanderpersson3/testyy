export function createMockFn() {
    let implementation = null;
    const calls = [];
    const fn = ((...args) => {
        calls.push(args);
        if (implementation) {
            return implementation(...args);
        }
        return Promise.resolve(undefined);
    });
    fn.mock = { calls };
    fn.mockResolvedValue = (value) => {
        implementation = () => Promise.resolve(value);
    };
    fn.mockRejectedValue = (error) => {
        implementation = () => Promise.reject(error);
    };
    fn.mockImplementation = (newImpl) => {
        implementation = newImpl;
    };
    return fn;
}
export const createMockCollection = () => ({
    findOne: createMockFn(),
    updateOne: createMockFn(),
    find: createMockFn(),
    insertOne: createMockFn(),
    deleteOne: createMockFn(),
    countDocuments: createMockFn(),
    aggregate: createMockFn(),
});
//# sourceMappingURL=mockTypes.js.map