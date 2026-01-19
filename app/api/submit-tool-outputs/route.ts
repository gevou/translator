export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { jsonError } from "../_utils/http";
import { getOpenAiClient } from "../_utils/openai";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/submit-tool-outputs");

export async function POST(request: Request) {
  logger.log("Handler invoked");
  try {
    const { threadId, runId, toolOutputs } = await request.json();

    if (!threadId || !runId || !toolOutputs) {
      return jsonError("Missing threadId, runId, or toolOutputs", 400);
    }

    logger.log(
      `Submitting to OpenAI for threadId: ${threadId}, runId: ${runId}`,
    );
    logger.log(`Tool outputs: ${JSON.stringify(toolOutputs)}`);

    // Actual call to OpenAI SDK to submit tool outputs
    // IMPORTANT: Ensure your OpenAI client is initialized correctly with your API key
    const openai = getOpenAiClient();
    const run = await openai.beta.threads.runs.submitToolOutputs(
      threadId,
      runId,
      {
        tool_outputs: toolOutputs,
      },
    );

    logger.log(
      `Successfully submitted tool outputs. Run status: ${run.status}`,
    );

    // You might want to return the run object or just a success status
    // The client-side will then wait for subsequent WebSocket events to see the run continue.
    return NextResponse.json(
      { success: true, runStatus: run.status },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error("Error submitting tool outputs to OpenAI", error);
    let errorMessage = "Failed to submit tool outputs";
    if (error instanceof OpenAI.APIError) {
      errorMessage = `OpenAI API Error: ${error.status} ${error.name} - ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return jsonError("Failed to submit tool outputs", 500, errorMessage);
  }
}
