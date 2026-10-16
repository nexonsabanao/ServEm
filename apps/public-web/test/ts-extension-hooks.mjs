/**
 * A Node module-resolution hook for the test runner.
 *
 * The application is bundled by Next, which resolves `./store` to `./store.ts`
 * the way TypeScript does. Node's own TypeScript support is stricter: a relative
 * import must name the file extension. This hook teaches `node --test` the
 * bundler rule, so a test can import an application module directly instead of
 * reaching around it. Nothing here is used at runtime by the site.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.')) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      if (/\.[cm]?[jt]sx?$/.test(specifier)) throw error;
      for (const extension of ['.ts', '.tsx']) {
        try {
          return await nextResolve(specifier + extension, context);
        } catch {
          // Try the next candidate.
        }
      }
      throw error;
    }
  }
  return nextResolve(specifier, context);
}
