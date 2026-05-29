const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ImageKit = require('imagekit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'postflow_secret_2026';
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/2wpe45g4j9po6d2896ef75tw6mxlqs70';
const FRONTEND_URL = 'https://postflow.club';
const resend = new Resend(process.env.RESEND_API_KEY);

// ── ImageKit ──────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/avi'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipo no permitido'), false);
  }
});

// ── Schemas ───────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  verificado: { type: Boolean, default: false },
  tokenVerificacion: { type: String, default: null },
  tokenExpira: { type: Date, default: null },
  creadoEn: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  titulo: String,
  caption: String,
  hashtags: String,
  plataformas: [String],
  fecha: String,
  hora: String,
  fechaPublicacion: Date,
  estado: { type: String, default: 'programado' },
  mediaUrl: { type: String, default: null },
  mediaFileId: { type: String, default: null },
  mediaTipo: { type: String, default: null },
  creadoEn: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// ── Middleware Auth ───────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ── Helper: Enviar email ──────────────────────────────────────
const enviarEmail = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({
      from: 'PostFlow <noreply@postflow.club>',
      to,
      subject,
      html
    });
    console.log('Email enviado a:', to);
  } catch (err) {
    console.warn('Error enviando email:', err.message);
  }
};

// ── Helper: Email de verificación ────────────────────────────
const emailVerificacion = (nombre, url) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#111118;border:1px solid #242430;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c5cfc,#c084fc);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✦ PostFlow</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Tu centro de control para redes sociales</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#f0eeff;font-size:20px;margin:0 0 16px;">Hola, ${nombre} 👋</h2>
      <p style="color:#8887a0;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Gracias por registrarte en PostFlow. Para activar tu cuenta y empezar a programar contenido, verificá tu email haciendo clic en el botón:
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${url}" style="background:linear-gradient(135deg,#7c5cfc,#c084fc);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;display:inline-block;">
          ✅ Verificar mi cuenta
        </a>
      </div>
      <p style="color:#8887a0;font-size:13px;line-height:1.6;margin:0;">
        Este enlace expira en 24 horas. Si no creaste una cuenta en PostFlow, podés ignorar este email.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #242430;text-align:center;">
      <p style="color:#8887a0;font-size:12px;margin:0;">© 2026 PostFlow · postflow.club</p>
    </div>
  </div>
</body>
</html>`;

// ── Helper: Email de bienvenida ───────────────────────────────
const emailBienvenida = (nombre) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#111118;border:1px solid #242430;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c5cfc,#c084fc);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✦ PostFlow</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#f0eeff;font-size:20px;margin:0 0 16px;">¡Cuenta verificada! 🎉</h2>
      <p style="color:#8887a0;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Hola ${nombre}, tu cuenta está activa. Ya podés programar y publicar contenido en Instagram, TikTok y Facebook desde un solo lugar.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://postflow.club" style="background:linear-gradient(135deg,#7c5cfc,#c084fc);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;display:inline-block;">
          🚀 Ir a PostFlow
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #242430;text-align:center;">
      <p style="color:#8887a0;font-size:12px;margin:0;">© 2026 PostFlow · postflow.club</p>
    </div>
  </div>
</body>
</html>`;

// ── Helper: Email notificación post publicado ─────────────────
const emailPostPublicado = (nombre, caption, plataformas, mediaUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#111118;border:1px solid #242430;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7c5cfc,#c084fc);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✦ PostFlow</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#f0eeff;font-size:20px;margin:0 0 8px;">¡Tu post fue publicado! 🚀</h2>
      <p style="color:#8887a0;font-size:14px;margin:0 0 24px;">Hola ${nombre}, tu contenido ya está en vivo.</p>
      ${mediaUrl ? `<img src="${mediaUrl}" style="width:100%;border-radius:10px;margin-bottom:16px;" alt="media"/>` : ''}
      <div style="background:#18181f;border:1px solid #242430;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="color:#c084fc;font-size:12px;font-weight:600;margin:0 0 8px;text-transform:uppercase;">Caption</p>
        <p style="color:#f0eeff;font-size:14px;margin:0;line-height:1.6;">${caption}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
        ${(plataformas || []).map(p => `<span style="background:rgba(124,92,252,0.15);color:#c084fc;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;">${p}</span>`).join('')}
      </div>
      <div style="text-align:center;">
        <a href="https://postflow.club" style="background:linear-gradient(135deg,#7c5cfc,#c084fc);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
          Ver mis posts
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #242430;text-align:center;">
      <p style="color:#8887a0;font-size:12px;margin:0;">© 2026 PostFlow · postflow.club</p>
    </div>
  </div>
</body>
</html>`;

// ── Helper: Notificar a Make ──────────────────────────────────
const notificarMake = async (post) => {
  try {
    const payload = {
      postId: post._id,
      titulo: post.titulo,
      caption: post.caption,
      hashtags: post.hashtags,
      plataformas: post.plataformas,
      mediaUrl: post.mediaUrl,
      mediaTipo: post.mediaTipo,
      fecha: post.fecha,
      hora: post.hora,
      fechaPublicacion: post.fechaPublicacion,
      estado: post.estado,
      userId: post.userId
    };
    const resp = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Make webhook enviado — status:', resp.status);
  } catch (err) {
    console.warn('Make webhook error:', err.message);
  }
};

// ── Auth endpoints ────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ error: 'El email ya está registrado' });
    const hash = await bcrypt.hash(password, 12);

    // Generar token de verificación
    const tokenVerificacion = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    const user = await User.create({
      nombre, email, password: hash,
      tokenVerificacion, tokenExpira,
      verificado: false
    });

    // Enviar email de verificación
    const urlVerificacion = `${FRONTEND_URL}/verify?token=${tokenVerificacion}&email=${email}`;
    await enviarEmail({
      to: email,
      subject: '✅ Verificá tu cuenta de PostFlow',
      html: emailVerificacion(nombre, urlVerificacion)
    });

    res.json({ ok: true, mensaje: 'Cuenta creada. Revisá tu email para verificarla.', requiresVerification: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Verificar email ───────────────────────────────────────────
app.get('/auth/verify', async (req, res) => {
  try {
    const { token, email } = req.query;
    const user = await User.findOne({ email, tokenVerificacion: token });
    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });
    if (user.tokenExpira < new Date()) return res.status(400).json({ error: 'Token expirado. Solicitá uno nuevo.' });

    user.verificado = true;
    user.tokenVerificacion = null;
    user.tokenExpira = null;
    await user.save();

    // Enviar email de bienvenida
    await enviarEmail({
      to: email,
      subject: '🎉 ¡Bienvenido a PostFlow!',
      html: emailBienvenida(user.nombre)
    });

    const jwtToken = jwt.sign({ id: user._id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token: jwtToken, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reenviar verificación ─────────────────────────────────────
app.post('/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Email no encontrado' });
    if (user.verificado) return res.status(400).json({ error: 'Esta cuenta ya está verificada' });

    const tokenVerificacion = crypto.randomBytes(32).toString('hex');
    const tokenExpira = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.tokenVerificacion = tokenVerificacion;
    user.tokenExpira = tokenExpira;
    await user.save();

    const urlVerificacion = `${FRONTEND_URL}/verify?token=${tokenVerificacion}&email=${email}`;
    await enviarEmail({
      to: email,
      subject: '✅ Verificá tu cuenta de PostFlow',
      html: emailVerificacion(user.nombre, urlVerificacion)
    });

    res.json({ ok: true, mensaje: 'Email de verificación reenviado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Olvidé mi contraseña ──────────────────────────────────────
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ ok: true, mensaje: 'Si el email existe, recibirás un enlace.' });
    const token = crypto.randomBytes(32).toString('hex');
    user.tokenVerificacion = token;
    user.tokenExpira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();
    const url = `${FRONTEND_URL}/reset-password?token=${token}&email=${email}`;
    await enviarEmail({
      to: email,
      subject: '🔑 Restablecer contraseña de PostFlow',
      html: `
        <div style="max-width:480px;margin:40px auto;background:#111118;border:1px solid #242430;border-radius:16px;overflow:hidden;font-family:-apple-system,sans-serif;">
          <div style="background:linear-gradient(135deg,#7c5cfc,#c084fc);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✦ PostFlow</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#f0eeff;font-size:20px;margin:0 0 16px;">Restablecer contraseña</h2>
            <p style="color:#8887a0;font-size:15px;line-height:1.6;margin:0 0 24px;">Hacé clic en el botón para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${url}" style="background:linear-gradient(135deg,#7c5cfc,#c084fc);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;display:inline-block;">🔑 Restablecer contraseña</a>
            </div>
            <p style="color:#8887a0;font-size:13px;">Si no solicitaste esto, ignorá este email.</p>
          </div>
        </div>`
    });
    res.json({ ok: true, mensaje: 'Si el email existe, recibirás un enlace.' });
  } catch(e) {
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) return res.status(400).json({ error: 'Datos incompletos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const user = await User.findOne({ email: email.toLowerCase(), tokenVerificacion: token });
    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });
    if (user.tokenExpira < new Date()) return res.status(400).json({ error: 'Token expirado. Solicitá uno nuevo.' });
    user.password = await bcrypt.hash(password, 12);
    user.tokenVerificacion = null;
    user.tokenExpira = null;
    await user.save();
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch(e) {
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
});app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (!user.verificado) return res.status(403).json({ error: 'Cuenta no verificada. Revisá tu email.', requiresVerification: true });
    const token = jwt.sign({ id: user._id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ ok: true, user });
});

// ── Posts ─────────────────────────────────────────────────────
app.get('/posts', authMiddleware, async (req, res) => {
  const posts = await Post.find({ userId: req.user.id }).sort({ creadoEn: -1 });
  res.json(posts);
});

app.post('/posts', authMiddleware, async (req, res) => {
  try {
    const post = new Post({ ...req.body, userId: req.user.id });
    await post.save();

    if (post.estado === 'programado' && (post.fechaPublicacion || post.fecha)) {
      await notificarMake(post);
    }

    // Notificar por email si el post se marca como publicado
    if (post.estado === 'publicado') {
      const user = await User.findById(req.user.id);
      if (user) {
        await enviarEmail({
          to: user.email,
          subject: '🚀 Tu post fue publicado en PostFlow',
          html: emailPostPublicado(user.nombre, post.caption, post.plataformas, post.mediaUrl)
        });
      }
    }

    res.json({ ok: true, ...post.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, userId: req.user.id });
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });
    if (post.mediaFileId) {
      try { await imagekit.deleteFile(post.mediaFileId); } catch (e) { console.warn('ImageKit delete:', e.message); }
    }
    await Post.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });

    if (req.body.estado === 'programado') {
      await notificarMake(post);
    }

    // Notificar por email cuando se marca como publicado
    if (req.body.estado === 'publicado') {
      const user = await User.findById(req.user.id);
      if (user) {
        await enviarEmail({
          to: user.email,
          subject: '🚀 Tu post fue publicado en PostFlow',
          html: emailPostPublicado(user.nombre, post.caption, post.plataformas, post.mediaUrl)
        });
      }
    }

    res.json({ ok: true, ...post.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload ────────────────────────────────────────────────────
app.post('/upload', authMiddleware, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
    const fileName = `postflow_${Date.now()}_${req.file.originalname.replace(/\s/g, '_')}`;
    const resultado = await imagekit.upload({
      file: req.file.buffer,
      fileName,
      folder: '/postflow-media',
      useUniqueFileName: true,
    });
    res.json({ url: resultado.url, fileId: resultado.fileId, nombre: resultado.name, tipo: req.file.mimetype });
  } catch (error) {
    console.error('Error upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Caption IA ────────────────────────────────────────────────
app.post('/generar-caption', authMiddleware, async (req, res) => {
  const { tema, prompt, plataforma, tono } = req.body;
  const topico = prompt || tema || 'contenido general';
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: `Eres un experto en marketing digital para redes sociales en Colombia. Genera un caption profesional y atractivo para ${plataforma || 'Instagram'} sobre: "${topico}". Tono: ${tono || 'profesional y cercano'}. Incluye emojis relevantes y máximo 3 hashtags al final. Responde SOLO con el caption, sin explicaciones.`
        }],
        max_tokens: 300
      })
    });
    const data = await response.json();
    if (!data.choices) return res.status(500).json({ ok: false, error: JSON.stringify(data) });
    res.json({ ok: true, caption: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ mensaje: 'PostFlow API v2.3 — Email verificación + notificaciones', status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Base de datos lista');
    app.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto 3000'));
  })
  .catch(err => console.error('Error DB:', err));