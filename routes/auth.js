const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

// Show Register Page
router.get("/register", (req, res) => {
  res.render("register");
});

// Handle Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.redirect("/login");
  } catch (error) {
    console.log(error);
    res.send("Error registering user");
  }
});

// Show Login Page
router.get("/login", (req, res) => {
  res.render("login");
});

// Handle Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.send("User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("Incorrect password");
    }

    req.session.userId = user._id;
    req.session.role = user.role;
    console.log(req.session);

    res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
    res.send("Login Error");
  }
});

const { isLoggedIn } = require("./middleware");

router.get("/dashboard", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.session.userId).populate({
    path: "enrolledCourses",
    populate: { path: "teacher" },
  });

  res.render("dashboard", { user });
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;
