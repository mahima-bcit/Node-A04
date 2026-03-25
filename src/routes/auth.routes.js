const express = require("express");
const bcrypt = require("bcrypt");
const passport = require("../config/passport");
const User = require("../models/User");

const router = express.Router();

function renderLogin(res, error = null) {
  return res.render("auth/login", {
    title: "Login",
    error,
  });
}

function renderRegister(res, error = null, formData = {}) {
  return res.render("auth/register", {
    title: "Register",
    error,
    formData,
  });
}

router.get("/login", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/");
  }

  return renderLogin(res, req.query.error ? "Invalid email or password." : null);
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return renderLogin(res, info?.message || "Invalid email or password.");
    }

    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.redirect("/");
    });
  })(req, res, next);
});

router.get("/register", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/");
  }

  return renderRegister(res);
});

router.post("/register", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const nickname = String(req.body.nickname || "").trim();
    const password = String(req.body.password || "");

    if (!email || !nickname || !password) {
      return renderRegister(res, "All fields are required.", { email, nickname });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return renderRegister(res, "Email already exists.", { email, nickname });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      nickname,
      passwordHash,
      role: "USER",
      lastLogin: new Date(),
    });

    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.redirect("/");
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return renderRegister(res, "Email already exists.", {
        email: req.body.email,
        nickname: req.body.nickname,
      });
    }

    return next(err);
  }
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      return res.redirect("/");
    });
  });
});

module.exports = router;