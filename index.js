const path = require('path');
const express = require('express');
const logger = require('morgan');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JWTStrategy = require('passport-jwt').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const fortune = require('fortune-teller');
const cookieParser = require('cookie-parser');
const UserModel = require('./db/user');
const mongoose = require('mongoose');

const radclient = require('radclient')
const constants = require('./radiusOptions')

const jwtSecret = require('crypto').randomBytes(16); // Create HMAC secret of 256 bits (16 random bytes)
const port = 3000;
const cookieExpire = 30000; // Expire time of the cookie (now 30s for testing). It may be changed to match JWT exp claim.
var cookieTimer;

mongoose.connect('mongodb://localhost/fortuneteller', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
mongoose.Promise = global.Promise;

const app = express();
var dotenv = require('dotenv');
dotenv.config();
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(logger('dev'));
app.use(express.urlencoded({ extended: true })); // Middleware to access the formulary

app.use(passport.initialize()); // Initialize the passport
app.use(cookieParser());

app.use(function (err, req, res, next) {
  // err middleware have a different chain
  console.log(err.stack);
  res.status(500).send('there was an error');
});

/*
The local strategy requires a `verify` function which receives the credentials
(`username` and `password`) submitted by the user.  The function must verify
that the username and password are correct and then invoke `done` with a user
object, which will be set at `req.user` in route handlers after authentication.
*/
passport.use(
  'local',
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      session: false /* we will store a JWT in the cookie with all the required session data. 
      Our server does not need to keep a session, it's stateless*/,
    },
    async function (username, password, done) {
      const user = await UserModel.findOne({ username });
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }

      const valid = user.isValidPassword(password);
      if (!valid) {
        return done(null, false, { message: 'Wrong password' });
      }

      return done(null, user, { message: 'Logged in successfully' });
    }
  )
);

passport.use(
  'radius',
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password',
      session: false
    },
    function (username, password, done) {
      const packet = {
        code: 'Access-Request',
        secret: 'testing123',
        identifier: 123,
        attributes: [
          ['NAS-IP-Address', '127.0.1.1'],
          ['User-Name', `${username}@upc.edu`],
          ['User-Password', password]
        ]
      }
      radclient(packet, constants.OPTIONS, function (err, response) {
        console.log(packet)
        console.log(response);
        if (response.code === 'Access-Accept') {
          const user = { username: username }
          return done(null, user, { message: 'Logged in successfully (Access-Accept)' })
        } else if (response.code === 'Access-Reject') {
          return done(null, false, { message: 'Can not log in (Acces-Reject)' })
        } else {
          return done(null, false, { message: `Error: ${err}` })
        }
      })
    })
)

// https://www.npmjs.com/package/node-radius-client
// https://www.npmjs.com/package/radclient

const cookieExtractor = function (req) {
  var token = null;
  if (req && req.cookies) {
    token = req.cookies['jwtCookie'];
  }
  return token;
};

passport.use(
  'jwt',
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

passport.use(
  'github',
  new GitHubStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/login/oauth/access_token', // Callback of the server
    },
    function (accessToken, refreshToken, profile, cb) {
      return cb(null, { username: profile.username }, { message: 'Logged in successfully' });
    }
  )
);

app.get(
  '/',
  passport.authenticate('jwt', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    res.render('index', {
      fortune: fortune.fortune(),
      username: req.user.sub,
      expires: cookieExpire,
    });
  }
);

app.get('/login', (req, res) => {
  res.render('login', {});
});

app.get('/bad-credentials', (req, res) => {
  res.render('badCredentials', {});
});

app.get('/logout', (req, res) => {
  res.clearCookie('jwtCookie');
  clearTimeout(cookieTimer);
  console.log('Cookie deleted due a logout');
  res.render('logout', {});
});

app.post(
  '/login',
  // We add a middleware "on the fly" to authenticate
  passport.authenticate('radius', {
    session: false,
    failureRedirect: '/bad-credentials',
  }), // If fail, redirect to bad credentials view
  (req, res) => {
    createCookieWithJWT(req, res);
  }
);

app.get(
  '/login/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

app.get(
  '/login/oauth/access_token',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/login',
  }),
  (req, res) => {
    createCookieWithJWT(req, res);
  }
);

const createCookieWithJWT = (req, res) => {
  const payload = {
    iss: 'localhost:3000', // Issuer, usually the domain name
    sub: req.user.username, // User, we can get it from the request
    aud: 'localhost:3000', // Audience, may change (i.e. /part1, /part2...)
    exp: Math.floor(Date.now() / 1000) + 604800, // Expiration, when we want the token to expire (in this case 1 week from now)
    role: 'user', // Private JWT field
  };
  const token = jwt.sign(payload, jwtSecret);

  var cookie = req.cookies.jwtCookie;
  if (cookie === undefined) {
    res.cookie('jwtCookie', token, {
      maxAge: cookieExpire,
      httpOnly: true,
    });
    console.log('Cookie created');
    cookieTimer = setTimeout(
      () => console.log('Cookie has expired'),
      cookieExpire
    );
  } else {
    console.log('Cookie already exists');
  }
  res.redirect('/');
};

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
