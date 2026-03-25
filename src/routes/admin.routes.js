const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

const { requireRole } = require("../middleware/auth");
const Contact = require("../models/Contact");
const Category = require("../models/Category");
const Project = require("../models/Project");
const User = require("../models/User");
const repo = require("../lib/projects.repository");

const router = express.Router();

router.use(requireRole("MODERATOR", "ADMIN"));

const uploadDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(originalExt)
      ? originalExt
      : ".png";

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({ storage });

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

function buildProjectPayload(req) {
  const stackCsv = String(req.body.stack || "");

  return {
    slug: String(req.body.slug || "").trim(),
    title: String(req.body.title || "").trim(),
    tagline: String(req.body.tagline || "").trim(),
    description: String(req.body.description || "").trim(),
    isActive: req.body.isActive === "true",
    categoryId: req.body.categoryId,
    tags: repo.parseTagsCsv(req.body.tagsCsv),
    stack: stackCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    tagsCsv: String(req.body.tagsCsv || ""),
    stackCsv,
  };
}

function normalizeImages(images = []) {
  return images.map((img) => ({
    path: img.path,
    alt: img.alt || "",
    type: img.isFeatured || img.type === "cover" ? "cover" : "gallery",
    isFeatured: Boolean(img.isFeatured || img.type === "cover"),
  }));
}

function ensureSingleFeatured(images = []) {
  const normalized = normalizeImages(images);

  if (!normalized.length) return [];

  let featuredIndex = normalized.findIndex((img) => img.isFeatured);

  if (featuredIndex === -1) {
    featuredIndex = normalized.findIndex((img) => img.type === "cover");
  }

  if (featuredIndex === -1) {
    featuredIndex = 0;
  }

  return normalized.map((img, index) => ({
    path: img.path,
    alt: img.alt,
    type: index === featuredIndex ? "cover" : "gallery",
    isFeatured: index === featuredIndex,
  }));
}

function buildUploadedImages(files, title) {
  const result = [];

  const featuredFile = files?.featuredImage?.[0] || null;
  const galleryFiles = files?.galleryImages || [];

  if (featuredFile) {
    result.push({
      path: `/uploads/${featuredFile.filename}`,
      alt: `${title || "Project"} featured image`,
      type: "cover",
      isFeatured: true,
    });
  }

  galleryFiles.forEach((file, index) => {
    result.push({
      path: `/uploads/${file.filename}`,
      alt: `${title || "Project"} gallery image ${index + 1}`,
      type: "gallery",
      isFeatured: false,
    });
  });

  return ensureSingleFeatured(result);
}

function removeUploadedFile(siteRelativePath) {
  if (!siteRelativePath || !siteRelativePath.startsWith("/uploads/")) return;

  const diskPath = path.join(process.cwd(), "public", siteRelativePath.replace(/^\//, ""));
  fs.unlink(diskPath, () => {});
}

// Dashboard
router.get("/", (req, res) => {
  res.render("admin/index", { title: "Admin Dashboard" });
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

  return res.json({ ok: true, isRead: contact.isRead });
});

// DELETE /admin/contacts/:id
router.delete("/contacts/:id", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ error: "Not found" });

  const deleted = await Contact.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Not found" });

  return res.json({ ok: true });
});

/* ---------------- Categories CRUD ---------------- */

// GET /admin/categories
router.get("/categories", requireRole("ADMIN"), async (req, res) => {
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

  return res.render("admin/categories/index", {
    title: "Admin - Categories",
    categories,
  });
});

// GET /admin/categories/new
router.get("/categories/new", requireRole("ADMIN"), async (req, res) => {
  return res.render("admin/categories/form", {
    title: "New Category",
    category: null,
    error: null,
  });
});

// POST /admin/categories
router.post("/categories", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  try {
    await Category.create({
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description || "",
    });

    return res.redirect("/admin/categories");
  } catch (e) {
    return res.status(400).render("admin/categories/form", {
      title: "New Category",
      category: req.body,
      error: "Could not create category (slug must be unique and URL-safe).",
    });
  }
});

