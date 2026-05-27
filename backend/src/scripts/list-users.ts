import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model';
import database from '../config/database';

async function listUsers() {
  await database.connect();

  const users = await User.find({}).select('email role accountStatus').limit(20);
  console.log('Total users:', users.length);
  users.forEach(u => {
    console.log(`- ${u.email} | role: ${u.role} | status: ${u.accountStatus}`);
  });

  process.exit(0);
}

listUsers().catch(console.error);
