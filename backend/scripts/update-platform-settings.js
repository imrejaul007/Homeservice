/**
 * Script to update platform settings in MongoDB
 * Run: node scripts/update-platform-settings.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function updateSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // PlatformSettings model
    const SettingsSchema = new mongoose.Schema({
      key: { type: String, required: true, unique: true },
      value: mongoose.Schema.Types.Mixed,
      category: { type: String, default: 'general' },
      updatedAt: { type: Date, default: Date.now }
    }, { timestamps: true });

    const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

    // Update maxDailyBookings
    const result = await Settings.findOneAndUpdate(
      { key: 'maxDailyBookings' },
      {
        $set: {
          value: 100,
          category: 'booking',
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    console.log('Updated maxDailyBookings to 100');

    // Also try to update as general setting
    await Settings.findOneAndUpdate(
      { key: 'booking.maxDailyBookings' },
      {
        $set: {
          value: 100,
          category: 'booking',
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    console.log('Updated booking.maxDailyBookings to 100');

    // Check all settings with booking related keys
    const allSettings = await Settings.find({ key: { $regex: /booking|daily|max/i } });
    console.log('\nBooking-related settings found:');
    allSettings.forEach(s => {
      console.log(`  ${s.key}: ${JSON.stringify(s.value)}`);
    });

    console.log('\nDone! Restart the backend server for changes to take effect.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateSettings();
