'use strict';

var dbm;
var type;
var seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db, callback) {
  await db.runSql(`
    CREATE TABLE users (
      id int(11) NOT NULL AUTO_INCREMENT COMMENT 'Primary Key',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      PRIMARY KEY (id)
      -- TODO: unique email constraint, createdAt, updatedAt
    )
  `);
};

exports.down = async function(db, callback) {
  await db.runSql(`
    DROP TABLE users
  `, callback);
};

exports._meta = {
  "version": 1
};
