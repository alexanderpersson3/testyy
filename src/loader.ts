import { resolve as resolveTs } from 'ts-node/esm';

interface ResolveContext {
  conditions: string[];
  parentURL: string | undefined;
}

interface ResolveResult {
  url: string;
  format?: string;
}

export function resolve(
  specifier: string,
  context: ResolveContext,
  defaultResolve: (specifier: string, context: ResolveContext) => Promise<ResolveResult>
): Promise<ResolveResult> {
  return resolveTs(specifier, context, defaultResolve);
} 