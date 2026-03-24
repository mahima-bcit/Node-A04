const express = require("express");
const router = express.Router();

const repo = require("../lib/projects.repository");
const Category = require("../models/Category");

// List Projects with optional search
router.get("/projects", async (req, res) => {
  if (!res.locals.dbReady)
    return res.status(500).json({ error: "Database not connected" });

  const q = (req.query.q || "").trim();
  const tag = (req.query.tag || "").trim();

  const projects = await repo.getActiveProjects({ q, tag });
  return res.json(projects);
});

router.get("/projects/category/:slug", async (req, res) => {
  if (!res.locals.dbReady)
    return res.status(500).json({ error: "Database not connected" });

  const category = await repo.getCategoryBySlug(req.params.slug);
  if (!category) return res.status(404).json({ error: "Category not found" });

  const q = (req.query.q || "").trim();
  const tag = (req.query.tag || "").trim();

  const projects = await repo.getActiveProjects({
    q,
    tag,
    categoryId: category._id,
  });
  return res.json(projects);
});

// Project Details by ID
router.get("/projects/:id", async (req, res) => {
  if (!res.locals.dbReady)
    return res.status(500).json({ error: "Database not connected" });

  const project = await repo.findById(req.params.id);

  if (!project || project.isActive !== true) {
    return res.status(404).json({ error: "Project not found" });
  }
  return res.json(project);
});

router.get("/categories", async (req, res) => {
  if (!res.locals.dbReady)
    return res.status(500).json({ error: "Database not connected" });

  const categories = await Category.find().sort({ name: 1 }).lean();
  return res.json(categories);
});

// JSON 404 for unknown API routes
router.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

module.exports = router;
