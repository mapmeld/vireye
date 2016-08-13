'use strict';

let home = (() => {
  var _ref = _asyncToGenerator(function* (ctx) {
    ctx.render('index');
  });

  return function home(_x) {
    return _ref.apply(this, arguments);
  };
})();

// your own profile


let myProfile = (() => {
  var _ref2 = _asyncToGenerator(function* (ctx, next) {
    var requser = ctx.state.user;
    if (!requser.name || requser.name.indexOf('@') > -1) {
      return ctx.redirect('/changename');
    }
    if (!requser.republish && requser.posted && new Date() - requser.posted > 6 * 30 * 24 * 60 * 60 * 1000) {
      // >180 days ago!
      var user = yield User.findById(requser._id).exec();
      user.republish = true;
      requser.republish = true;
      user = yield user.save();
      return ctx.redirect('/profile');
    }
    var allimages = yield Image.find({ user_id: requser.name }).select('_id src picked published hidden').exec();
    var images = [];
    var saved = [];
    allimages.map(function (img) {
      if (img.published) {
        images.push(responsiveImg(img));
      } else {
        saved.push(responsiveImg(img));
      }
    });
    if (requser.posted && !requser.republish) {
      // once user posts, end photo-picking
      saved = [];
    }
    saved.sort(function (a, b) {
      // show picked photos first
      if (a.picked && !b.picked) {
        return -1;
      } else if (a.picked !== b.picked) {
        return 1;
      }
      return 0;
    });

    ctx.render('profile', {
      profile: requser,
      images: images,
      saved: saved,
      posted: cleanDate(requser.posted),
      forUser: requser,
      csrfToken: ctx.csrf
    });
  });

  return function myProfile(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
})();

let postChangeName = (() => {
  var _ref3 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser.name && requser.name.indexOf('@') > -1) {
      return ctx.redirect('/profile');
    }
    var newname = ctx.request.body.newname.toLowerCase();
    if (!newname || newname.indexOf('@') > -1) {
      return ctx.redirect('/changename');
    }
    var users = yield User.find({ name: newname }).exec();
    if (users.length) {
      return printError(ctx, 'someone already has that username');
    }
    var user = yield User.findById(requser._id).exec();
    requser.name = newname;
    user.name = newname;
    user = yield user.save();
    ctx.redirect('/profile');
  });

  return function postChangeName(_x4) {
    return _ref3.apply(this, arguments);
  };
})();

// friends' photos


let feed = (() => {
  var _ref4 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser) {
      var follows = yield Follow.find({ start_user_id: requser.name, blocked: false }).exec();
      var permDate = new Date(new Date() - 60 * 60 * 1000);
      var publishers = yield User.find({ published: { $ne: null, $lt: permDate } }).sort('-published').limit(6).exec();

      ctx.render('feed', {
        follows: follows,
        forUser: requser,
        publishers: publishers
      });
    } else {
      ctx.redirect('/');
    }
  });

  return function feed(_x5) {
    return _ref4.apply(this, arguments);
  };
})();

// someone else's profile


let theirProfile = (() => {
  var _ref5 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser && ctx.params.username.toLowerCase() === requser.name) {
      // redirect to your own profile
      return ctx.redirect('/profile');
    }
    if (ctx.params.username.indexOf('@') > -1) {
      return printNoExist(ctx);
    }
    var user = yield User.findOne({ name: ctx.params.username.toLowerCase() }, '_id name posted').exec();
    if (!user) {
      return printNoExist(ctx);
    }

    var follows = yield following(requser, user, ctx);
    var images = yield Image.find({ published: true, hidden: false, user_id: user.name }).select('_id src').exec();
    images = images.map(responsiveImg);
    ctx.render('profile', {
      profile: user,
      images: images,
      saved: [],
      posted: cleanDate(user.posted),
      forUser: requser || null,
      following: follows,
      csrfToken: ctx.csrf
    });
  });

  return function theirProfile(_x6) {
    return _ref5.apply(this, arguments);
  };
})();

// view a published image


let photo = (() => {
  var _ref6 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    var user = yield User.findOne({ name: ctx.params.username.toLowerCase() }).exec();
    if (!user || !user.posted) {
      return printNoExist(ctx);
    }

    var userFollowsSource = yield following(requser, user, ctx);
    var sourceFollowsUser = yield following(user, requser, ctx);
    var image = yield Image.findOne({ _id: ctx.params.photoid }, '_id src comments caption hidden published').exec();
    if (!image) {
      return printNoExist(ctx);
    }
    if (!requser || requser.name !== user.name) {
      if (image.hidden || !image.published) {
        return printNoExist(ctx);
      }
    }
    var comments = image.comments || [];
    image = responsiveImg(image, true);
    ctx.render('image', {
      profile: user,
      image: image,
      comments: comments,
      posted: cleanDate(user.posted),
      forUser: requser || null,
      csrfToken: ctx.csrf,
      following: userFollowsSource,
      canComment: requser && (requser.name === user.name || userFollowsSource || sourceFollowsUser)
    });
  });

  return function photo(_x7) {
    return _ref6.apply(this, arguments);
  };
})();

