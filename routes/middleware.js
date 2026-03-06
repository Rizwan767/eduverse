function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.session.role === "admin") {
    return next();
  }
  return res.send("Access denied. Admins only.");
}

module.exports = { isLoggedIn, isAdmin };
