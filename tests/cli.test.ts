import { describe, expect, test } from "vitest";
import { createProgram } from "../src/cli.js";

describe("CLI", () => {
  test("registers doctor and optional transcript clip command", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toContain("doctor");
    const clip = program.commands.find((command) => command.name() === "clip");
    expect(clip?.options.some((option) => option.flags.includes("--transcript") && option.mandatory !== true)).toBe(true);
  });
});
