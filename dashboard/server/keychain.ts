import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SERVICE = "shortform-forge-dashboard";

export interface TokenSecret {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  openId: string;
  scope: string;
}

export interface SecretStore {
  get(accountId: string): Promise<TokenSecret | undefined>;
  set(accountId: string, token: TokenSecret): Promise<void>;
  delete(accountId: string): Promise<void>;
}

export class MacOsKeychainStore implements SecretStore {
  async get(accountId: string): Promise<TokenSecret | undefined> {
    try {
      const { stdout } = await execFileAsync("security", ["find-generic-password", "-s", SERVICE, "-a", accountId, "-w"]);
      return JSON.parse(stdout.trim()) as TokenSecret;
    } catch {
      return undefined;
    }
  }

  async set(accountId: string, token: TokenSecret): Promise<void> {
    await execFileAsync("security", [
      "add-generic-password", "-U", "-s", SERVICE, "-a", accountId, "-w", JSON.stringify(token),
    ]);
  }

  async delete(accountId: string): Promise<void> {
    await execFileAsync("security", ["delete-generic-password", "-s", SERVICE, "-a", accountId]).catch(() => undefined);
  }
}

export class MemorySecretStore implements SecretStore {
  readonly values = new Map<string, TokenSecret>();
  async get(accountId: string) { return this.values.get(accountId); }
  async set(accountId: string, token: TokenSecret) { this.values.set(accountId, token); }
  async delete(accountId: string) { this.values.delete(accountId); }
}