// follow another user


let follow = (() => {
  var _ref7 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser.name === ctx.params.end_user) {
      return printError('you can\'t follow yourself', ctx);
    }
    if (ctx.params.end_user.indexOf('@') > -1) {
      return printNoExist(ctx);
    }
    var existing = yield Follow.findOne({ start_user_id: requser.name, end_user_id: ctx.params.end_user }).exec();
    if (ctx.request.body.makeFollow === 'true') {
      if (existing) {
        // follow already exists
        return printError('you already follow', ctx);
      }

      var f = new Follow({
        start_user_id: requser.name,
        end_user_id: ctx.params.end_user,
        blocked: false,
        test: false
      });
      f = yield f.save();
      ctx.body = { status: 'success' };
    } else {
      if (!existing) {
        return printError('you already don\'t follow', ctx);
      }
      yield Follow.remove({ start_user_id: requser.name, end_user_id: ctx.params.end_user, blocked: false }).exec();
      ctx.body = { status: 'success' };
    }
  });

  return function follow(_x8) {
    return _ref7.apply(this, arguments);
  };
})();

// block another user


let block = (() => {
  var _ref8 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser.name === ctx.request.body.banuser) {
      return printError('you can\'t block yourself', ctx);
    }
    // remove a follow in either direction
    yield Follow.remove({ start_user_id: requser.name, end_user_id: ctx.request.body.banuser, blocked: false }).exec();
    yield Follow.remove({ start_user_id: ctx.request.body.banuser, end_user_id: requser.name, blocked: false }).exec();

    // create a new block
    var f = new Follow({
      start_user_id: ctx.request.body.banuser,
      end_user_id: requser.name,
      blocked: true,
      test: false
    });
    f = yield f.save();

    var img = yield Image.findById(ctx.request.body.id).exec();
    if (img) {
      if (!img.comments) {
        img.comments = [];
      }
      for (var c = img.comments.length - 1; c >= 0; c--) {
        if (img.comments[c].user === ctx.request.body.banuser) {
          img.comments.splice(c, 1);
        }
      }
      img = yield img.save();
      ctx.render('block', { exist: true });
    } else {
      ctx.render('block', { exist: false });
    }
  });

  return function block(_x9) {
    return _ref8.apply(this, arguments);
  };
})();

// pick an image


let pick = (() => {
  var _ref9 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (requser.posted) {
      // would immediately publish, and we don't allow that
      return printError('you already posted', ctx);
    }
    var imgcount = yield Image.update({ _id: ctx.request.body.id, user_id: requser.name }, { picked: ctx.request.body.makePick === 'true' }).exec();
    if (!imgcount) {
      return printError('that isn\'t your image', ctx);
    }
    ctx.body = { status: 'success' };
  });

  return function pick(_x10) {
    return _ref9.apply(this, arguments);
  };
})();

let postHide = (() => {
  var _ref10 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    var imgcount = yield Image.update({ _id: ctx.request.body.id, user_id: requser.name }, { hidden: ctx.request.body.makeHide === 'true' }).exec();
    if (!imgcount) {
      return printError('that isn\'t your image', ctx);
    }
    if (ctx.request.body.makeHide === 'true') {
      ctx.redirect('/hide');
    } else {
      ctx.redirect('/' + requser.name + '/photo/' + ctx.request.body.id);
    }
  });

  return function postHide(_x11) {
    return _ref10.apply(this, arguments);
  };
})();

let makedelete = (() => {
  var _ref11 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    yield Image.remove({ _id: ctx.request.body.id, user_id: requser.name }).exec();
    ctx.redirect('/hide');
  });

  return function makedelete(_x12) {
    return _ref11.apply(this, arguments);
  };
})();

// publish picked images


