/**
 * Safe Array Operations Utilities
 * Defensive wrappers for array operations to prevent runtime TypeErrors
 */

/**
 * Safely filter an array, returning empty array if input is not an array
 */
export function safeFilter<T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, array: T[]) => boolean
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(predicate);
}

/**
 * Safely map an array, returning empty array if input is not an array
 */
export function safeMap<T, U>(
  arr: T[] | undefined | null,
  mapper: (value: T, index: number, array: T[]) => U
): U[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(mapper);
}

/**
 * Safely reduce an array, returning initialValue if input is not an array
 */
export function safeReduce<T, U>(
  arr: T[] | undefined | null,
  reducer: (accumulator: U, currentValue: T, currentIndex: number, array: T[]) => U,
  initialValue: U
): U {
  if (!Array.isArray(arr)) return initialValue;
  return arr.reduce(reducer, initialValue);
}

/**
 * Safely find in an array, returning undefined if input is not an array
 */
export function safeFind<T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, obj: T[]) => boolean
): T | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.find(predicate);
}

/**
 * Safely check array length, returning 0 if input is not an array
 */
export function safeLength(arr: any[] | undefined | null): number {
  if (!Array.isArray(arr)) return 0;
  return arr.length;
}

/**
 * Ensure value is an array, converting or wrapping as needed
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

/**
 * Safely sort an array without mutating the original
 */
export function safeSortBy<T>(
  arr: T[] | undefined | null,
  compareFn?: (a: T, b: T) => number
): T[] {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort(compareFn);
}

/**
 * Safely get unique values from an array
 */
export function safeUnique<T>(arr: T[] | undefined | null): T[] {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr));
}

/**
 * Safely chunk an array into smaller arrays
 */
export function safeChunk<T>(
  arr: T[] | undefined | null,
  size: number
): T[][] {
  if (!Array.isArray(arr) || size <= 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safely flatten nested arrays
 */
export function safeFlatten<T>(
  arr: (T | T[])[] | undefined | null
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.flat() as T[];
}

/**
 * Safely group array items by a key function
 */
export function safeGroupBy<T, K extends string | number>(
  arr: T[] | undefined | null,
  keyFn: (item: T) => K
): Record<K, T[]> {
  if (!Array.isArray(arr)) return {} as Record<K, T[]>;
  
  return arr.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

/**
 * Safely partition an array into two based on a predicate
 */
export function safePartition<T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number) => boolean
): [T[], T[]] {
  if (!Array.isArray(arr)) return [[], []];
  
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  arr.forEach((item, index) => {
    if (predicate(item, index)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  });
  
  return [truthy, falsy];
}

/**
 * Safely get first n items from array
 */
export function safeFirst<T>(
  arr: T[] | undefined | null,
  n: number = 1
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, n);
}

/**
 * Safely get last n items from array
 */
export function safeLast<T>(
  arr: T[] | undefined | null,
  n: number = 1
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(-n);
}

/**
 * Safely sum numeric array values
 */
export function safeSum(arr: number[] | undefined | null): number {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
}

/**
 * Safely calculate average of numeric array
 */
export function safeAverage(arr: number[] | undefined | null): number {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sum = safeSum(arr);
  return sum / arr.length;
}

/**
 * Safely check if array includes a value
 */
export function safeIncludes<T>(
  arr: T[] | undefined | null,
  searchElement: T
): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.includes(searchElement);
}

/**
 * Safely check if some items match predicate
 */
export function safeSome<T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, array: T[]) => boolean
): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.some(predicate);
}

/**
 * Safely check if all items match predicate
 */
export function safeEvery<T>(
  arr: T[] | undefined | null,
  predicate: (value: T, index: number, array: T[]) => boolean
): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.every(predicate);
}
