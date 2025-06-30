import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, startDate, endDate, attendancesPerDay } = await request.json();

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { message: "Name, start date, and end date are required" },
        { status: 400 }
      );
    }

    // Convert to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range
    if (start > end) {
      return NextResponse.json(
        { message: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Calculate the difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Store main event
    const [eventResult] = await db.query(
      'INSERT INTO events (name, start_date, end_date, attendances_per_day) VALUES (?, ?, ?, ?)',
      [name, startDate, endDate, attendancesPerDay]
    );

    const eventId = (eventResult as any)?.insertId;

    if (!eventId) {
      throw new Error("Failed to create event");
    }

    // Generate days for the event
    const eventDays = [];
    const dateIter = new Date(start);

    for (let i = 1; i <= diffDays; i++) {
      const dayStr = `DAY ${i}`;
      const dateStr = dateIter.toISOString().split('T')[0];
      
      eventDays.push({
        day: dayStr,
        date: dateStr
      });

      await db.query(
        'INSERT INTO event_days (event_id, day, date) VALUES (?, ?, ?)',
        [eventId, dayStr, dateStr]
      );
      
      dateIter.setDate(dateIter.getDate() + 1);
    }

    return NextResponse.json({ 
      message: 'Agenda created successfully', 
      eventId,
      days: diffDays,
      daysRange: `${eventDays[0].day} - ${eventDays[eventDays.length-1].day}`
    }, { status: 201 });
    
  } catch (error) {
    console.error("[AGENDA_CREATION_ERROR]", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}