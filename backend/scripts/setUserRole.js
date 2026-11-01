require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !['farmer', 'admin'].includes(role)) {
    throw new Error('Usage: node scripts/setUserRole.js <email> <farmer|admin>');
  }
  await connectDB();
  const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { role },
    { new: true, runValidators: true },
  ).select('name email role');
  if (!user) throw new Error(`No account found for ${email}. Register that account first.`);
  console.log(`Updated ${user.email}: role=${user.role}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
