import { ensureCompatibleFormat } from "./client";

const FPT_ASR_URL = "https://api.fpt.ai/hmi/asr/general";
const FPT_API_KEY = "mH1HoZ2HXkuXyF5Agm8nmRbFWN7waDhV";

export interface FptAsrResponse {
  status: number;
  msg: string;
  hypotheses: Array<{ utterance: string; confidence: number }>;
}

/**
 * Speech-to-Text using FPT AI ASR.
 * Accepts any audio format (WebM, WAV, MP3, OGG, etc.) - auto-converts to WAV via ffmpeg.
 * Returns the best hypothesis transcript.
 */
export async function fptSpeechToText(audioBuffer: Buffer): Promise<{
  text: string;
  confidence: number;
  raw: FptAsrResponse;
}> {
  const { buffer: wavBuffer } = await ensureCompatibleFormat(audioBuffer);

  const response = await fetch(FPT_ASR_URL, {
    method: "POST",
    headers: {
      "api-key": FPT_API_KEY,
    },
    body: wavBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `FPT ASR error: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const result: FptAsrResponse = await response.json();

  if (result.status !== 0) {
    throw new Error(`FPT ASR error: ${result.msg} (code ${result.status})`);
  }

  const bestHypothesis =
    result.hypotheses.length > 0
      ? result.hypotheses.reduce((best, h) =>
          h.confidence > best.confidence ? h : best
        )
      : null;

  return {
    text: bestHypothesis?.utterance ?? "",
    confidence: bestHypothesis?.confidence ?? 0,
    raw: result,
  };
}
