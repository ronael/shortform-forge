import type { PassageAnalyzer } from "./ports.js";
import { analyzeTranscript } from "../domain/scoring.js";

export const heuristicAnalyzer: PassageAnalyzer = {
  strategy: "heuristic-v0",
  analyze: analyzeTranscript
};
