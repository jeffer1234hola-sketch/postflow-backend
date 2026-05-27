const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

const js = `
let mediaSubidaUrl = null;
let mediaSubidaFileId = null;

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) subirArchivo(file);
}

async function subirArchivo(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { showToast('Archivo supera 50MB', 'error'); return; }
  const previewImg = document.getElementById('previewImg');
  const previewVideo = document.getElementById('previewVideo');
  document.getElementById('uploadPlaceholder').style.display = 'none';
  document.getElementById('uploadPreview').style.display = 'block';
  document.getElementById('previewNombre').textContent = file.name + ' (' + (file.size/1024/1024).toFixed(2) + ' MB)';
  if (file.type.startsWith('image/')) {
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = 'block';
    previewVideo.style.display = 'none';
  } else {
    previewVideo.src = URL.createObjectURL(file);
    previewVideo.style.display = 'block';
    previewImg.style.display = 'none';
  }
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  uploadProgress.style.display = 'block';
  let p = 0;
  const iv = setInterval(() => {
    if (p < 85) { p += Math.random() * 15; progressBar.style.width = Math.min(p, 85) + '%'; }
  }, 300);
  try {
    const fd = new FormData();
    fd.append('archivo', file);
    const r = await fetch('https://postflow-backend-production-983c.up.railway.app/upload', { method: 'POST', body: fd });
    clearInterval(iv);
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Error al subir'); }
    const data = await r.json();
    mediaSubidaUrl = data.url;
    mediaSubidaFileId = data.fileId;
    progressBar.style.width = '100%';
    progressText.textContent = 'Subido correctamente';
    progressText.style.color = '#4ade80';
    setTimeout(() => { uploadProgress.style.display = 'none'; }, 2000);
    document.getElementById('btnQuitarMedia').style.display = 'inline-block';
    showToast('Archivo subido correctamente');
  } catch(err) {
    clearInterval(iv);
    progressText.textContent = 'Error: ' + err.message;
    progressText.style.color = '#ef4444';
    showToast('Error al subir archivo', 'error');
  }
}

function quitarMedia() {
  mediaSubidaUrl = null;
  mediaSubidaFileId = null;
  document.getElementById('archivoInput').value = '';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadPlaceholder').style.display = 'block';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('btnQuitarMedia').style.display = 'none';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressBar').style.background = 'linear-gradient(90deg,#a78bfa,#60a5fa)';
}
`;

// Insertar antes del cierre </script> final
const lastScript = h.lastIndexOf('</script>');
if (lastScript !== -1) {
  h = h.slice(0, lastScript) + js + '\n</script>' + h.slice(lastScript + 9);
  fs.writeFileSync('social-scheduler.html', h, 'utf8');
  console.log('LISTO JS - Funciones insertadas correctamente');
} else {
  console.log('ERROR - No se encontro </script>');
}
