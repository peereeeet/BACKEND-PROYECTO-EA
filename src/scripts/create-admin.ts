/* eslint-disable no-console */
import mongoose from 'mongoose';
import Usuario from '../models/usuario';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb://127.0.0.1:27017/BBDD';

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
      password, // Password hashing happens in pre-save hook usually, or I should check if I need to hash it manually.
      // Checking existing code: Usuario model likely has pre-save hash or the service handles it.
      // In authController "newUser = new Usuario({...})" passes plain password.
      // Let's verify Usuario model to be sure, but assuming pre-save based on standard practices and authController.
      // Wait, in authController register: "const newUser = new Usuario({...})" then "await newUser.save()".
      // If `Usuario` model has logic to hash, good.
      // Let's check `src/models/usuario.ts` if I can, but I saw `user.comparePassword` in controller.
      // I'll take a quick look at `src/models/usuario.ts` before running this to ensure password handling is correct.
      // For now, I will write this assuming standard behavior, but I'll add a check step.
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
