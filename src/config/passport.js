const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const User = require("../models/User");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
          return done(null, false, { message: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(String(password || ""), user.passwordHash);

        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password." });
        }

        user.lastLogin = new Date();
        await user.save();

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;