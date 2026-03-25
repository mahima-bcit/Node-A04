const express = require("express");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const MongoStoreModule = require("connect-mongo");
const MongoStore = MongoStoreModule.default || MongoStoreModule;
require("dotenv").config();

const pageRouter = require("./src/routes/pages.routes");
const apiRouter = require("./src/routes/api.routes");
const authRouter = require("./src/routes/auth.routes");
const adminRouter = require("./src/routes/admin.routes");
const passport = require("./src/config/passport");
const { initMongo, isDbReady, getDbError } = require("./src/lib/mongo");

const app = express();
const PORT = process.env.PORT || 3000;

// Start Mongo
initMongo(process.env.MONGODB_URI);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me-in-env",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: "node-a03",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "public")));

// Globals for ALL views
app.use((req, res, next) => {
  res.locals.title = "Portfolio Launchpad";
  res.locals.dbReady = isDbReady();
  res.locals.dbError = getDbError();
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated =
    req.isAuthenticated && typeof req.isAuthenticated === "function"
      ? req.isAuthenticated()
      : false;
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
app.use("/auth", authRouter);
app.use("/admin", adminRouter);

// 404 Handling
// Unknown non-API routes
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  
  return res.status(404).render("404", { title: "Not Found", path: req.originalUrl });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (req.originalUrl.startsWith("/api")) {
    return res.status(500).json({ error: "Server error" });
  }
  return res
    .status(500)
    .render("500", { title: "Server Error", path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
