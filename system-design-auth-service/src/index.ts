import app from './app.js';
import dotenv from 'dotenv';
import { connectDatabase, syncDatabase } from './db.js';

dotenv.config();

const port = process.env.PORT || 4004;

async function startServer() {
  await connectDatabase();
  await syncDatabase();
  app.listen(port, () => {
    console.log(`Auth service listening on ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start auth service:', error);
  process.exit(1);
});
