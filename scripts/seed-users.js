require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../src/models/User");

async function upsertUser({ email, nickname, password, role }) {
  if (!email || !nickname || !password || !role) return;

  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(String(password), 10);

  await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      nickname: String(nickname).trim(),
      passwordHash,
      role,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log(`Seeded ${role}: ${normalizedEmail}`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "node-a03",
  });

  await upsertUser({
    email: process.env.PERSONAL_ADMIN_EMAIL,
    nickname: process.env.PERSONAL_ADMIN_NICKNAME,
    password: process.env.PERSONAL_ADMIN_PASSWORD,
    role: "ADMIN",
  });

  await upsertUser({
    email: process.env.TEST_USER_EMAIL,
    nickname: process.env.TEST_USER_NICKNAME,
    password: process.env.TEST_USER_PASSWORD,
    role: "USER",
  });

  await upsertUser({
    email: process.env.TEST_MODERATOR_EMAIL,
    nickname: process.env.TEST_MODERATOR_NICKNAME,
    password: process.env.TEST_MODERATOR_PASSWORD,
    role: "MODERATOR",
  });

  await upsertUser({
    email: process.env.TEST_ADMIN_EMAIL,
    nickname: process.env.TEST_ADMIN_NICKNAME,
    password: process.env.TEST_ADMIN_PASSWORD,
    role: "ADMIN",
  });

  await mongoose.disconnect();
  console.log("User seeding complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});