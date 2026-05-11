const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function fixProviderVerificationStatus() {
  try {
    console.log('🔧 Fixing Provider Verification Status...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all providers with corrupted status
    const providers = await mongoose.connection.db.collection('providerprofiles').find({}).toArray();
    
    console.log('📊 CURRENT PROVIDER STATUSES:');
    providers.forEach((provider, index) => {
      console.log(`${index + 1}. Business: ${provider.businessInfo?.businessName || 'No name'}`);
      console.log(`   Status: ${JSON.stringify(provider.verificationStatus)}`);
      console.log(`   Type: ${typeof provider.verificationStatus}\n`);
    });
    
    // Fix all providers - set to 'pending' status
    const updateResult = await mongoose.connection.db.collection('providerprofiles').updateMany(
      {},
      { 
        $set: { 
          verificationStatus: 'pending',
          'verificationDetails.submittedAt': new Date(),
          'verificationDetails.status': 'pending',
          'verificationDetails.notes': 'Automatically set to pending for verification'
        } 
      }
    );
    
    console.log(`✅ FIXED: Updated ${updateResult.modifiedCount} providers\n`);
    
    // Verify the fix
    console.log('🔍 VERIFICATION AFTER FIX:');
    const fixedProviders = await mongoose.connection.db.collection('providerprofiles').find({}).toArray();
    
    fixedProviders.forEach((provider, index) => {
      console.log(`${index + 1}. Business: ${provider.businessInfo?.businessName || 'No name'}`);
      console.log(`   Status: ${provider.verificationStatus}`);
      console.log(`   Details: ${JSON.stringify(provider.verificationDetails || {})}\n`);
    });
    
    console.log('🧪 PROVIDER VERIFICATION STATUS FIX COMPLETE');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixProviderVerificationStatus();