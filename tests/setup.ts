import dotenv from 'dotenv';
import { seedDefaultData } from '../src/database/seed';

dotenv.config();

jest.setTimeout(120000);

beforeAll(async () => {
  await seedDefaultData();
});