let publish = (() => {
  var _ref12 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    if (ctx.request.body.makePublish === 'true') {
      // publish
      if (requser.posted) {
        return printError('you already posted', ctx);
      }
      var count = yield Image.count({ user_id: requser.name, picked: true, hidden: false }).exec();
      if (!count) {
        return printError('you have no picked images', ctx);
      }
      if (count > 8) {
        return printError('you have too many picked images', ctx);
      }
      yield User.update({ name: requser.name }, { posted: new Date() }).exec();
      requser.posted = new Date();
      yield Image.update({ user_id: requser.name, picked: true, hidden: false }, { published: true }, { multi: true });
      ctx.body = { status: 'success' };
    } else {
      // un-publish within 60 minutes
      if (!requser.posted) {
        return printError('you have not posted', ctx);
      }
      if (new Date() - requser.posted > 60 * 60 * 1000) {
        return printError('too much time has passed. you can remove images but not re-publish', ctx);
      }
      yield User.update({ name: requser.name }, { posted: null }).exec();
      requser.posted = null;
      yield Image.update({ user_id: requser.name }, { published: false }, { multi: true });
      ctx.body = { status: 'success' };
    }
  });

  return function publish(_x13) {
    return _ref12.apply(this, arguments);
  };
})();

// comment on photo


let comment = (() => {
  var _ref13 = _asyncToGenerator(function* (ctx) {
    var requser = ctx.state.user;
    var img = yield Image.findById(ctx.request.body.id).exec();
    if (!img || img.hidden || !img.published) {
      return printNoExist(err, ctx);
    }
    var user = yield User.findOne({ name: img.user_id }).exec();
    if (!user) {
      return printNoExist(err, ctx);
    }
    var userFollowsSource = yield following(requser, user, ctx);
    var sourceFollowsUser = yield following(user, requser, ctx);
    if (requser.name === user.name || userFollowsSource || sourceFollowsUser) {
      if (!img.comments) {
        img.comments = [];
      }
      img.comments.push({ user: requser.name, text: ctx.request.body.text.trim() });
      img = yield img.save();
      ctx.redirect('/' + user.name + '/photo/' + ctx.request.body.id);
    } else {
      return printError('you can\'t comment', ctx);
    }
  });

  return function comment(_x14) {
    return _ref13.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

/* @flow */

const path = require('path');

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const convert = require('koa-convert');
const session = require('koa-generic-session');
const MongooseStore = require('koa-session-mongoose');
const jade = require('koa-jade-render');
const logger = require('koa-logger');
const router = require('koa-router')();
const compression = require('koa-compress');
const mongoose = require('mongoose');
const csrf = require('koa-csrf');
const kstatic = require('koa-static');

const User = require('./models/user.js');
const Image = require('./models/image.js');

var setupAuth = require('./login-compiled.js').setupAuth;
var middleware = require('./login-compiled.js').middleware;
var confirmLogin = require('./login-compiled.js').confirmLogin;
var setupUploads = require('./uploads-compiled.js');

var printError = require('./common-compiled.js').error;
var printNoExist = require('./common-compiled.js').noExist;
var responsiveImg = require('./common-compiled.js').responsiveImg;
var following = require('./common-compiled.js').following;
var cleanDate = require('./common-compiled.js').cleanDate;

console.log('Connecting to MongoDB (required)');
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGOLAB_URI || process.env.MONGODB_URI || 'localhost');
mongoose.connection.on("error", function (err) {
  console.log(err);
});

var app = new Koa();
app.use(jade(path.join(__dirname, 'views')));

app.use(convert(kstatic(__dirname + '/static')));
app.use(bodyParser());
app.use(compression());
//app.use(cookieParser());

app.keys = ['wkpow3jocijoid3jioj3', 'cekopjpdjjo3jcjio3jc'];
app.use(convert(session({
  store: new MongooseStore()
})));

app.use(logger());
csrf(app);
app.use(convert(csrf.middleware));

// routes

function authCheck(ctx, next) {
  if (ctx.isAuthenticated()) {
    return next();
  } else {
    ctx.redirect('/login');
  }
}

router.get('/', home).get('/profile', authCheck, myProfile).get('/:username/photo/:photoid', photo).get('/changename', authCheck, changeName).post('/changename', authCheck, postChangeName).get('/feed', authCheck, feed).get('/profile/:username', theirProfile).post('/comment', authCheck, comment).post('/publish', authCheck, publish).post('/delete', authCheck, makedelete).post('/block', authCheck, block).post('/hide', authCheck, postHide).get('/hide', authCheck, getHide).post('/follow/:end_user', authCheck, follow).post('/pick', authCheck, pick);

setupAuth(app, router);
setupUploads(app, router);

function changeName(ctx) {
  var requser = ctx.state.user;
  if (requser.name && requser.name.indexOf('@') === -1) {
    return ctx.redirect('/profile');
  }
  ctx.render('changename', {
    forUser: requser,
    csrfToken: ctx.csrf
  });
}

function getHide(ctx) {
  ctx.render('hide');
}

app.use(router.routes()).use(router.allowedMethods());

app.listen(process.env.PORT || 8080);

module.exports = app;
