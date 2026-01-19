// File: app/api/summaries/route.ts

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "../_utils/db";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/summaries");

export async function GET() {
  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }

  try {
    // Fetch session_id, a snippet of the summary, and summary creation time
    // Order by when the summary was created, newest first.
    const summaries = await sql`
      SELECT 
        session_id, 
        SUBSTRING(summary_text FROM 1 FOR 100) as summary_text_snippet, -- Adjust snippet length as needed
        created_at
      FROM conversation_summaries
      ORDER BY created_at DESC;
    `;

    if (!summaries) {
      // sql query itself might return null/undefined on error before throwing
      return jsonError(
        "Failed to fetch summaries, query returned no result.",
        500,
      );
    }

    return NextResponse.json(summaries, { status: 200 });
  } catch (error: any) {
    logger.error("Error fetching conversation summaries", error);
    return jsonError(
      "Failed to fetch conversation summaries",
      500,
      error.message,
    );
  }
}
