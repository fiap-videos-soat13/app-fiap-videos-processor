import { setupTestDatabase, clearTables, closeTestDatabase } from './database';

beforeAll(async () => {
  await setupTestDatabase();
}, 30000);

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await closeTestDatabase();
});
