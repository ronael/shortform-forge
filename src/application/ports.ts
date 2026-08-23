import type { Analysis, CandidateSegment, QaReport, Source, Transcript } from "../domain/contracts.js";

export type MediaProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
  sizeBytes: number;
};

export type TranscriptionRequest = {
  source: Source;
  cacheDir: string;
};

export type RenderRequest = {
  sourcePath: string;
  transcript: Transcript;
  candidate: CandidateSegment;
  outputDir: string;
};

export type QaRequest = {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  captionsPath: string;
};

export interface MediaToolkit {
  probe(videoPath: string): Promise<MediaProbe>;
  renderVerticalClip(input: RenderRequest): Promise<string>;
  qaVideo(input: QaRequest): Promise<QaReport>;
}

export interface TranscriptionProvider {
  transcribe(input: TranscriptionRequest): Promise<Transcript>;
}

export interface PassageAnalyzer {
  analyze(transcript: Transcript): CandidateSegment[];
  readonly strategy: string;
}

export type ClipWorkflowDependencies = {
  media: MediaToolkit;
  transcription: TranscriptionProvider;
  analyzer: PassageAnalyzer;
};
