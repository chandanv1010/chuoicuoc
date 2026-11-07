// Tao (hoac dat lai mat khau) tai khoan admin de dang nhap thu tren may dev.
// Dung: node --env-file=.env scripts/create-admin.mjs
// Doc DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD trong .env.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.env.DEV_ADMIN_EMAIL;
const password = process.env.DEV_ADMIN_PASSWORD;
if (!email || !password) {
  console.error("Thieu DEV_ADMIN_EMAIL hoac DEV_ADMIN_PASSWORD trong .env");
  process.exit(1);
}

const db = new PrismaClient();
// Laravel dung tien to $2y$; giu nguyen de site Laravel cung dang nhap duoc.
const hash = (await bcrypt.hash(password, 10)).replace(/^\$2b\$/, "$2y$");
const now = new Date();
const catalogue = await db.user_catalogues.findFirst({ orderBy: { id: "asc" } });

await db.users.upsert({
  where: { email },
  update: { password: hash, publish: 2, deleted_at: null, updated_at: now },
  create: {
    name: "Dev Admin",
    email,
    password: hash,
    publish: 2,
    user_catalogue_id: catalogue?.id ?? 1n,
    created_at: now,
    updated_at: now,
  },
});
console.log(`Da tao/cap nhat admin: ${email}`);
await db.$disconnect();
