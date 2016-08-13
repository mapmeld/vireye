const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

module.exports = graphdb.defineNode({
  label: ['User']
  /*,
  schemas: {
    'saveWithName': {
      'name': graphdb.Joi.string().required(),
      'mongoid': graphdb.Joi.string().required()
    }
  }*/
});
