import { spawn } from "node:child_process";

const children = [
  spawn("pnpm", ["exec", "tsx", "watch", "dashboard/server/main.ts"], {
    stdio: "inherit",
    env: { ...process.env, SF_DASHBOARD_PUBLIC_PORT: "4174" },
  }),
  spawn("pnpm", ["exec", "vite", "--config", "dashboard/vite.config.ts"], { stdio: "inherit" }),
];

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
}
