/**
 * Script to verify all providers and update their verification status
 * Run: node scripts/verify-all-providers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function verifyAllProviders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Provider Verification Model
    const ProviderVerificationSchema = new mongoose.Schema({
      providerId: { type: mongoose.Schema.Types.ObjectId, required: true },
      status: { type: String, enum: ['pending', 'in_progress', 'verified', 'rejected', 'suspended'], default: 'pending' },
      kycScore: { type: Number, default: 0 },
      kycLevel: { type: String, enum: ['basic', 'standard', 'enhanced'], default: 'basic' },
      documents: [{
        type: { type: String },
        status: { type: String },
        verified: { type: Boolean, default: false }
      }],
      verifiedAt: Date,
      verifiedBy: mongoose.Schema.Types.ObjectId
    }, { timestamps: true });

    const ProviderVerification = mongoose.models.ProviderVerification || mongoose.model('ProviderVerification', ProviderVerificationSchema);

    // Provider Profile Model - with verificationStatus field
    const ProviderProfileSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      isActive: { type: Boolean, default: true },
      isProfileComplete: { type: Boolean, default: false },
      verificationStatus: {
        overall: { type: String, enum: ['pending', 'approved', 'verified', 'rejected'], default: 'pending' },
        kycStatus: { type: String },
        documentStatus: { type: String },
        backgroundCheckStatus: { type: String }
      }
    }, { timestamps: true });

    const ProviderProfile = mongoose.models.ProviderProfile || mongoose.model('ProviderProfile', ProviderProfileSchema);

    // Get all provider profiles
    const profiles = await ProviderProfile.find({});
    console.log(`Found ${profiles.length} provider profiles`);

    let verifiedCount = 0;
    let createdCount = 0;
    let profileUpdatedCount = 0;

    for (const profile of profiles) {
      // Update ProviderProfile verificationStatus.overall
      if (!profile.verificationStatus) {
        profile.verificationStatus = {};
      }
      if (profile.verificationStatus.overall !== 'verified' && profile.verificationStatus.overall !== 'approved') {
        profile.verificationStatus.overall = 'verified';
        await profile.save();
        profileUpdatedCount++;
        console.log(`Updated ProviderProfile verificationStatus for: ${profile.userId}`);
      }

      // Check if verification record exists
      let verification = await ProviderVerification.findOne({ providerId: profile.userId });

      if (verification) {
        // Update existing verification to verified
        if (verification.status !== 'verified') {
          verification.status = 'verified';
          verification.kycScore = 100;
          verification.kycLevel = 'enhanced';
          verification.documents = verification.documents.map(doc => ({
            ...doc,
            verified: true,
            verifiedAt: new Date()
          }));
          verification.verifiedAt = new Date();
          await verification.save();
          verifiedCount++;
          console.log(`Updated verification for provider: ${profile.userId}`);
        }
      } else {
        // Create new verification record as verified
        verification = new ProviderVerification({
          providerId: profile.userId,
          status: 'verified',
          kycScore: 100,
          kycLevel: 'enhanced',
          documents: [
            { type: 'id_document', status: 'verified', verified: true, verifiedAt: new Date() },
            { type: 'business_license', status: 'verified', verified: true, verifiedAt: new Date() }
          ],
          verifiedAt: new Date()
        });
        await verification.save();
        createdCount++;
        console.log(`Created verification for provider: ${profile.userId}`);
      }

      // Also ensure provider profile is active and complete
      if (!profile.isActive) {
        profile.isActive = true;
        await profile.save();
        console.log(`Activated provider profile: ${profile.userId}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total provider profiles: ${profiles.length}`);
    console.log(`Updated ProviderProfile verificationStatus: ${profileUpdatedCount}`);
    console.log(`Updated ProviderVerification records: ${verifiedCount}`);
    console.log(`Created ProviderVerification records: ${createdCount}`);
    console.log('All providers are now verified!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

verifyAllProviders();
