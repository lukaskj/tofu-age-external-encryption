import { ok, err, type Result } from "neverthrow";

// biome-ignore lint/suspicious/noExplicitAny: Here it is ok
export function safeJsonParse<T = any>(jsonString: string): Result<T, Error> {
  try {
    return ok(JSON.parse(jsonString));
  } catch (e: unknown) {
    return err(new Error("Failed to parse JSON", { cause: e }));
  }
}
