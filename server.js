const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

const pageRouter = require("./src/routes/pages.routes");
const apiRouter = require("./src/routes/api.routes");

const adminRouter = require("./src/routes/admin.routes");
const { initMongo, isDbReady, getDbError } = require("./src/lib/mongo");

const app = express();
const PORT = process.env.PORT || 3000;

// Start Mongo
initMongo(process.env.MONGODB_URI);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));

// Globals for ALL views
app.use((req, res, next) => {
  res.locals.title = "Portfolio Launchpad";
  res.locals.dbReady = isDbReady();
  res.locals.dbError = getDbError();
  next();
});

// View Engine (EJS) + Layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layouts/layout-full");

// Routers
app.use("/", pageRouter);
app.use("/api", apiRouter);
app.use("/admin", adminRouter);

// 404 Handling
// Unknown non-API routes
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(404).render("404", { title: "Not Found", path: req.originalUrl });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (req.originalUrl.startsWith("/api")) {
    return res.status(500).json({ error: "Server error" });
  }
  res
    .status(500)
    .render("500", { title: "Server Error", path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
