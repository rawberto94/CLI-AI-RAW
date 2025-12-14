import 'server-only';

/**
 * Dynamically import a module at runtime without letting webpack/Next resolve it at build time.
 *
 * This avoids noisy "Module not found" warnings for truly-optional dependencies.
 */
export async function optionalImport<T = unknown>(moduleId: string): Promise<T | null> {
  try {
    // eslint-disable-next-line no-new-func
    const importer = new Function('m', 'return import(m)') as (m: string) => Promise<T>;
    return await importer(moduleId);
  } catch {
    return null;
  }
}
