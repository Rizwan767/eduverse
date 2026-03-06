const express = require("express");
const Course = require("../models/Course");
const User = require("../models/User");
const { isLoggedIn, isAdmin } = require("./middleware");

const router = express.Router();

// 🔹 Show all courses
router.get("/courses", isLoggedIn, async (req, res) => {
  const courses = await Course.find().populate("teacher");
  const user = await User.findById(req.session.userId);

  res.render("courses", { courses, user });
});

// 🔹 Show Create Course Form (Admin Only)
router.get("/courses/new", isLoggedIn, (req, res) => {
  res.render("newCourse");
});

// 🔹 Handle Course Creation
router.post("/courses", isLoggedIn, async (req, res) => {
  try {
    const { title, description, thumbnail } = req.body;

    await Course.create({
      title,
      description,
      thumbnail,
      teacher: req.session.userId,
    });

    res.redirect("/courses");
  } catch (error) {
    console.log(error);
    res.send("Error creating course");
  }
});

// 🔹 Enroll in Course
router.post("/courses/:id/enroll", isLoggedIn, async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.session.userId;

    await User.findByIdAndUpdate(userId, {
      $addToSet: { enrolledCourses: courseId },
    });

    res.redirect("/courses");
  } catch (error) {
    console.log(error);
    res.send("Enrollment Error");
  }
});

// 🔹 Show Add Lesson Form (Admin Only)
router.get(
  "/courses/:id/lessons/new",
  isLoggedIn,
  isAdmin,
  async (req, res) => {
    const course = await Course.findById(req.params.id);
    res.render("newLesson", { course });
  },
);

// 🔹 Handle Add Lesson (Admin Only)
router.post("/courses/:id/lessons", isLoggedIn, isAdmin, async (req, res) => {
  const { title, videoUrl, description, pdfNotes, assignment } = req.body;

  const course = await Course.findById(req.params.id);

  course.lessons.push({
    title,
    videoUrl,
    description,
    pdfNotes,
    assignment,
  });

  await course.save();

  res.redirect("/courses");
});

// 🔹 View Single Course (Only If Enrolled)
router.get("/courses/:id", isLoggedIn, async (req, res) => {
  const course = await Course.findById(req.params.id);
  const user = await User.findById(req.session.userId);

  const isEnrolled = user.enrolledCourses.some(
    (id) => id.toString() === course._id.toString(),
  );

  if (!isEnrolled) {
    return res.send("You must enroll in this course to view it.");
  }

  const totalLessons = course.lessons.length;

  const completedCount = course.lessons.filter((lesson) =>
    user.completedLessons.some((id) => id.toString() === lesson._id.toString()),
  ).length;

  const progress =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  res.render("courseDetail", { course, user, progress });
});

// 🔹 Mark Lesson Complete
router.post(
  "/courses/:courseId/lessons/:lessonId/complete",
  isLoggedIn,
  async (req, res) => {
    const { lessonId, courseId } = req.params;
    const userId = req.session.userId;

    await User.findByIdAndUpdate(userId, {
      $addToSet: { completedLessons: lessonId },
    });

    res.redirect(`/courses/${courseId}`);
  },
);

const PDFDocument = require("pdfkit");

router.get("/courses/:id/certificate", isLoggedIn, async (req, res) => {
  const course = await Course.findById(req.params.id).populate("teacher");
  const user = await User.findById(req.session.userId);

  const totalLessons = course.lessons.length;

  const completedCount = course.lessons.filter((lesson) =>
    user.completedLessons.some((id) => id.toString() === lesson._id.toString()),
  ).length;

  const progress =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  if (progress < 100) {
    return res.send("Complete the course to download certificate.");
  }

  const doc = new PDFDocument({
    layout: "landscape",
    size: "A4",
    margin: 50,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${course.title}-certificate.pdf`,
  );

  doc.pipe(res);

  const center = doc.page.width / 2;

  // Border
  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

  // Title
  doc
    .fontSize(36)
    .text("EduVerse Learning Platform", 0, 120, { align: "center" });

  // Certificate Heading
  doc.fontSize(30).text("Certificate of Completion", { align: "center" });

  // Statement
  doc.fontSize(18).text("This certifies that", { align: "center" });

  // Student Name
  doc.fontSize(28).text(user.name, { align: "center" });

  // Completion text
  doc
    .fontSize(18)
    .text("has successfully completed the course", { align: "center" });

  // Course name
  doc.fontSize(22).text(course.title, { align: "center" });

  const today = new Date().toLocaleDateString();

  // Instructor
  doc
    .fontSize(16)
    .text(`Instructor: ${course.teacher.name}`, { align: "center" });

  // Date
  doc.text(`Date: ${today}`, { align: "center" });

  // Signature line
  doc.moveDown(2).text("__________________________", center - 100);

  doc.text("Instructor Signature", center - 70);

  doc.end();
});
module.exports = router;
