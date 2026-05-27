const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

const viejo = `async function cargarPosts() {
  try {
    const res = await fetch(\`\${API}/posts\`);
    const posts = await res.json();
    console.log('Posts cargados:', posts);
  } catch(e) {
    console.log('Backend no disponible, modo demo');
  }
}`;

const nuevo = `async function cargarPosts() {
  try {
    const res = await fetch(\`\${API}/posts\`);
    const posts = await res.json();
    renderizarPostsReales(posts);
  } catch(e) {
    console.log('Backend no disponible, modo demo');
  }
}

function renderizarPostsReales(posts) {
  // Buscar contenedor de recientes en el dashboard
  const contenedor = document.querySelector('.videos-grid') || document.querySelector('[class*="video-grid"]') || document.querySelector('[class*="grid"]');
  
  // Actualizar contador Cola de Posts
  const colaBadge = document.querySelector('.nav-badge');
  if (colaBadge) colaBadge.textContent = posts.length;

  if (!contenedor) return;
  if (posts.length === 0) return;

  // Renderizar solo los primeros 8 posts reales al inicio
  const postsHtml = posts.slice(0, 8).map(p => {
    const estadoLabel = { programado: 'Programado', publicado: 'Publicado', borrador: 'Borrador' }[p.estado] || p.estado;
    const estadoClass = p.estado || 'programado';
    const plataformas = (p.plataformas || []).map(pl => {
      const icons = { ig: '📷', tt: '🎵', yt: '▶️', fb: '👥', tw: '🐦', li: '💼' };
      return \`<span class="platform-dot" title="\${pl}" style="font-size:12px;">\${icons[pl] || pl}</span>\`;
    }).join('');

    const imgHtml = p.mediaUrl 
      ? \`<img src="\${p.mediaUrl}" alt="\${p.titulo}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit;z-index:1;">\`
      : '';

    return \`
      <div class="video-card slide-in" style="cursor:pointer;">
        <div class="video-thumb">
          <div class="video-thumb-bg" style="background:\${p.color || '#6c5ce7'}"></div>
          \${imgHtml}
          <div class="video-status status-\${estadoClass}">\${estadoLabel}</div>
        </div>
        <div class="video-info">
          <div class="video-title">\${p.titulo || 'Sin título'}</div>
          <div class="video-meta">\${p.fecha || ''} \${p.hora || ''}</div>
          <div style="margin-top:6px;">\${plataformas}</div>
        </div>
      </div>
    \`;
  }).join('');

  contenedor.innerHTML = postsHtml;
}`;

if (h.includes('async function cargarPosts()')) {
  // Buscar y reemplazar la función completa
  const inicio = h.indexOf('async function cargarPosts()');
  // Encontrar el cierre de la función (la llave que cierra)
  let nivel = 0;
  let i = inicio;
  let encontrado = false;
  while (i < h.length) {
    if (h[i] === '{') nivel++;
    if (h[i] === '}') {
      nivel--;
      if (nivel === 0) {
        const fin = i + 1;
        h = h.slice(0, inicio) + nuevo + h.slice(fin);
        encontrado = true;
        break;
      }
    }
    i++;
  }
  if (encontrado) {
    fs.writeFileSync('social-scheduler.html', h, 'utf8');
    console.log('LISTO - cargarPosts actualizado correctamente');
  } else {
    console.log('ERROR - No se pudo encontrar el cierre de la funcion');
  }
} else {
  console.log('ERROR - No se encontro la funcion cargarPosts');
}
