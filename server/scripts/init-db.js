// init-db: creates the SQLite file and capsules table, safe to re-run
const config = require('../config');
const { initDb } = require('../db');

initDb();
console.log(`[init-db] schema ready at ${config.dbFile}`);
