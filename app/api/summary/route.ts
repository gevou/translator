export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "../_utils/db";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/summary");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return jsonError("Missing session_id", 400);
  }

  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }

  try {
    logger.log(`Fetching summary for session_id: ${sessionId}`);
    const summaryResult = await sql`
      SELECT session_id, summary_text, detected_actions, created_at
      FROM conversation_summaries
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (summaryResult.length === 0) {
      logger.log(`No summary found for session_id: ${sessionId}`);
      return jsonError("Summary not found", 404);
    }

    const dbSummary = summaryResult[0];
    // Ensure detected_actions is an array, even if null/undefined in DB
    const detectedActionsArray = dbSummary.detected_actions || "[]";

    const summaryData = {
      session_id: dbSummary.session_id,
      summary_text: dbSummary.summary_text,
      detected_actions: detectedActionsArray,
      created_at: dbSummary.created_at,
    };

    logger.log(`Summary found for session_id: ${sessionId}`, summaryData);
    return NextResponse.json(summaryData, { status: 200 });
  } catch (error: any) {
    logger.error(
      `Error fetching summary for session_id: ${sessionId}`,
      error,
    );
    return jsonError("Failed to fetch summary", 500, error.message);
  }
}
