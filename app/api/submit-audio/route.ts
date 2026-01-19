export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import Ably from "ably";
import OpenAI from "openai";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/submit-audio");

const ABLY_API_KEY = process.env.ABLY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Ensure this is also in your .env.local

let ablyClient: Ably.Rest | null = null;
if (ABLY_API_KEY) {
  ablyClient = new Ably.Rest({ key: ABLY_API_KEY });
} else {
  logger.error(
    "ABLY_API_KEY not configured. Ably features will be disabled.",
  );
}

let openaiClient: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  logger.error(
    "OPENAI_API_KEY not configured. OpenAI features will be disabled.",
  );
}

export async function POST(request: NextRequest) {
  if (!ablyClient) {
    return jsonError("Ably client not initialized on server", 500);
  }
  if (!openaiClient) {
    return jsonError("OpenAI client not initialized on server", 500);
  }

  try {
    const body = await request.json();
    const {
      audio,
      clientId,
      sessionId,
      isFinal,
      sourceLanguage,
      whisperModel,
    } = body;

    if (!audio) {
      return jsonError("No audio data provided", 400);
    }
    if (!clientId) {
      return jsonError("Client ID not provided", 400);
    }

    logger.log(
      `Received audio data for clientId: ${clientId}, sessionId: ${
        sessionId || "N/A"
      }, isFinal: ${isFinal}`,
    );

    const buffer = Buffer.from(audio, "base64");
    logger.log(`Decoded audio chunk: ${buffer.length} bytes`);

    // Define a unique channel name for this client/session to receive transcriptions
    // This should match what the client subscribes to.
    const transcriptionChannelName = `transcription:${sessionId || clientId}`;
    const channel = ablyClient.channels.get(transcriptionChannelName);

    // --- OpenAI Whisper Transcription Logic ---
    try {
      logger.log(
        `Transcribing audio for clientId: ${clientId} using model: ${whisperModel || "whisper-1"}`,
      );

      const transcriptionResult =
        await openaiClient.audio.transcriptions.create({
          file: new File([buffer], "audio.webm"), // Create proper File object from buffer
          model: whisperModel || "whisper-1",
          language: sourceLanguage || undefined, // Pass undefined if not specified, to let Whisper auto-detect
        });

      const trimmedText = transcriptionResult.text.trim();
      logger.log(`Transcription for ${clientId}: "${trimmedText}"`);

      const transcriptionMessage = {
        text: trimmedText,
        isFinal: isFinal !== undefined ? isFinal : true, // Assume final if not specified
        timestamp: new Date().toISOString(),
      };

      await channel.publish({
        name: "transcription_update",
        data: transcriptionMessage,
      });
      logger.log(
        `Published transcription to Ably channel: ${transcriptionChannelName}`,
      );

      return NextResponse.json({ success: true, transcription: trimmedText });
    } catch (err: any) {
      logger.error(`Transcription error for ${clientId}:`, err);
      // Publish error to client via Ably as well?
      await channel.publish({
        name: "transcription_error",
        data: {
          message: `Transcription failed: ${err?.message || "Unknown error"}`,
          error: err,
        },
      });
      return jsonError("Transcription failed", 500, err.message);
    }
    // --- End OpenAI Whisper Transcription Logic ---
  } catch (error: any) {
    logger.error("Error processing audio submission:", error);
    return jsonError(
      "Failed to process audio submission",
      500,
      error.message,
    );
  }
}
