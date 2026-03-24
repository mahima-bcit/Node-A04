const express = require("express");
const mongoose = require("mongoose");

const Contact = require("../models/Contact");
const Category = require("../models/Category");
const Project = require("../models/Project");
const repo = require("../lib/projects.repository");

const router = express.Router();

// Helpers
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function renderDbError(res, req) {
  return res.status(500).render("db-error", {
    title: "Database Error",
    error: res.locals.dbError,
    path: req.originalUrl,
  });
}

function jsonDbError(res) {
  return res.status(500).json({ error: "Database not connected" });
}

function renderNotFound(res, req) {
  return res.status(404).render("404", {
    title: "Not Found",
    path: req.originalUrl,
  });
}

// Dashboard
router.get("/", (req, res) => {
  res.render("admin/index", { title: "Admin" });
});

/* ---------------- Contacts Admin ---------------- */

// GET /admin/contacts
router.get("/contacts", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const contacts = await Contact.find({}).sort({ postedDate: -1 }).lean();
  res.render("admin/contacts/index", { title: "Admin - Contacts", contacts });
});

// PATCH /admin/contacts/:id/read (toggle isRead)
router.patch("/contacts/:id/read", async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ error: "Not found" });

  const contact = await Contact.findById(req.params.id);
  if (!contact) return res.status(404).json({ error: "Not found" });

  contact.isRead = !contact.isRead;
  await contact.save();

  res.json({ ok: true, isRead: contact.isRead });
});

// DELETE /admin/contacts/:id
router.delete("/contacts/:id", async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ error: "Not found" });

  const deleted = await Contact.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Not found" });

  res.json({ ok: true });
});

/* ---------------- Categories CRUD ---------------- */

// GET /admin/categories
router.get("/categories", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const categories = await Category.aggregate([
    {
      $lookup: {
        from: "projects",
        localField: "_id",
        foreignField: "categoryId",
        as: "projects",
      },
    },
    { $addFields: { projectCount: { $size: "$projects" } } },
    { $project: { projects: 0 } },
    { $sort: { name: 1 } },
  ]);

  res.render("admin/categories/index", {
    title: "Admin - Categories",
    categories,
  });
});

// GET /admin/categories/new
router.get("/categories/new", async (req, res) => {
  res.render("admin/categories/form", {
    title: "New Category",
    category: null,
    error: null,
  });
});

// POST /admin/categories
router.post("/categories", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  try {
    await Category.create({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description || "",
    });

    res.redirect("/admin/categories");
  } catch (e) {
    res.status(400).render("admin/categories/form", {
      title: "New Category",
      category: req.body,
      error: "Could not create category (slug must be unique and URL-safe).",
    });
  }
});

// GET /admin/categories/:id/edit
router.get("/categories/:id/edit", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const category = await Category.findById(req.params.id).lean();
  if (!category) return renderNotFound(res, req);

  res.render("admin/categories/form", {
    title: "Edit Category",
    category,
    error: null,
  });
});

// POST /admin/categories/:id
router.post("/categories/:id", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  try {
    await Category.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description || "",
      },
      { runValidators: true },
    );

    res.redirect("/admin/categories");
  } catch (e) {
    res.status(400).render("admin/categories/form", {
      title: "Edit Category",
      category: { _id: req.params.id, ...req.body },
      error:
        "Could not update category. Make sure the slug is unique and URL-safe.",
    });
  }
});

// DELETE /admin/categories/:id (SAFE DELETE: refuse if referenced)
router.delete("/categories/:id", async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ ok: false, message: "Not found" });

  const refCount = await Project.countDocuments({ categoryId: req.params.id });
  if (refCount > 0) {
    return res.status(409).json({
      ok: false,
      message: `Cannot delete: category is referenced by ${refCount} project(s).`,
    });
  }

  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted)
    return res.status(404).json({ ok: false, message: "Not found" });

  res.json({ ok: true });
});

/* ---------------- Project CRUD ---------------- */

// GET /admin/projects
router.get("/projects", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const projects = await Project.find({})
    .populate("categoryId")
    .sort({ title: 1 })
    .lean();

  res.render("admin/projects/index", { title: "Admin - Projects", projects });
});

// GET /admin/projects/new
router.get("/projects/new", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const categories = await Category.find({}).sort({ name: 1 }).lean();

  res.render("admin/projects/form", {
    title: "New Project",
    project: null,
    categories,
    error: null,
  });
});

// POST /admin/projects
router.post("/projects", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const payload = {
    slug: req.body.slug,
    title: req.body.title,
    tagline: req.body.tagline || "",
    description: req.body.description,
    isActive: req.body.isActive === "true",
    categoryId: req.body.categoryId,
    tags: repo.parseTagsCsv(req.body.tagsCsv),
  };

  const stackCsv = req.body.stack || "";
  payload.stack = stackCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await Project.create(payload);
    res.redirect("/admin/projects");
  } catch (e) {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    res.status(400).render("admin/projects/form", {
      title: "New Project",
      project: { ...payload, tagsCsv: req.body.tagsCsv, stackCsv },
      categories,
      error:
        "Could not create project. Check required fields and ensure slug is unique.",
    });
  }
});

// GET /admin/projects/:id/edit
router.get("/projects/:id/edit", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const categories = await Category.find({}).sort({ name: 1 }).lean();
  const project = await Project.findById(req.params.id).lean();
  if (!project) return renderNotFound(res, req);

  project.tagsCsv = (project.tags || []).map((t) => t.name).join(", ");
  project.stackCsv = (project.stack || []).join(", ");

  res.render("admin/projects/form", {
    title: "Edit Project",
    project,
    categories,
    error: null,
  });
});

// POST /admin/projects/:id
router.post("/projects/:id", async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const payload = {
    slug: req.body.slug,
    title: req.body.title,
    tagline: req.body.tagline || "",
    description: req.body.description,
    isActive: req.body.isActive === "true",
    categoryId: req.body.categoryId,
    tags: repo.parseTagsCsv(req.body.tagsCsv),
  };

  const stackCsv = req.body.stack || "";
  payload.stack = stackCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await Project.findByIdAndUpdate(req.params.id, payload, {
      runValidators: true,
    });
    res.redirect("/admin/projects");
  } catch (e) {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    res.status(400).render("admin/projects/form", {
      title: "Edit Project",
      project: {
        _id: req.params.id,
        ...payload,
        tagsCsv: req.body.tagsCsv,
        stackCsv,
      },
      categories,
      error:
        "Could not update project. Check required fields and ensure slug is unique.",
    });
  }
});

// DELETE /admin/projects/:id
router.delete("/projects/:id", async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ ok: false, message: "Not found" });

  const deleted = await Project.findByIdAndDelete(req.params.id);
  if (!deleted)
    return res.status(404).json({ ok: false, message: "Not found" });

  res.json({ ok: true });
});

module.exports = router;
