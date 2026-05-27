const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ImageKit = require('imagekit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'postflow_secret_2026';
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/2wpe45g4j9po6d2896ef75tw6mxlqs70';

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

const authOptional = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
};

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
    const user = await User.create({ nombre, email, password: hash });
    const token = jwt.sign({ id: user._id, email: user.email, nombre: user.nombre }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
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

    // Notificar a Make solo si el post es programado y tiene fecha
    if (post.estado === 'programado' && (post.fechaPublicacion || post.fecha)) {
      await notificarMake(post);
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

    // Re-notificar a Make si se actualiza el estado a programado
    if (req.body.estado === 'programado') {
      await notificarMake(post);
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
app.get('/', (req, res) => res.json({ mensaje: 'PostFlow API v2.2 — Make.com integrado', status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Base de datos lista');
    app.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto 3000'));
  })
  .catch(err => console.error('Error DB:', err));