const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true } },
  { _id: false },
);

const imageSchema = new mongoose.Schema({
  path: { type: String, required: true, trim: true },
  alt: { type: String, default: "" },
  type: { type: String, default: "gallery" },
  isFeatured: { type: Boolean, default: false },
});

const projectSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    isActive: { type: Boolean, required: true },
    tags: { type: [tagSchema], default: [] },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    tagline: { type: String, default: "" },
    stack: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    dates: {
      created: String,
      updated: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Project", projectSchema, "projects");
