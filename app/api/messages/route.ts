export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "../_utils/db";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";
import type { FormattedTurnInsert } from "../../../types/conversation";

const logger = createLogger("api/messages");

export async function POST(request: Request) {
  let turnData: FormattedTurnInsert;
  try {
    turnData = (await request.json()) as FormattedTurnInsert;
  } catch (error: any) {
    logger.error("Invalid JSON body", error);
    return jsonError("Invalid JSON body", 400);
  }

  if (
    !turnData ||
    !turnData.id ||
    !turnData.session_id ||
    !turnData.text ||
    !turnData.turn_type ||
    !turnData.language_code ||
    !turnData.actor
  ) {
    return jsonError("Missing required fields for formatted turn", 400);
  }

  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }

  try {
    // Use the provided timestamp if available, otherwise rely on DB default
    const timestampToInsert = turnData.timestamp
      ? new Date(turnData.timestamp).toISOString()
      : undefined;

    await sql`
      INSERT INTO formatted_conversation_turns (
        id, session_id, text, turn_type, timestamp, language_code, actor, original_item_id
      )
      VALUES (
        ${turnData.id}, 
        ${turnData.session_id}, 
        ${turnData.text}, 
        ${turnData.turn_type}, 
        ${timestampToInsert || sql`current_timestamp`}, 
        ${turnData.language_code}, 
        ${turnData.actor}, 
        ${turnData.original_item_id || null}
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    logger.log(
      `Inserted turn ID: ${turnData.id} for session: ${turnData.session_id}, type: ${turnData.turn_type}`,
    );
    return NextResponse.json(
      { success: true, id: turnData.id },
      { status: 201 },
    );
  } catch (error: any) {
    logger.error(
      `Error inserting turn for session_id: ${turnData.session_id}`,
      error,
    );
    return jsonError("Failed to save message", 500, error.message);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return jsonError("Missing session_id query parameter", 400);
  }

  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }

  try {
    const rows = await sql`
      SELECT id, session_id, text, turn_type, timestamp, language_code, actor, original_item_id
      FROM formatted_conversation_turns
      WHERE session_id = ${sessionId}
      ORDER BY timestamp ASC;
    `;
    return NextResponse.json(rows, { status: 200 });
  } catch (error: any) {
    logger.error(
      `Error fetching turns for session_id: ${sessionId}`,
      error,
    );
    return jsonError("Failed to fetch messages", 500, error.message);
  }
}
