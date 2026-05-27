const fs = require('fs');

let h = fs.readFileSync('social-scheduler.html', 'utf8');

// Buscar el estilo del main-content o dashboard y agregar overflow-y: auto
const fixes = [
  // Fix 1: main content area
  ['.main-content {', '.main-content {\n  overflow-y: auto;\n  height: 100vh;'],
  ['.content-area {', '.content-area {\n  overflow-y: auto;\n  height: 100vh;'],
  ['.dashboard {', '.dashboard {\n  overflow-y: auto;\n  height: 100vh;'],
  ['.main {', '.main {\n  overflow-y: auto;\n  height: 100vh;'],
];

let arreglado = false;
for (const [viejo, nuevo] of fixes) {
  if (h.includes(viejo) && !arreglado) {
    h = h.replace(viejo, nuevo);
    console.log('Arreglado con:', viejo);
    arreglado = true;
  }
}

// Si no encontró ninguno, agregar CSS global al final del <style>
if (!arreglado) {
  const cssExtra = `
  /* Fix scroll dashboard */
  .main-content, .content-area, .dashboard, .main, #main-content, #content {
    overflow-y: auto !important;
    height: 100vh !important;
  }
  body {
    overflow: hidden;
  }
`;
  h = h.replace('</style>', cssExtra + '\n</style>');
  console.log('CSS global de scroll agregado');
  arreglado = true;
}

fs.writeFileSync('social-scheduler.html', h, 'utf8');
console.log('LISTO - Scroll arreglado');
