const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

// Buscar donde se llama guardarPost y agregar mediaUrl
// Buscar el patron: guardarPost({ titulo, caption, hashtags, fecha, hora, plataformas
const patron1 = 'await guardarPost({ titulo, caption, hashtags, fecha, hora, plataform';

if (h.includes(patron1)) {
  // Encontrar la linea completa
  const idx = h.indexOf(patron1);
  const fin = h.indexOf('});', idx) + 3;
  const lineaVieja = h.slice(idx, fin);
  console.log('Linea encontrada:', lineaVieja);
  
  // Reemplazar agregando mediaUrl y mediaFileId
  const lineaNueva = lineaVieja.replace(
    'await guardarPost({',
    'await guardarPost({ mediaUrl: mediaSubidaUrl, mediaFileId: mediaSubidaFileId,'
  );
  
  h = h.slice(0, idx) + lineaNueva + h.slice(fin);
  fs.writeFileSync('social-scheduler.html', h, 'utf8');
  console.log('LISTO - mediaUrl agregado al guardar post');
} else {
  // Buscar patron alternativo
  const patron2 = 'guardarPost(';
  const idx2 = h.lastIndexOf(patron2);
  if (idx2 !== -1) {
    const contexto = h.slice(idx2, idx2 + 200);
    console.log('Patron alternativo encontrado:', contexto);
    console.log('Necesita ajuste manual - reportar contexto');
  } else {
    console.log('ERROR - No se encontro guardarPost');
  }
}
