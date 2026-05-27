import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model';
import database from '../config/database';

async function findAdmins() {
  await database.connect();

  const admins = await User.find({ role: 'admin' }).select('email firstName lastName accountStatus').limit(10);
  console.log('Admin users found:', admins.length);
  admins.forEach(a => {
    console.log(`- ${a.email} | ${a.firstName} ${a.lastName} | status: ${a.accountStatus}`);
  });

  process.exit(0);
}

findAdmins().catch(console.error);