// GET /admin/categories/:id/edit
router.get("/categories/:id/edit", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const category = await Category.findById(req.params.id).lean();
  if (!category) return renderNotFound(res, req);

  return res.render("admin/categories/form", {
    title: "Edit Category",
    category,
    error: null,
  });
});

// POST /admin/categories/:id
router.post("/categories/:id", requireRole("ADMIN"), async (req, res) => {
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

    return res.redirect("/admin/categories");
  } catch (e) {
    return res.status(400).render("admin/categories/form", {
      title: "Edit Category",
      category: { _id: req.params.id, ...req.body },
      error:
        "Could not update category. Make sure the slug is unique and URL-safe.",
    });
  }
});

// DELETE /admin/categories/:id (SAFE DELETE: refuse if referenced)
router.delete("/categories/:id", requireRole("ADMIN"), async (req, res) => {
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

  return res.json({ ok: true });
});

/* ---------------- Project CRUD ---------------- */

// GET /admin/projects
router.get("/projects", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const projects = await Project.find({})
    .populate("categoryId")
    .sort({ title: 1 })
    .lean();

  return res.render("admin/projects/index", { title: "Admin - Projects", projects });
});

// GET /admin/projects/new
router.get("/projects/new", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const categories = await Category.find({}).sort({ name: 1 }).lean();

  return res.render("admin/projects/form", {
    title: "New Project",
    project: null,
    categories,
    error: null,
  });
});

// POST /admin/projects
router.post("/projects", requireRole("ADMIN"), 
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 12 },
  ]), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const payload = buildProjectPayload(req);
  const categories = await Category.find({}).sort({ name: 1 }).lean();

  try {
    payload.images = buildUploadedImages(req.files, payload.title);
    
    const created = await Project.create({
      slug: payload.slug,
      title: payload.title,
      tagline: payload.tagline,
      description: payload.description,
      isActive: payload.isActive,
      categoryId: payload.categoryId,
      tags: payload.tags,
      stack: payload.stack,
      images: payload.images,
    });

    return res.redirect(`/admin/projects/${created._id}/edit`);
  } catch (e) {
    return res.status(400).render("admin/projects/form", {
      title: "New Project",
      project: payload,
      categories,
      error:
        "Could not create project. Check required fields and ensure slug is unique.",
    });
  }
});

// GET /admin/projects/:id/edit
router.get("/projects/:id/edit", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const categories = await Category.find({}).sort({ name: 1 }).lean();
  const project = await Project.findById(req.params.id).lean();

  if (!project) return renderNotFound(res, req);

  project.tagsCsv = (project.tags || []).map((t) => t.name).join(", ");
  project.stackCsv = (project.stack || []).join(", ");
  project.images = ensureSingleFeatured(project.images || []);

  return res.render("admin/projects/form", {
    title: "Edit Project",
    project,
    categories,
    error: null,
  });
});

// POST /admin/projects/:id
router.post("/projects/:id", requireRole("ADMIN"),
  upload.fields([
    { name: "featuredImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 12 },
  ]),
  async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const categories = await Category.find({}).sort({ name: 1 }).lean();
  const payload = buildProjectPayload(req);
  const project = await Project.findById(req.params.id);

  if (!project) return renderNotFound(res, req);

  try {
    project.slug = payload.slug;
    project.title = payload.title;
    project.tagline = payload.tagline;
    project.description = payload.description;
    project.isActive = payload.isActive;
    project.categoryId = payload.categoryId;
    project.tags = payload.tags;
    project.stack = payload.stack;

    const existingImages = normalizeImages(project.images || []);
    const uploadedImages = buildUploadedImages(req.files, payload.title);
    project.images = ensureSingleFeatured([...existingImages, ...uploadedImages]);

    await project.save();

    return res.redirect(`/admin/projects/${project._id}/edit`);
  } catch (e) {
    return res.status(400).render("admin/projects/form", {
      title: "Edit Project",
      project: {
        _id: req.params.id,
        slug: payload.slug,
        title: payload.title,
        tagline: payload.tagline,
        description: payload.description,
        isActive: payload.isActive,
        categoryId: payload.categoryId,
        tagsCsv: payload.tagsCsv,
        stackCsv: payload.stackCsv,
        images: ensureSingleFeatured(project.images || []),
      },
      categories,
      error:
        "Could not update project. Check required fields and ensure slug is unique.",
    });
  }
});

