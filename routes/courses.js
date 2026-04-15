const express = require("express");
const Course = require("../models/Course");
const User = require("../models/User");
const { isLoggedIn, isAdmin } = require("./middleware");
const PDFDocument = require("pdfkit");

const router = express.Router();

// 🔹 Verify Certificate
router.get("/verify-certificate/:id", async (req, res) => {
  try {
    const certId = req.params.id;

    const course = await Course.findOne({
      "certificateIssued.certificateId": certId,
    }).populate("teacher");

    if (!course) {
      return res.render("verify", { valid: false });
    }

    const cert = course.certificateIssued.find(
      (c) => c.certificateId === certId,
    );

    const user = await User.findById(cert.userId);

    res.render("verify", {
      valid: true,
      user,
      course,
      certId,
    });
  } catch (error) {
    console.log(error);
    res.send("Verification error");
  }
});

// 🔹 Show all courses
router.get("/", isLoggedIn, async (req, res) => {
  const courses = await Course.find().populate("teacher");
  const user = await User.findById(req.session.userId);

  res.render("courses", { courses, user });
});

// 🔹 Show Create Course Form (Admin Only)
router.get("/new", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.session.userId);

  if (user.role !== "teacher" && user.role !== "admin") {
    return res.send("Access denied");
  }

  res.render("newCourse");
});

// 🔹 Handle Course Creation
router.post("/", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (user.role !== "teacher" && user.role !== "admin") {
      return res.send("Only teachers or admins can create courses");
    }

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
router.post("/:id/enroll", isLoggedIn, async (req, res) => {
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

// 🔹 Delete Course (Admin Only)
router.post("/:id/delete", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const courseId = req.params.id;

    // Remove course from all users
    await User.updateMany(
      { enrolledCourses: courseId },
      { $pull: { enrolledCourses: courseId } },
    );

    // Delete course
    await Course.findByIdAndDelete(courseId);

    res.redirect("/admin");
  } catch (error) {
    console.log(error);
    res.send("Error deleting course");
  }
});

// 🔹 Delete Lesson (Admin Only)
router.post(
  "/:courseId/lessons/:lessonId/delete",
  isLoggedIn,
  async (req, res) => {
    try {
      const { courseId, lessonId } = req.params;

      const user = await User.findById(req.session.userId);
      const course = await Course.findById(courseId);

      // 🔐 Permission check
      if (
        user.role !== "admin" &&
        !(
          user.role === "teacher" &&
          course.teacher.toString() === user._id.toString()
        )
      ) {
        return res.send("Not authorized to delete lessons");
      }

      await Course.findByIdAndUpdate(courseId, {
        $pull: { lessons: { _id: lessonId } },
      });

      res.redirect(`/courses/${courseId}`);
    } catch (error) {
      console.log(error);
      res.send("Error deleting lesson");
    }
  },
);
// 🔹 Show Add Lesson Form (Admin Only)
router.get("/:id/lessons/new", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.session.userId);
  const course = await Course.findById(req.params.id);

  if (
    user.role !== "admin" &&
    !(
      user.role === "teacher" &&
      course.teacher.toString() === user._id.toString()
    )
  ) {
    return res.send("Not authorized");
  }

  res.render("newLesson", { course });
});

// 🔹 Handle Add Lesson (Admin Only)
router.post("/:id/lessons", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const course = await Course.findById(req.params.id);

    // 🔐 Permission check
    if (
      user.role !== "admin" &&
      !(
        user.role === "teacher" &&
        course.teacher.toString() === user._id.toString()
      )
    ) {
      return res.send("Not authorized to add lessons");
    }

    const { title, videoUrl, description, pdfNotes, assignment } = req.body;

    course.lessons.push({
      title,
      videoUrl,
      description,
      pdfNotes,
      assignment,
    });

    await course.save();

    res.redirect(`/courses/${req.params.id}`);
  } catch (error) {
    console.log(error);
    res.send("Error adding lesson");
  }
});

