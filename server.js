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
      headers