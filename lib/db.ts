import mysql, { RowDataPacket } from "mysql2/promise";

export const db = mysql.createPool({
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  waitForConnections: true,
  connectionLimit: 10, // Limit max connections at one time
  queueLimit: 0,
});

export type { RowDataPacket };