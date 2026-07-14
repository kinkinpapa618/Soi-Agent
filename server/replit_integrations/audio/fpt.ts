import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const FPT_ASR_URL = "https://api.fpt.ai/hmi/asr/general";
const FPT_API_KEY = "mH1HoZ2HXkuXyF5Agm8nmRbFWN7waDhV";

export interface FptAsrResponse {
  status: number;
  msg: string;
  hypotheses: Array<{ utterance: string; confidence: number }>;
}

type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if ((buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) || (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "unknown";
}

async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `fpt-input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `fpt-output-${randomUUID()}.wav`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath, "-vn", "-f", "wav", "-ar", "16000", "-ac", "1",
        "-acodec", "pcm_s16le", "-y", outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
      ffmpeg.on("error", reject);
    });
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

async function ensureCompatibleFormat(audioBuffer: Buffer): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

export async function fptSpeechToText(audioBuffer: Buffer): Promise<{
  text: string;
  confidence: number;
  raw: FptAsrResponse;
}> {
  const { buffer: wavBuffer } = await ensureCompatibleFormat(audioBuffer);

  const response = await fetch(FPT_ASR_URL, {
    method: "POST",
    headers: { "api-key": FPT_API_KEY },
    body: wavBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`FPT ASR error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const result: FptAsrResponse = await response.json();

  if (result.status !== 0) {
    throw new Error(`FPT ASR error: ${result.msg} (code ${result.status})`);
  }

  const bestHypothesis =
    result.hypotheses.length > 0
      ? result.hypotheses.reduce((best, h) => (h.confidence > best.confidence ? h : best))
      : null;

  return {
    text: bestHypothesis?.utterance ?? "",
    confidence: bestHypothesis?.confidence ?? 0,
    raw: result,
  };
}
