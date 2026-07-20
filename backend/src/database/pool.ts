import mysql from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = mysql.createPool({
   uri: process.env.DATABASE_URL,
  // host: process.env.DB_HOST,
  // port: Number(process.env.DB_PORT || 3306),
  // database: process.env.DB_NAME,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,

  ssl:
  process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: false,
      }
    : undefined,

  timezone: env.DB_TIMEZONE,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  queueLimit: 0,

});

export type Db = typeof pool;
