const mongoose = require('mongoose');

const SocialConnectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['meta', 'tiktok', 'twitter', 'linkedin', 'google'], required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    fbUserId: { type: String },
    fbUserName: { type: String },
    fbUserPic: { type: String },
    pages: { type: Array, default: [] },
    instagramAccount: {
      igUserId: String,
      username: String,
      profilePic: String,
      pageId: String,
      pageName: String,
      pageAccessToken: String,
    },
    tiktokUserId: { type: String },
    tiktokUsername: { type: String },
    tiktokAvatarUrl: { type: String },
    connectedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

SocialConnectionSchema.index({ userId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('SocialConnection', SocialConnectionSchema);