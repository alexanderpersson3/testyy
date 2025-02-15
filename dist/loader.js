import { resolve as resolveTs } from 'ts-node/esm';
export function resolve(specifier, context, defaultResolve) {
    return resolveTs(specifier, context, defaultResolve);
}
//# sourceMappingURL=loader.js.map