router.post("/projects/:id/images/:index/featured", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const project = await Project.findById(req.params.id);
  if (!project) return renderNotFound(res, req);

  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= project.images.length) {
    return renderNotFound(res, req);
  }

  project.images = ensureSingleFeatured(
    project.images.map((img, i) => ({
      path: img.path,
      alt: img.alt,
      type: i === index ? "cover" : "gallery",
      isFeatured: i === index,
    })),
  );

  await project.save();
  return res.redirect(`/admin/projects/${project._id}/edit`);
});

router.post("/projects/:id/images/:index/delete", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const project = await Project.findById(req.params.id);
  if (!project) return renderNotFound(res, req);

  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= project.images.length) {
    return renderNotFound(res, req);
  }

  const deletedImage = project.images[index];
  project.images.splice(index, 1);
  project.images = ensureSingleFeatured(project.images);

  await project.save();
  removeUploadedFile(deletedImage?.path);

  return res.redirect(`/admin/projects/${project._id}/edit`);
});

// DELETE /admin/projects/:id
router.delete("/projects/:id", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return jsonDbError(res);
  if (!isValidObjectId(req.params.id))
    return res.status(404).json({ ok: false, message: "Not found" });

  const deleted = await Project.findByIdAndDelete(req.params.id);
  if (!deleted)
    return res.status(404).json({ ok: false, message: "Not found" });

  normalizeImages(deleted.images || []).forEach((img) => removeUploadedFile(img.path));
  res.json({ ok: true });
});

/* ---------------- Users ---------------- */

router.get("/users", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);

  const users = await User.find({}).sort({ createdAt: 1, email: 1 }).lean();

  return res.render("admin/users/index", {
    title: "Admin - Users",
    users,
    error: null,
  });
});

router.get("/users/:id/edit", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const user = await User.findById(req.params.id).lean();
  if (!user) return renderNotFound(res, req);

  return res.render("admin/users/form", {
    title: "Edit User",
    user,
    error: null,
  });
});

router.post("/users/:id", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  const user = await User.findById(req.params.id);
  if (!user) return renderNotFound(res, req);

  try {
    user.email = String(req.body.email || "").trim().toLowerCase();
    user.nickname = String(req.body.nickname || "").trim();

    const requestedRole = String(req.body.role || "").trim().toUpperCase();
    if (["USER", "MODERATOR", "ADMIN"].includes(requestedRole)) {
      user.role = requestedRole;
    }

    const password = String(req.body.password || "").trim();
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.redirect("/admin/users");
  } catch (e) {
    return res.status(400).render("admin/users/form", {
      title: "Edit User",
      user: {
        _id: req.params.id,
        email: req.body.email,
        nickname: req.body.nickname,
        role: req.body.role,
      },
      error: "Could not update user. Make sure the email is unique.",
    });
  }
});

router.post("/users/:id/delete", requireRole("ADMIN"), async (req, res) => {
  if (!res.locals.dbReady) return renderDbError(res, req);
  if (!isValidObjectId(req.params.id)) return renderNotFound(res, req);

  if (String(req.user._id) === String(req.params.id)) {
    const users = await User.find({}).sort({ createdAt: 1, email: 1 }).lean();

    return res.status(400).render("admin/users/index", {
      title: "Admin - Users",
      users,
      error: "You cannot delete your own account.",
    });
  }

  await User.findByIdAndDelete(req.params.id);
  return res.redirect("/admin/users");
});

module.exports = router;
