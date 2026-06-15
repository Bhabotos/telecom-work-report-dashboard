import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { initializeDatabase, get, run } from "./db.js";

dotenv.config();
initializeDatabase();

const name = process.env.ADMIN_NAME || "System Administrator";
const email = process.env.ADMIN_EMAIL || "admin@telecom.local";
const password = process.env.ADMIN_PASSWORD || "Admin@123";

if (!get("SELECT id FROM users WHERE email = :email", { email })) {
  run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :password_hash, 'admin')`,
    { name, email, password_hash: bcrypt.hashSync(password, 12) }
  );
  console.log(`Admin created: ${email}`);
} else {
  console.log(`Admin already exists: ${email}`);
}

console.log("Database setup complete.");
