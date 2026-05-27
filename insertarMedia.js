const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

const n = '<div class="form-group" style="margin-bottom:20px;">\n' +
'  <label class="form-label">Imagen / Video</label>\n' +
'  <div id="uploadZone" onclick="document.getElementById(\'archivoInput\').click()" ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ondragleave="this.classList.remove(\'drag-over\')" ondrop="handleDrop(event)" style="border:2px dashed rgba(255,255,255,0.15);border-radius:12px;padding:28px 20px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.03);">\n' +
'    <div id="uploadPlaceholder"><div style="font-size:32px;">imagen</div><p style="color:#6b6b80;font-size:14px;">Arrastra un archivo o haz click para seleccionar</p><p style="color:#4a4a5a;font-size:12px;">JPG, PNG, GIF, WEBP, MP4 - Max. 50MB</p></div>\n' +
'    <div id="uploadPreview" style="display:none;"><img id="previewImg" src="" alt="Preview" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain;"/><video id="previewVideo" src="" controls style="max-width:100%;max-height:180px;border-radius:8px;display:none;"></video><p id="previewNombre" style="margin:8px 0 0;font-size:12px;color:#a0a0b0;"></p></div>\n' +
'    <div id="uploadProgress" style="display:none;margin-top:12px;"><div style="background:rgba(255,255,255,0.1);border-radius:99px;height:4px;overflow:hidden;"><div id="progressBar" style="height:100%;background:linear-gradient(90deg,#a78bfa,#60a5fa);width:0%;transition:width 0.3s;border-radius:99px;"></div></div><p id="progressText" style="margin:6px 0 0;font-size:12px;color:#a0a0b0;">Subiendo...</p></div>\n' +
'  </div>\n' +
'  <input type="file" id="archivoInput" accept="image/*,video/*" style="display:none;" onchange="subirArchivo(this.files[0])"/>\n' +
'  <button type="button" id="btnQuitarMedia" onclick="quitarMedia()" style="display:none;margin-top:8px;background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;">X Quitar archivo</button>\n' +
'</div>\n';

const target = '<label class="form-label">Redes sociales</label>';

if (h.includes(target)) {
  h = h.replace(target, n + target);
  fs.writeFileSync('social-scheduler.html', h, 'utf8');
  console.log('LISTO - Bloque de media insertado correctamente');
} else {
  console.log('ERROR - No se encontro el texto objetivo. Verificar el HTML.');
}
