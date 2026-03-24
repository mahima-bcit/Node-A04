const Project = require("../models/Project");
const Category = require("../models/Category");

function escapeRegex(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter({ q, tag, categoryId, activeOnly } = {}) {
  const and = [];

  if (activeOnly) and.push({ isActive: true });
  if (categoryId) and.push({ categoryId });

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    and.push({
      $or: [
        { title: rx },
        { tagline: rx },
        { description: rx },
        { stack: rx },
        { "tags.name": rx },
      ],
    });
  }

  if (tag) {
    and.push({ "tags.name": new RegExp(`^${escapeRegex(tag)}$`, "i") });
  }

  return and.length > 0 ? { $and: and } : {};
}

async function getActiveProjects({ q, tag, categoryId } = {}) {
  const filter = buildFilter({ q, tag, categoryId, activeOnly: true });
  return Project.find(filter).populate("categoryId").sort({ title: 1 }).lean();
}

async function findBySlug(slug) {
  if (!slug) return null;
  return Project.findOne({ slug }).populate("categoryId").lean();
}

async function findById(id) {
  if (!id) return null;
  try {
    return await Project.findById(id).populate("categoryId").lean();
  } catch (err) {
    return null;
  }
}

async function getCategoryBySlug(slug) {
  if (!slug) return null;
  return Category.findOne({ slug }).lean();
}

function parseTagsCsv(csv) {
  return String(csv || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

module.exports = {
  getActiveProjects,
  findBySlug,
  findById,
  getCategoryBySlug,
  parseTagsCsv,
};
