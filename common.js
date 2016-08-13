const cloudinary = require('cloudinary');
const ago = require('time-ago')().ago;
const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

// respond with error
function error(ctx, err) {
  ctx.body = { status: 'error', error: err };
}

// respond that the resource does not exist
function noExist(ctx) {
  ctx.body = { status: 'missing', error: 'can\'t find that user or image' };
}

// break an image into multiple sizes
function responsiveImg(img, isBig) {
  var baseSize = 300;
  var geturl = cloudinary.url;
  if (!process.env.CLOUDINARY_URL && !process.env.CLOUD_NAME && !process.env.CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_SECRET) {
    // test instance
    geturl = function(url) {
      return url;
    }
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
      mini: geturl(img.src, { format: "jpg", width: baseSize * 2/3, height: baseSize * 2/3, crop: "fill" }).replace('http:', ''),
      main: geturl(img.src, { format: "jpg", width: baseSize, height: baseSize, crop: "fill" }).replace('http:', ''),
      retina: geturl(img.src, { format: "jpg", width: baseSize * 2, height: baseSize * 2, crop: "fill" }).replace('http:', '')
    }
  };
  return out;
}

// multiple outcomes for follow-check
async function following(fromUser, toUser, res) {
  if (fromUser && toUser) {
    var f = await graphdb.query('MATCH (u:User { name: "' + fromUser.name + '" }) -[r:FOLLOWS]-> (v:User { name: "' + toUser.name + '" }) RETURN u, r, v').getResults();
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
