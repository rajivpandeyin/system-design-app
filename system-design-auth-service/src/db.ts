import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set in env');
}

export const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: false,
});

export async function connectDatabase() {
  await sequelize.authenticate();
}

export async function syncDatabase() {
  await sequelize.sync({ alter: true });
}
