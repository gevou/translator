export const runtime = "edge"; // or 'nodejs' if you need Node.js specific APIs for LLM client
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "../_utils/db";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";
import { summarizeSession, type Turn } from "../_utils/summarizeSession";

const logger = createLogger("api/summarize-session");

export async function POST(request: Request) {
  logger.log("Handler invoked");
  const { sessionId } = await request.json();

  if (!sessionId) {
    return jsonError("Missing sessionId", 400);
  }

  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }

  try {
    // 1. Fetch conversation turns from the database
    const dbResult = await sql`
      SELECT id, session_id, text, turn_type, timestamp, language_code, actor, original_item_id
      FROM formatted_conversation_turns
      WHERE session_id = ${sessionId}
      ORDER BY timestamp ASC;
    `;
    const turns: Turn[] = dbResult as unknown as Turn[]; // Corrected type assertion

    if (!turns || turns.length === 0) {
      return NextResponse.json(
        { summary: "No conversation history found to summarize.", actions: [] },
        { status: 200 },
      );
    }

    // 2. Summarize with tool actions via helper
    const summaryData = await summarizeSession(sessionId, turns);

    // 5. Save summary and actions to the database
    try {
      await sql`
        INSERT INTO conversation_summaries (session_id, summary_text, detected_actions, created_at)
        VALUES (${sessionId}, ${summaryData.summary}, ${JSON.stringify(summaryData.actions)}, current_timestamp)
        ON CONFLICT (session_id) DO UPDATE SET
          summary_text = EXCLUDED.summary_text,
          detected_actions = EXCLUDED.detected_actions,
          created_at = current_timestamp;
      `;
      logger.log(`Successfully saved summary for session_id: ${sessionId}`);
    } catch (dbError) {
      logger.error(
        `Failed to save summary to DB for session_id: ${sessionId}`,
        dbError,
      );
      // Do not throw here, still return the summary to the client if LLM part was successful
    }

    return NextResponse.json(summaryData, { status: 200 });
  } catch (error: any) {
    logger.error(
      `Error during summarization for session_id: ${sessionId}`,
      error,
    );
    let errorMessage = "Failed to generate summary";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return jsonError("Failed to generate summary", 500, errorMessage);
  }
}
