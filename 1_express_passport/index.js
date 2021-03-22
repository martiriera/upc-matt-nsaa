const path = require("path");
const express = require("express");
const logger = require("morgan");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const JWTStrategy = require("passport-jwt").Strategy;
const jwt = require("jsonwebtoken");
const fortune = require("fortune-teller");
const cookieParser = require("cookie-parser");

const jwtSecret = require("crypto").randomBytes(16); // Create HMAC secret of 256 bits (16 random bytes)
// console.log(`Token secret: ${jwtSecret.toString("base64")}`);

const port = 3000;

const app = express();
app.use(logger("dev"));
app.use(express.urlencoded({ extended: true })); // To access the formulary
app.use(cookieParser());

passport.use(
  // Add strategies
  "local",
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
      session: false,
    },
    function (username, password, done) {
      if (username === "walrus" && password == "walrus") {
        const user = {
          username: "walrus",
          description: "you can visit the fortune teller",
        };
        done(null, user);
      }
      return done(null, false);
    }
  )
);

const cookieExtractor = function (req) {
  var token = null;
  if (req && req.cookies) {
    token = req.cookies["jwtCookie"];
  }
  return token;
};

passport.use(
  "jwt",
  new JWTStrategy(
    {
      jwtFromRequest: cookieExtractor,
      secretOrKey: jwtSecret,
    },
    function (jwtPayload, done) {
      return done(null, jwtPayload);
    }
  )
);
app.use(passport.initialize()); // Initialize the passport

app.use(function (err, req, res, next) {
  // err middleware have a different chain
  console.log(err.stack);
  res.status(500).send("there was an error");
});

app.get(
  "/",
  passport.authenticate("jwt", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    res.send(fortune.fortune());
  }
);

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/bad-credentials", (req, res) => {
  res.sendFile(path.join(__dirname, "badCredentials.html"));
});
app.get("/logout", (req, res) => {
  res.cookie("jwtCookie", { maxAge: 0 });
  res.send("Logged out");
});
app.post(
  "/login",
  // we add a middleware "on the fly" to authenticate
  passport.authenticate("local", {
    session: false,
    failureRedirect: "/bad-credentials",
  }), // if fail, redirect to /login GET version
  (req, res) => {
    const payload = {
      iss: "localhost:300", // Issuer, usually the domain name
      sub: req.user.username, // User, we can get it from the request
      aud: "localhost:300", // Audience, may change (i.e. /part1, /part2...)
      exp: Math.floor(Date.now() / 1000) + 604800, // Expiration, when we want the token to expire (in this case 1 week from now)
      role: "user", // Private JWT field
  };
    const token = jwt.sign(payload, jwtSecret);

    var cookie = req.cookies.jwtCookie;
    const expiresInMilis = 30000;
    if (cookie === undefined) {
      res.cookie("jwtCookie", token, {
        maxAge: expiresInMilis,
        httpOnly: true,
});
      console.log("Cookie created");
      setTimeout(() => console.log("Cookie has expired"), expiresInMilis);
    } else {
      console.log("Cookie exists");
    }
    res.redirect("/");
  }
);

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
