import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model';
import database from '../config/database';
import bcrypt from 'bcryptjs';

async function updateAdminPassword() {
  await database.connect();

  const newPassword = 'ChangeThis123!';
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const result = await User.updateOne(
    { email: 'admin@homeservice.com' },
    {
      $set: { password: hashedPassword, loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    }
  );

  console.log(`Updated ${result.modifiedCount} admin user(s)`);
  console.log('Email: admin@homeservice.com');
  console.log('Password: ChangeThis123!');

  process.exit(0);
}

updateAdminPassword().catch(console.error);
