export interface LanguageModelProvider {
  readonly name: string;
  generate(prompt: string): Promise<string>;
}
