// routes/authMeta.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const SocialConnection = require('../models/SocialConnection');

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const BACKEND_URL = 'https://postflow-backend-production-983c.up.railway.app';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://postflow.club';
const REDIRECT_URI = `${BACKEND_URL}/auth/meta/callback`;

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.userId = decoded.id || decoded.userId || decoded._id;
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
}

router.get('/meta', (req, res) => {
  const rawToken = req.query.token || (req.headers.authorization?.split(' ')[1]);
  if (!rawToken) return res.status(401).json({ error: 'No autorizado' });
  let userId;
  try {
    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
    userId = decoded.id || decoded.userId || decoded._id;
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: ['instagram_basic','instagram_content_publish','instagram_manage_insights','pages_show_list','pages_read_engagement','pages_manage_posts'].join(','),
    response_type: 'code',
    state,
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
});

router.get('/meta/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/connections?error=meta_denied`);
  if (!code || !state) return res.redirect(`${FRONTEND_URL}/connections?error=invalid_callback`);
  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
    if (!userId) throw new Error();
  } catch { return res.redirect(`${FRONTEND_URL}/connections?error=invalid_state`); }
  try {
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: REDIRECT_URI, code },
    });
    const longRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: tokenRes.data.access_token },
    });
    const longLivedToken = longRes.data.access_token;
    const expiresIn = longRes.data.expires_in;
    const meRes = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { access_token: longLivedToken, fields: 'id,name,picture' },
    });
    const fbUser = meRes.data;
    const pagesRes = await axios.get(`https://graph.facebook.com/v19.0/${fbUser.id}/accounts`, {
      params: { access_token: longLivedToken },
    });
    const pages = pagesRes.data.data || [];
    let instagramAccount = null;
    for (const page of pages) {
      try {
        const igRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
        if (igRes.data.instagram_business_account) {
          const igId = igRes.data.instagram_business_account.id;
          const igInfo = await axios.get(`https://graph.facebook.com/v19.0/${igId}?fields=id,username,profile_picture_url&access_token=${page.access_token}`);
          instagramAccount = { igUserId: igId, username: igInfo.data.username, profilePic: igInfo.data.profile_picture_url, pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
          break;
        }
      } catch (e) { console.warn('No IG en página:', page.name); }
    }
    await SocialConnection.findOneAndUpdate(
      { userId, platform: 'meta' },
      { userId, platform: 'meta', accessToken: longLivedToken, expiresAt: new Date(Date.now() + expiresIn * 1000), fbUserId: fbUser.id, fbUserName: fbUser.name, fbUserPic: fbUser.picture?.data?.url, pages, instagramAccount, connectedAt: new Date(), status: 'active' },
      { upsert: true, new: true }
    );
    return res.redirect(`${FRONTEND_URL}/connections?success=meta`);
  } catch (err) {
    console.error('Meta callback error:', err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/connections?error=meta_failed`);
  }
});

router.get('/meta/status', requireAuth, async (req, res) => {
  try {
    const conn = await SocialConnection.findOne({ userId: req.userId, platform: 'meta' }).select('-accessToken');
    if (!conn) return res.json({ connected: false });
    const expired = conn.expiresAt && new Date() > conn.expiresAt;
    res.json({ connected: !expired, expired, fbUserName: conn.fbUserName, fbUserPic: conn.fbUserPic, instagramAccount: conn.instagramAccount ? { username: conn.instagramAccount.username, profilePic: conn.instagramAccount.profilePic } : null, connectedAt: conn.connectedAt, expiresAt: conn.expiresAt });
  } catch { res.status(500).json({ error: 'Error al obtener estado' }); }
});

router.delete('/meta/disconnect', requireAuth, async (req, res) => {
  try {
    await SocialConnection.findOneAndDelete({ userId: req.userId, platform: 'meta' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al desconectar' }); }
});

module.exports = router;