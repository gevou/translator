// File: app/api/c/route.ts

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { getDb } from "../_utils/db";
import { jsonError } from "../_utils/http";
import { createLogger } from "../_utils/logger";

const logger = createLogger("api/c");

export async function POST(request: Request) {
  const { id, item } = await request.json();
  if (!id || !item) return NextResponse.json({}, { status: 400 });
  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }
  // Legacy endpoint using `messages` table. Consider migrating to
  // formatted_conversation_turns or isolating to a legacy namespace.
  const rows =
    await sql`SELECT COUNT(*) from messages WHERE session_id = ${id}`;
  await sql`INSERT INTO messages (created_at, id, session_id, content_type, content_transcript, object, role, status, type) VALUES (${rows[0].count}, ${item.id}, ${id}, ${item.content[0].type}, ${item.content[0].transcript}, ${item.object}, ${item.role}, ${item.status}, ${item.type}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({});
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json([]);
  let sql;
  try {
    sql = getDb();
  } catch (error: any) {
    logger.error("Database not configured", error);
    return jsonError("Database not configured", 500, error.message);
  }
  const rows = await sql`SELECT * from messages WHERE session_id = ${id}`;
  return NextResponse.json(rows);
}

// Add a DELETE handler
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    logger.error("Missing conversation ID");
    return jsonError("Missing conversation ID", 400);
  }

  logger.log(`Attempting to delete messages for session_id: ${id}`);

  try {
    const sql = getDb();
    // Execute the delete query
    await sql`DELETE from messages WHERE session_id = ${id}`;
    logger.log(`Successfully deleted messages for session_id: ${id}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error(`Error deleting messages for session_id: ${id}`, error);
    return jsonError("Failed to delete messages", 500, error.message);
  }
}
