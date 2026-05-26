const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// === MODELO DE POST ===
const PostSchema = new mongoose.Schema({
  titulo: String,
  caption: String,
  hashtags: String,
  plataformas: [String],
  fecha: String,
  hora: String,
  estado: { type: String, default: 'programado' },
  creadoEn: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', PostSchema);

// === RUTAS ===

// Obtener todos los posts
app.get('/posts', async (req, res) => {
  const posts = await Post.find().sort({ creadoEn: -1 });
  res.json(posts);
});

// Crear un post
app.post('/posts', async (req, res) => {
  const post = new Post(req.body);
  await post.save();
  res.json({ ok: true, post });
});

// Eliminar un post
app.delete('/posts/:id', async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Actualizar estado de un post
app.patch('/posts/:id', async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ ok: true, post });
});

app.get('/', (req, res) => {
  res.json({ mensaje: 'PostFlow API funcionando ✅' });
});

// === INICIAR SERVIDOR ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Base de datos lista');
    app.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto 3000'));
  })
  .catch(err => console.error('Error DB:', err));

