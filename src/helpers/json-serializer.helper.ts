/**
 * JSON does not support BigInt. Keep identifiers lossless by encoding them as
 * decimal strings at process boundaries (HTTP responses and Redis values).
 */
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, jsonReplacer);
}

/** Returns a JSON-compatible clone suitable for Express' res.json(). */
export function toJsonSafe(value: unknown): unknown {
  const serialized = stringifyJson(value);
  return serialized === undefined ? null : (JSON.parse(serialized) as unknown);
}