// 🔹 View Single Course (Only If Enrolled)
router.get("/:id", isLoggedIn, async (req, res) => {
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
  "/:courseId/lessons/:lessonId/complete",
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

const crypto = require("crypto");

// 🔹 Generate Certificate
router.get("/:id/certificate", isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const course = await Course.findById(req.params.id).populate("teacher");

    // ======================
    // 🔢 Progress Check
    // ======================
    const totalLessons = course.lessons.length;

    const completed = user.completedLessons.filter((lessonId) =>
      course.lessons.some(
        (lesson) => lesson._id.toString() === lessonId.toString(),
      ),
    ).length;

    const progress =
      totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100);

    if (progress !== 100) {
      return res.send("Complete the course to get certificate");
    }

    // ======================
    // 🔑 Certificate ID Logic
    // ======================
    let certificateId = crypto.randomBytes(4).toString("hex");

    const existing = course.certificateIssued.find(
      (c) => c.userId.toString() === user._id.toString(),
    );

    if (!existing) {
      course.certificateIssued.push({
        userId: user._id,
        certificateId,
      });
      await course.save();
    } else {
      certificateId = existing.certificateId;
    }

    // ======================
    // 📄 PDF Setup
    // ======================
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=certificate-${course.title}.pdf`,
    );

    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // ======================
    // 🎨 BACKGROUND + BORDER
    // ======================
    doc.rect(0, 0, pageWidth, pageHeight).fill("#ffffff");

    doc.lineWidth(3).strokeColor("#2563eb");
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60).stroke();

    doc.lineWidth(1).strokeColor("#93c5fd");
    doc.rect(45, 45, pageWidth - 90, pageHeight - 90).stroke();

    // ======================
    // 🏆 HEADER
    // ======================
    doc
      .fillColor("#2563eb")
      .fontSize(28)
      .text("EDUVERSE", 0, 80, { align: "center" });

    doc
      .fontSize(16)
      .fillColor("#111827")
      .text("CERTIFICATE OF COMPLETION", 0, 115, { align: "center" });

    doc
      .moveTo(pageWidth / 2 - 120, 140)
      .lineTo(pageWidth / 2 + 120, 140)
      .stroke("#2563eb");

    // ======================
    // 📜 BODY (FIXED POSITIONS)
    // ======================
    doc
      .fontSize(14)
      .fillColor("#374151")
      .text("This certificate is proudly awarded to", 0, 180, {
        align: "center",
      });

    doc
      .fontSize(28)
      .fillColor("#1d4ed8")
      .text(user.name.toUpperCase(), 0, 210, {
        align: "center",
      });

    doc
      .fontSize(14)
      .fillColor("#374151")
      .text("for successfully completing the course", 0, 260, {
        align: "center",
      });

    doc.fontSize(20).fillColor("#2563eb").text(course.title, 0, 290, {
      align: "center",
    });

    // ======================
    // 🏅 FOOTER (FIXED — NO OVERFLOW)
    // ======================
    const footerY = pageHeight - 130;

    // Instructor
    doc
      .fontSize(12)
      .fillColor("#111827")
      .text(`Instructor: ${course.teacher.name}`, 60, footerY);

    // Date
    doc.text(
      `Date: ${new Date().toLocaleDateString()}`,
      pageWidth - 200,
      footerY,
    );

    // Signature
    doc
      .moveTo(pageWidth / 2 - 80, footerY + 20)
      .lineTo(pageWidth / 2 + 80, footerY + 20)
      .stroke("#2563eb");

    doc
      .fontSize(11)
      .fillColor("#374151")
      .text("Authorized Signature", pageWidth / 2 - 65, footerY + 25);

    // ======================
    // 🔐 CERTIFICATE ID + VERIFY (CENTERED)
    // ======================
    doc
      .fontSize(10)
      .fillColor("#6b7280")
      .text(`Certificate ID: ${certificateId}`, 0, footerY + 55, {
        align: "center",
      });

    doc
      .fontSize(10)
      .text(
        `Verify at: https://eduverse.onrender.com/courses/verify-certificate/${certificateId}`,
        {
          align: "center",
        },
      );

    // ======================
    // 🔵 PREMIUM BADGE
    // ======================
    const badgeX = pageWidth - 100;
    const badgeY = 110;

    // Outer
    doc.lineWidth(2).strokeColor("#2563eb").circle(badgeX, badgeY, 35).stroke();

    // Inner
    doc.lineWidth(1).strokeColor("#93c5fd").circle(badgeX, badgeY, 28).stroke();

    // Text
    doc
      .fontSize(8)
      .fillColor("#2563eb")
      .text("VERIFIED", badgeX - 22, badgeY - 5);

    doc.fontSize(6).text("EDUVERSE", badgeX - 20, badgeY + 5);

    doc.end();
  } catch (error) {
    console.log(error);
    res.send("Error generating certificate");
  }
});
module.exports = router;
