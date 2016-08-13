'use strict';

// multiple outcomes for follow-check

let following = (() => {
  var _ref = _asyncToGenerator(function* (fromUser, toUser, res) {
    if (fromUser && toUser) {
      var f = yield graphdb.query('MATCH (u:User { name: "' + fromUser.name + '" }) -[r:FOLLOWS]-> (v:User { name: "' + toUser.name + '" }) RETURN u, r, v').getResults();
      console.log(f);
      if (f.length) {
        return true;
      } else {
        return false;
      }
    } else {
      // not logged in, continue
      return false;
    }
  });

  return function following(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const cloudinary = require('cloudinary');
const ago = require('time-ago')().ago;
const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

// respond with error
function error(err, res) {
  res.body = { status: 'error', error: err };
}

// respond that the resource does not exist
function noExist(res) {
  res.body = { status: 'missing', error: 'can\'t find that user or image' };
}

// break an image into multiple sizes
function responsiveImg(img, isBig) {
  var baseSize = 300;
  var geturl = cloudinary.url;
  if (!process.env.CLOUDINARY_URL && !process.env.CLOUD_NAME && !process.env.CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_SECRET) {
    // test instance
    geturl = function geturl(url) {
      return url;
    };
  }
  if (isBig) {
    baseSize *= 2;
  }
  var out = {
    _id: img._id,
    picked: img.picked,
    published: img.published,
    hidden: img.hidden,
    src: {
      mini: geturl(img.src, { format: "jpg", width: baseSize * 2 / 3, height: baseSize * 2 / 3, crop: "fill" }).replace('http:', ''),
      main: geturl(img.src, { format: "jpg", width: baseSize, height: baseSize, crop: "fill" }).replace('http:', ''),
      retina: geturl(img.src, { format: "jpg", width: baseSize * 2, height: baseSize * 2, crop: "fill" }).replace('http:', '')
    }
  };
  return out;
}

function cleanDate(d) {
  if (d) {
    return ago(d);
  }
  return d;
}

module.exports = {
  error: error,
  noExist: noExist,
  responsiveImg: responsiveImg,
  following: following,
  cleanDate: cleanDate
};
