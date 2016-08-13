const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

module.exports = {
  follow: graphdb.defineRelationship({
    type: 'FOLLOWS'
  }),
  blocked: graphdb.defineRelationship({
    type: 'BLOCKED'
  }),
};
