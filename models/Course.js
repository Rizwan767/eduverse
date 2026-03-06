const mongoose = require("mongoose");
const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  videoUrl: {
    type: String,
    required: true,
  },

  description: {
    type: String,
  },

  pdfNotes: {
    type: String,
  },

  assignment: {
    type: String,
  },
});
const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },

  thumbnail: {
    type: String,
  },

  // 👨‍🏫 Teacher who created the course
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  lessons: [lessonSchema],
});

module.exports = mongoose.model("Course", courseSchema);
