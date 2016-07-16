'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const middleware = require('./login-compiled.js').middleware;
const commonResponses = require('./common-compiled');
const Image = require('./models/image.js');

module.exports = function (app, router) {

  var upload;
  if (process.env.S3_BUCKET && process.env.AWS_SECRET_KEY && process.env.AWS_ACCESS_KEY) {
    /*
        const multer = require('multer');
        const ms3 = require('multer-s3');
    
        upload = multer({
          storage: ms3({
            dirname: 'maps',
            bucket: process.env.S3_BUCKET,
            secretAccessKey: process.env.AWS_SECRET_KEY,
            accessKeyId: process.env.AWS_ACCESS_KEY,
            region: 'ap-southeast-1',
            filename: function (req, file, cb) {
              cb(null, Date.now());
            }
          })
        });
    
        app.post('/upload', upload.single('upload'), function (req, res) {
          res.render('index');
        });
    */
  } else if (process.env.CLOUDINARY_URL || process.env.CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const cloudinary = require('cloudinary');
      const asyncBusboy = require('async-busboy');

      if (!process.env.CLOUDINARY_URL) {
        cloudinary.config({
          cloud_name: process.env.CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
      }

      router.post('/upload', (() => {
        var _ref = _asyncToGenerator(function* (ctx, next) {
          var requser = ctx.req.user || ctx.request.user;
          if (!requser) {
            return ctx.redirect('/login');
          }

          var _ref2 = yield asyncBusboy(ctx.req);

          var files = _ref2.files;
          var fields = _ref2.fields;

          if (files.length !== 1) {
            return ctx.redirect('/profile');
          }
          var file = files[0];
          yield cloudinary.uploader.upload(file.path, (() => {
            var _ref3 = _asyncToGenerator(function* (result) {
              var i = new Image({
                test: false,
                user_id: requser.name,
                src: result.public_id,
                published: false,
                picked: false,
                hidden: false
              });
              i = yield i.save();
              return i;
            });

            return function (_x3) {
              return _ref3.apply(this, arguments);
            };
          })(), { public_id: Math.random() + "_" + new Date() * 1 });
          ctx.redirect('/profile');
        });

        return function (_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })());
    }
};

