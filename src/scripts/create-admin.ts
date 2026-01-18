/* eslint-disable no-console */
import mongoose from 'mongoose';
import Usuario from '../models/usuario';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/BBDD';

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const username = 'admin_backoffice';
    const email = 'admin_backoffice@example.com';
    const password = 'admin_backoffice';

    const existingUser = await Usuario.findOne({ username });
    if (existingUser) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const adminUser = new Usuario({
      username,
      gmail: email,
      password,
      birthday: new Date('1990-01-01'),
      rol: 'admin',
      accountStatus: 'ACTIVE',
      interests: [],
    });

    await adminUser.save();
    console.log(`Admin user '${username}' created successfully.`);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

createAdmin();
