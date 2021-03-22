const express = require("express");
const logger = require("morgan");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const port = 3000;

const app = express();
app.use(logger("dev"));
app.user(express.urlencoded({ extended: true })); // To access the formulary

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

const myLogger = (req, res, next) => {
  // next will be used to pass information to next middleware
  console.log(req);
  next();
};

app.use(passport.initialize()); // Initialize the passport

app.use(function (err, req, res, next) {
  // err middleware have a different chain
  console.log(err.stack);
  res.status(500).send("there was an error");
});

app.use(myLogger); // registering a middleware to express

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/user", (req, res) => {
  const user = {
    username: "walrus",
    description: "it is what it is",
  };
  res.json(user);
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
