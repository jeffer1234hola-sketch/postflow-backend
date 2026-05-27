const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

// Reemplazar el div video-thumb para mostrar imagen si existe
const viejo = '<div class="video-thumb">';
const nuevo = '<div class="video-thumb">' +
  '${v.mediaUrl ? ' +
  '`<img src="${v.mediaUrl}" alt="${v.titulo}" ' +
  'style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit;z-index:1;">` ' +
  ': ""}';

if (h.includes(viejo)) {
  // Solo reemplazar la primera ocurrencia dentro de renderVideoCard
  const idx = h.indexOf('function renderVideoCard');
  const parte1 = h.slice(0, idx);
  const parte2 = h.slice(idx).replace(viejo, nuevo);
  h = parte1 + parte2;
  fs.writeFileSync('social-scheduler.html', h, 'utf8');
  console.log('LISTO - Imagen en tarjetas agregada correctamente');
} else {
  console.log('ERROR - No se encontro video-thumb');
}
