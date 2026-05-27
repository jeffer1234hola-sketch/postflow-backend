const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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
        model:'llama-3.1-8b-instant',
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

app.get('/', (req, res) => {
  res.json({ mensaje: 'PostFlow API funcionando' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Base de datos lista');
    app.listen(process.env.PORT || 3000, () => console.log('Servidor en puerto 3000'));
  })
  .catch(err => console.error('Error DB:', err));