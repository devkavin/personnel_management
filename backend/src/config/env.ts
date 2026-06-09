import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_ORIGIN: z.string().default("http://localhost:5173"),
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

export const env = envSchema.parse(process.env);
