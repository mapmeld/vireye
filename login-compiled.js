'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const passport = require('koa-passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const crypto = require('crypto');

const User = require('./models/user.js');
const printError = require('./common-compiled.js').error;

const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

const userNode = graphdb.defineNode({
  label: ['User'],
  schemas: {
    'saveWithName': {
      'name': graphdb.Joi.string().required(),
      'mongoid': graphdb.Joi.string().required()
    }
  }
});

var middleware = function middleware(ctx, next) {
  if (process.env.GOOGLE_CONSUMER_KEY && process.env.GOOGLE_CLIENT_SECRET) {
    return passport.authenticate('google', { scope: ['email'], failureRedirect: '/login' });
  } else {
    return passport.authenticate('local', {});
  }
};

var confirmLogin = function confirmLogin(next) {
  // this runs once, after the callback from Google
  passport.authenticate('google', { scope: ['email'], failureRedirect: '/login' })(next);
};

var setupAuth = function setupAuth(app, router) {
  let postRegister = (() => {
    var _ref = _asyncToGenerator(function* (ctx, next) {
      var username = ctx.request.body.username.trim().toLowerCase();
      var pwd = ctx.request.body.password;
      var users = yield User.find({ name: username }).exec();
      if (users.length) {
        return printError(ctx, 'user with that name already exists');
      }

      var len = 128;
      var iterations = 12000;
      var salt, hash;
      salt = yield crypto.randomBytes(len);
      salt = salt.toString('base64');
      hash = crypto.pbkdf2Sync(pwd, salt, iterations, len, 'sha256');
      hash = hash.toString('base64');

      var u = new User({
        name: username,
        localpass: hash,
        salt: salt,
        test: false,
        republish: false
      });
      u = yield u.save();

      var graphu = new userNode({
        name: username,
        mongoid: u._id
      });
      graphu = yield grapy.save({ operation: 'saveWithName' });

      ctx.redirect('/login?user=' + username);
    });

    return function postRegister(_x, _x2) {
      return _ref.apply(this, arguments);
    };
  })();

  app.use(passport.initialize());
  app.use(passport.session());

  router.post('/login', passport.authenticate('local', {
    successRedirect: '/profile?justLoggedIn=true',
    failureRedirect: '/login'
  })).get('/login', getLogin).post('/register', postRegister).get('/register', getRegister).get('/bye', bye).get('/logout', logout);

  if (process.env.GOOGLE_CONSUMER_KEY && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CONSUMER_KEY,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://vireye.herokuapp.com/profile?justLoggedIn=true',
      passReqToCallback: true
    }, function (request, accessToken, refreshToken, profile, done) {
      User.findOne({ googid: profile.id }).exec(function (err, user) {
        if (!user) {
          user = new User({
            googid: profile.id,
            name: profile.email,
            test: false,
            republish: false
          });
          user.save(function (err) {
            return done(err, user);
          });
        } else {
          return done(err, user);
        }
      });
    }));
  }

  passport.use(new LocalStrategy(function (username, password, cb) {
    User.findOne({ name: username.toLowerCase() }).exec(function (err, user) {
      if (!user) {
        return cb(null, false);
      }
      var len = 128;
      var iterations = 12000;
      var hash = crypto.pbkdf2Sync(password, user.salt, iterations, len, 'sha256');
      hash = hash.toString('base64');
      if (hash !== user.localpass) {
        return cb(null, false);
      }
      return cb(null, user);
    });
  }));

  passport.serializeUser(function (user, done) {
    done(null, user._id);
  });

  passport.deserializeUser(function (id, done) {
    User.findById(id, done);
  });

  function getLogin(ctx, next) {
    var requser = ctx.state.user;
    ctx.render('login', {
      forUser: requser,
      csrfToken: ctx.csrf,
      newuser: ctx.query.user,
      googly: process.env.GOOGLE_CONSUMER_KEY && process.env.GOOGLE_CLIENT_SECRET
    });
  }

  function getRegister(ctx, next) {
    var requser = ctx.state.user;
    if (requser) {
      return ctx.redirect('/profile');
    }
    ctx.render('register', {
      csrfToken: ctx.csrf
    });
  }

  function bye(ctx, next) {
    var requser = ctx.state.user;
    if (requser) {
      ctx.redirect('/logout');
    } else {
      ctx.render('bye');
    }
  }

  function logout(ctx, next) {
    ctx.logout();
    ctx.redirect('/bye');
  }

  //app.get('/auth/google', passport.authenticate('google', { scope: ['email'], failureRedirect: '/login' }));
};

module.exports = {
  middleware: middleware,
  setupAuth: setupAuth,
  confirmLogin: confirmLogin
};
