import { describe, expect, test } from "vitest";
import { createProgram } from "../src/cli.js";

describe("CLI", () => {
  test("registers doctor and optional transcript clip command", () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toContain("doctor");
    expect(program.commands.map((command) => command.name())).toContain("discover");
    const clip = program.commands.find((command) => command.name() === "clip");
    expect(clip?.options.some((option) => option.flags.includes("--transcript") && option.mandatory !== true)).toBe(true);
    const discover = program.commands.find((command) => command.name() === "discover");
    expect(discover?.commands.map((command) => command.name())).toEqual(["youtube", "import"]);
    const analyze = program.commands.find((command) => command.name() === "analyze");
    expect(analyze).toBeDefined();
    expect(analyze?.options.some((option) => option.flags.includes("--prompt"))).toBe(true);
  });
});
