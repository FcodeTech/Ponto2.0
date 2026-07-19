const fs = require('fs');
const files = ['index.html', 'registrar_ponto.html', 'relatorios.html', 'configuracoes.html', 'funcionarios.html', 'perfil.html'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /<i class="fa-solid fa-clock"><\/i>\s*<span class="brand">Ponto Eletrônico<\/span>/g,
    '<i class="fa-solid fa-clock brand-icon-default"></i>\n                <img class="brand-logo" src="" style="display:none; height: 32px; border-radius: 4px; margin-right: 10px;">\n                <span class="brand">Ponto Eletrônico</span>'
  );
  fs.writeFileSync(file, content);
}
console.log('Sidebar updated');
