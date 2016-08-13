const graphdb = require('neo4j-simple')(process.env['GRAPHENEDB_URL'], {
  idName: 'id'
});

module.exports = graphdb.defineRelationship({
  type: 'ARTIST_OF'
});
