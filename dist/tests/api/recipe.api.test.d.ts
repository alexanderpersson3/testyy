declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidDate(): R;
            toBeValidObjectId(): R;
        }
    }
}
export {};
//# sourceMappingURL=recipe.api.test.d.ts.map