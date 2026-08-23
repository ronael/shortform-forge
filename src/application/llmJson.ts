import { z } from "zod";
import { AppError } from "../domain/errors.js";

/**
 * Extracts and validates a JSON object from a language model response.
 * Tolerates surrounding prose or markdown fences; never invents data.
 */
export function parseLlmJson<T>(response: string, schema: z.ZodType<T>, contractName: string): T {
  const start = response.indexOf("{");
  const end = response.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AppError("Language model response did not contain a JSON object", "LLM_INVALID_RESPONSE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.slice(start, end + 1));
  } catch {
    throw new AppError("Language model response contained malformed JSON", "LLM_INVALID_RESPONSE");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      `Language model response failed ${contractName} validation: ${result.error.issues[0]?.message ?? "unknown issue"}`,
      "LLM_INVALID_RESPONSE"
    );
  }
  return result.data;
}
