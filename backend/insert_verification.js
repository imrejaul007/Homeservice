const mongoose = require('mongoose');

async function insertVerification() {
  const MONGODB_URI = 'mongodb+srv://nilimraj_db_user:aXJBzxFtRJosdxEc@cluster0.wnjcyp1.mongodb.net/?appName=Cluster0';
  
  await mongoose.connect(MONGODB_URI);
  
  const verificationSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['pending', 'in_progress', 'verified', 'rejected', 'suspended'], default: 'pending' },
    kycScore: { type: Number, default: 0 },
    kycLevel: { type: String, enum: ['basic', 'standard', 'enhanced'], default: 'basic' },
    documents: [Object],
    backgroundChecks: [Object],
    fraudFlags: [Object],
    reviewHistory: [Object],
    metadata: Object
  }, { timestamps: true });
  
  const ProviderVerification = mongoose.model('ProviderVerification', verificationSchema);
  
  const userId = new mongoose.Types.ObjectId('6a13ddce180760005bdb6e37');
  
  const existing = await ProviderVerification.findOne({ providerId: userId });
  if (existing) {
    console.log('Verification record already exists');
  } else {
    const verification = new ProviderVerification({
      providerId: userId,
      status: 'verified',
      kycScore: 100,
      kycLevel: 'standard',
      documents: [],
      backgroundChecks: [],
      fraudFlags: [],
      reviewHistory: [{
        action: 'approved',
        performedBy: new mongoose.Types.ObjectId('6a01d67602fcc75616ee7a30'),
        performedAt: new Date(),
        notes: 'Approved via admin panel',
        previousStatus: 'pending',
        newStatus: 'verified'
      }],
      metadata: { verificationAttempts: 1, lastAttemptAt: new Date() }
    });
    await verification.save();
    console.log('Verification record created!');
  }
  
  await mongoose.disconnect();
}

insertVerification().catch(console.error);
