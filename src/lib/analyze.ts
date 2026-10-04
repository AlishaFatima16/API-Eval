import { computeScore } from "./scoring";
import { generateTestCases } from "./testcases";
import type { Issue, ScoreResult, TestCase } from "./types";
import { compileContract, ContractError, validate } from "./validator";

export const MAX_INPUT_CHARS = 200_000;

export class InputError extends Error {
  constructor(
    message: string,
    public field: "contract" | "response" | "request",
  ) {
    super(message);
    this.name = "InputError";
  }
}

const LABEL = { contract: "Expected API Contract", response: "Actual API Response" } as const;

export function parseJson(text: unknown, field: "contract" | "response"): unknown {
  if (typeof text !== "string" || text.trim() === "") {
    throw new InputError(`${LABEL[field]} is empty. Paste a JSON document.`, field);
  }
  if (text.length > MAX_INPUT_CHARS) {
    throw new InputError(`${LABEL[field]} is too large (limit ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters).`, field);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown parse error";
    throw new InputError(`${LABEL[field]} is not valid JSON: ${detail}`, field);
  }
}

export interface CoreResult {
  issues: Issue[];
  truncated: boolean;
  score: ScoreResult;
  testCases: TestCase[];
}

/** Deterministic core: parse -> compile contract -> validate -> score -> test cases. No network, no AI. */
export function runCoreAnalysis(contractText: unknown, responseText: unknown): CoreResult {
  const contractJson = parseJson(contractText, "contract");
  const responseJson = parseJson(responseText, "response");

  let schema;
  try {
    schema = compileContract(contractJson);
  } catch (e) {
    if (e instanceof ContractError) throw new InputError(`Malformed contract: ${e.message}`, "contract");
    throw e;
  }

  const { issues, truncated } = validate(schema, responseJson);
  return { issues, truncated, score: computeScore(issues), testCases: generateTestCases(schema, issues) };
}
