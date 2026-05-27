const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ImageKit = require('imagekit');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// ── ImageKit config ──────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_oGWQkSvP5WDYk2Oq',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_zDSeY0OKGeNafh5',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/postflowjj'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/avi'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

// ── Schema ───────────────────────────────────────────────────
const PostSchema = new mongoose.Schema({
  titulo: String,
  caption: String,
  hashtags: String,
  plataformas: [String],
  fecha: String,
  hora: String,
  estado: { type: String, default: 'programado' },
  mediaUrl: { type: String, default: null },
  mediaFileId: { type: String, default: null },
  mediaTipo: { type: String, default: null },
  creadoEn: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', PostSchema);

// ── Endpoints posts ──────────────────────────────────────────
app.get('/posts', async (req, res) => {
  const posts = await Post.find().sort({ creadoEn: -1 });
  res.json(posts);
});

app.post('/posts', async (req, res) => {
  const post = new Post(req.body);
  await post.save();
  res.json({ ok: true, post });
});

app.delete('/posts/:id', async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.patch('/posts/:id', async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ ok: true, post });
});

// ── Endpoint subida de archivos ──────────────────────────────
app.post('/upload', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const fileName = `postflow_${Date.now()}_${req.file.originalname.replace(/\s/g, '_')}`;

    const resultado = await imagekit.upload({
      file: req.file.buffer,
      fileName: fileName,
      folder: '/postflow-media',
      useUniqueFileName: true,
    });

    res.json({
      url: resultado.url,
      fileId: resultado.fileId,
      nombre: resultado.name,
      tipo: req.file.mimetype,
      tamaño: req.file.size
    });

  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: 'Error al subir el archivo: ' + error.message });
  }
});

// ── Endpoint generar caption ─────────────────────────────────
app.post('/generar-caption', async (req, res) => {
  const { tema, plataforma, tono } = req.body;
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
          content: `Eres un experto en marketing digital para redes sociales en Colombia. Genera un caption profesional y atractivo para ${plataforma || 'Instagram'} sobre: "${tema}". Tono: ${tono || 'profesional y cercano'}. Incluye emojis relevantes y maximo 3 hashtags al final. Responde SOLO con el caption, sin explicaciones.`
        }],
        max_tokens: 300
      })
    });
    const data = await response.json();
    if (!data.choices) {
      return res.status(500).json({ ok: false, error: JSON.stringify(data) });
    }
    const caption = data.choices[0].message.content;
    res.json({ ok: true, caption });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ mensaje: 'PostFlow API funcionando' });
});

// ── Arranque ─────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Base de datos lista');
    app.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto 3000'));
  })
  .catch(err => console.error('Error DB:', err));
