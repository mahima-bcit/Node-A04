require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Category = require("../src/models/Category");
const Project = require("../src/models/Project");

// --- helper: basic slug safe ---
function slugify(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTags(project) {
  const tags = Array.isArray(project.tags) ? project.tags : [];
  const stack = Array.isArray(project.stack) ? project.stack : [];

  const out = tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((name) => ({ name }));

  for (const s of stack) {
    if (out.length >= 3) break;
    const name = String(s).trim();
    if (!name) continue;
    if (!out.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      out.push({ name });
  }

  while (out.length < 3) out.push({ name: "misc" });

  return out;
}

function pickIsActive(project) {
  if (typeof project.isActive === "boolean") return project.isActive;
  if (typeof project.active === "boolean") return project.active;
  if (typeof project.status === "boolean") return project.status;
  return true;
}

function detectCategorySlug(project) {
  const stack = (project.stack || []).map((s) => String(s).toLowerCase());
  const tags = (project.tags || []).map((t) => String(t).toLowerCase());

  const hasBackend =
    stack.some((s) =>
      ["node", "express", "mongodb", "sqlite", "api"].some((k) =>
        s.includes(k),
      ),
    ) ||
    tags.some((t) =>
      ["api", "crud", "backend", "server"].some((k) => t.includes(k)),
    );

  const hasFrontend =
    stack.some((s) =>
      ["html", "css", "javascript", "tailwind", "sass", "vite", "react"].some(
        (k) => s.includes(k),
      ),
    ) ||
    tags.some((t) =>
      ["dom", "ui", "frontend", "css"].some((k) => t.includes(k)),
    );

  if (hasBackend && hasFrontend) return "fullstack";
  if (hasBackend) return "backend";
  if (hasFrontend) return "frontend";
  return "general";
}

async function upsertCategory({ name, slug, description }) {
  const doc = await Category.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug, description: description || "" } },
    { new: true, upsert: true },
  ).lean();

  return doc;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "node-db";

  if (!uri) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName });
  console.log("Connected to MongoDB: ", mongoose.connection.name);

  const categories = await Promise.all([
    upsertCategory({
      name: "Frontend",
      slug: "frontend",
      description: "UI / client-side projects",
    }),
    upsertCategory({
      name: "Backend",
      slug: "backend",
      description: "Server / API projects",
    }),
    upsertCategory({
      name: "Fullstack",
      slug: "fullstack",
      description: "Projects spanning UI + server",
    }),
    upsertCategory({
      name: "General",
      slug: "general",
      description: "Unclassified projects",
    }),
  ]);

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const jsonPath = path.join(__dirname, "..", "data", "projects.json");
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const parsed = JSON.parse(raw);

  const items = Array.isArray(parsed.projects) ? parsed.projects : [];
  console.log(`Found ${items.length} projects in data/projects.json`);

  let upserted = 0;

  for (const p of items) {
    const slug = p.slug || slugify(p.title);
    const categorySlug = detectCategorySlug(p);
    const category =
      categoryBySlug.get(categorySlug) || categoryBySlug.get("general");

    const doc = {
      slug,
      title: p.title || "Untitled",
      description: p.description || "",
      isActive: pickIsActive(p),
      tags: normalizeTags(p),
      categoryId: category._id,
      tagline: p.tagline || "",
      stack: Array.isArray(p.stack) ? p.stack : [],
      images: Array.isArray(p.images) ? p.images : [],
      dates: p.dates || {},
    };

    await Project.findOneAndUpdate(
      { slug: doc.slug },
      { $set: doc },
      { upsert: true, new: true, runValidators: true },
    );

    upserted++;
  }

  console.log(`Upserted ${upserted} projects into MongoDB`);
  await mongoose.disconnect();
  console.log("Done");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
