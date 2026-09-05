import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DashboardStateSchema, type DashboardState } from "../shared/contracts.js";

const EMPTY_STATE: DashboardState = {
  version: 1,
  videos: {},
  accounts: {},
  publications: [],
};

export class StateStore {
  private state: DashboardState | undefined;

  constructor(private readonly path: string) {}

  async read(): Promise<DashboardState> {
    if (this.state) return structuredClone(this.state);
    try {
      this.state = DashboardStateSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "ENOENT") throw error;
      this.state = structuredClone(EMPTY_STATE);
    }
    return structuredClone(this.state);
  }

  async update(mutator: (state: DashboardState) => void): Promise<DashboardState> {
    const state = await this.read();
    mutator(state);
    DashboardStateSchema.parse(state);
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
    this.state = state;
    return structuredClone(state);
  }
}
