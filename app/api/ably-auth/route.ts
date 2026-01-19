export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import Ably from "ably";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/ably-auth");

export async function GET(request: NextRequest) {
  if (!process.env.ABLY_API_KEY) {
    logger.error("ABLY_API_KEY not configured.");
    return jsonError("Ably API key not configured on server", 500);
  }

  try {
    const clientId =
      request.nextUrl.searchParams.get("clientId") || "default-client";
    logger.log(`Requesting token for clientId: ${clientId}`);

    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    // Define capabilities for the token, e.g., allow subscribing and publishing to certain channels
    // For a whisper app, the client might need to subscribe to a channel for results
    // and publish to a channel for audio data (or use HTTP for audio data as planned).
    const tokenParams: Ably.TokenParams = {
      clientId: clientId,
      capability: {
        // Example: allow client to subscribe to a channel specific to its session/ID
        // `transcription:${clientId}`: ['subscribe'],
        // Example: allow client to publish to a general audio processing channel
        // `audio-processing`: ['publish']
        // For now, let's give broad capabilities for testing, refine later.
        "*": ["subscribe", "publish"],
      },
    };

    const tokenRequest = await ably.auth.createTokenRequest(tokenParams);
    logger.log("Token request created successfully.");
    return NextResponse.json(tokenRequest);
  } catch (error: any) {
    logger.error("Error creating Ably token request:", error);
    return jsonError(
      "Failed to create Ably token request",
      500,
      error.message,
    );
  }
}
