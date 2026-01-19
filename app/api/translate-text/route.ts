export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { jsonError, ApiError } from "../_utils/http";
import { translateTranscript } from "../_utils/translateText";

export async function POST(request: Request) {
  try {
    let { transcript, source_language } = await request.json();

    if (!transcript) {
      return jsonError("Missing transcript", 400);
    }

    const result = await translateTranscript({
      transcript,
      sourceLanguage: source_language,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    return jsonError(
      "Internal server error during processing",
      500,
      error.message || "Unknown error",
    );
  }
}
