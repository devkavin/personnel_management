import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { pool } from "../pool.js";

export async function seedSuperAdmin() {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
  if (Array.isArray(rows) && rows.length > 0) {
    console.log("Super admin already exists");
    return;
  }

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
  await pool.query(
    `
      INSERT INTO users (client_id, display_name, email, password_hash, role)
      VALUES (NULL, :displayName, :email, :passwordHash, 'super_admin')
    `,
    {
      displayName: env.SUPER_ADMIN_NAME,
      email: env.SUPER_ADMIN_EMAIL,
      passwordHash
    }
  );
  console.log(`Seeded super admin ${env.SUPER_ADMIN_EMAIL}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedSuperAdmin()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
