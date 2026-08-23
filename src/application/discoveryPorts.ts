import type { ContentSignal } from "../domain/discovery.js";

export type DiscoveryQuery = {
  query: string;
  limit: number;
};

export type DiscoveryResult = {
  source: string;
  query?: string;
  collectedAt: string;
  signals: ContentSignal[];
  warnings: string[];
  raw: unknown[];
};

export interface DiscoverySource {
  readonly source: string;
  search(input: DiscoveryQuery): Promise<DiscoveryResult>;
}
