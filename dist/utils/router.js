;
export class TypedRouter {
    constructor() {
        this.router = Router();
    }
    get(path, ...handlers) {
        this.router.get(path, ...handlers);
        return this;
    }
    post(path, ...handlers) {
        this.router.post(path, ...handlers);
        return this;
    }
    put(path, ...handlers) {
        this.router.put(path, ...handlers);
        return this;
    }
    delete(path, ...handlers) {
        this.router.delete(path, ...handlers);
        return this;
    }
    patch(path, ...handlers) {
        this.router.patch(path, ...handlers);
        return this;
    }
    use(pathOrHandler, ...handlers) {
        if (typeof pathOrHandler === 'string') {
            this.router.use(pathOrHandler, ...handlers);
        }
        else {
            this.router.use(pathOrHandler, ...handlers);
        }
        return this;
    }
    getRouter() {
        return this.router;
    }
}
export default TypedRouter;
//# sourceMappingURL=router.js.map