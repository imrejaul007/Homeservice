const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models (using require for .ts files in test)
async function testAdminVerification() {
  try {
    console.log('🔍 Testing Admin Provider Verification System...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Test 1: Check provider verification statuses
    console.log('📊 CHECKING PROVIDER VERIFICATION STATUSES:');
    const providers = await mongoose.connection.db.collection('providerprofiles').find({}).toArray();
    
    if (providers.length === 0) {
      console.log('❌ No providers found in database');
    } else {
      providers.forEach((provider, index) => {
        console.log(`${index + 1}. Business: ${provider.businessInfo?.businessName || 'No name'}`);
        console.log(`   Status: ${provider.verificationStatus || 'undefined'}`);
        console.log(`   Documents: ${provider.documents?.length || 0} files`);
        console.log(`   Created: ${provider.createdAt}\n`);
      });
    }
    
    // Test 2: Check admin user exists
    console.log('👑 CHECKING ADMIN USER:');
    const adminUsers = await mongoose.connection.db.collection('users').find({ role: 'admin' }).toArray();
    
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found');
    } else {
      adminUsers.forEach((admin, index) => {
        console.log(`${index + 1}. Email: ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Status: ${admin.accountStatus || 'undefined'}`);
        console.log(`   Created: ${admin.createdAt}\n`);
      });
    }
    
    // Test 3: Check if admin verification endpoints exist
    console.log('🔍 CHECKING ADMIN VERIFICATION API ENDPOINTS:');
    const fs = require('fs');
    const adminRoutes = path.join(__dirname, '../routes');
    
    try {
      const files = fs.readdirSync(adminRoutes);
      const adminFile = files.find(f => f.includes('admin'));
      console.log('Admin routes file:', adminFile || 'NOT FOUND');
      
      if (adminFile) {
        const adminRoutesContent = fs.readFileSync(path.join(adminRoutes, adminFile), 'utf8');
        const hasVerifyEndpoint = adminRoutesContent.includes('verify') || adminRoutesContent.includes('approve');
        console.log('Has verification endpoints:', hasVerifyEndpoint ? 'YES' : 'NO');
      }
    } catch (error) {
      console.log('❌ Could not check admin routes:', error.message);
    }
    
    console.log('\n🧪 TESTING COMPLETE');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAdminVerification();