const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Course = require("../models/Course");
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

const { isLoggedIn, isAdmin } = require("./middleware");

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

router.get("/admin", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const users = await User.find().populate("enrolledCourses");
    const courses = await Course.find().populate("teacher");

    // 📊 Stats
    const totalUsers = await User.countDocuments();
    const totalCourses = await Course.countDocuments();

    // Total enrollments
    let totalEnrollments = 0;
    users.forEach((user) => {
      totalEnrollments += user.enrolledCourses.length;
    });

    res.render("admin", {
      users,
      courses,
      currentUserId: req.session.userId,
      totalUsers,
      totalCourses,
      totalEnrollments,
    });
  } catch (error) {
    console.log(error);
    res.send("Error loading admin panel");
  }
});

router.get("/admin/course/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate("teacher");

    const users = await User.find({
      enrolledCourses: course._id,
    });

    res.render("adminCourse", { course, users });
  } catch (error) {
    console.log(error);
    res.send("Error loading course students");
  }
});

router.post(
  "/admin/course/:courseId/remove/:userId",
  isLoggedIn,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, userId } = req.params;

      await User.findByIdAndUpdate(userId, {
        $pull: { enrolledCourses: courseId },
      });

      res.redirect(`/admin/course/${courseId}`);
    } catch (error) {
      console.log(error);
      res.send("Error removing student");
    }
  },
);

router.post("/admin/user/:id/role", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;
    const currentUserId = req.session.userId;

    // ❌ Prevent admin from changing their own role
    if (targetUserId === currentUserId) {
      return res.send("You cannot change your own role");
    }

    // ✅ Allow only valid roles
    const validRoles = ["student", "teacher", "admin"];
    if (!validRoles.includes(role)) {
      return res.send("Invalid role");
    }

    await User.findByIdAndUpdate(targetUserId, { role });

    res.redirect("/admin");
  } catch (error) {
    console.log(error);
    res.send("Error updating role");
  }
});
module.exports = router;
