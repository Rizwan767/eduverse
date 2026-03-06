const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
require("dotenv").config();

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "eduverse_secret",
    resave: false,
    saveUninitialized: false,
  }),
);

const authRoutes = require("./routes/auth");
app.use(authRoutes);

const courseRoutes = require("./routes/courses");
app.use(courseRoutes);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("EduVerse Server Running 🚀");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
