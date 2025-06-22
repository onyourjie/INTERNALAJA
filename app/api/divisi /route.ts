import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query("SELECT id, nama FROM divisi");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Database error during divisi fetch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
