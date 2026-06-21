import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.string().default("http://localhost:5173"),
  APP_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  APP_TIMEZONE: z.string().default("Asia/Colombo"),
  DB_TIMEZONE: z.string().regex(/^[+-]\d{2}:\d{2}$/).default("+05:30"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().default("personnel_management"),
  DB_USER: z.string().default("personnel_app"),
  DB_PASSWORD: z.string().default("personnel_password"),
  JWT_SECRET: z.string().min(24).default("local-development-secret-value"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  SUPER_ADMIN_NAME: z.string().default("System Admin"),
  SUPER_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!")
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  APP_ORIGINS: parsedEnv.APP_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
