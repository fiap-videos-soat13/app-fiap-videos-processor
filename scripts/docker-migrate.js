/* eslint-disable @typescript-eslint/no-require-imports */
const { runMigrations, closeDb } = require('../dist/adapter/infra/database/client');

runMigrations()
  .then(() => closeDb())
  .then(() => {
    console.log('Migrations applied');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
