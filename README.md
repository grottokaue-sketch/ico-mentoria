# ICP na prática · Mentoria

Site estático (HTML + CSS + JavaScript, sem servidor) com os slides e os frameworks da mentoria de ICP.
A startup navega pelos slides e preenche as ferramentas durante o encontro. Os dados ficam salvos no navegador de cada pessoa.

## Publicar no GitHub Pages
1. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
2. Em cerca de 1 minuto o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Configurar (arquivo `js/config.js`)
- `mentor` e `programa`: textos da capa.
- `mentorEmail`: se preenchido, "Enviar ao mentor" baixa o backup e abre um e-mail para você.
- `webhookUrl`: se preenchido, "Enviar ao mentor" envia o preenchimento direto (ex.: Google Apps Script que grava numa planilha).
- `storageKey`: troque se quiser separar turmas no mesmo domínio.

## Como usar nos encontros
- Setas ← → (ou botões) navegam; nos slides de cartões e comparativos, cada toque revela o próximo item.
- Tecla **N** abre as notas do mentor (roteiro de condução de cada slide).
- Slides "Sua vez" têm cronômetro e a ferramenta para preencher na hora.
- **Painel** mostra o avanço de cada ferramenta e dos deveres de casa.
- **Exportar**: Excel (uma aba por ferramenta), backup .json (para continuar em outro computador via Importar), PDF, ou enviar ao mentor.

## Limites
- Os dados ficam no navegador: limpar o histórico apaga. Exporte um backup ao final de cada encontro.
- O Excel depende da biblioteca SheetJS carregada por CDN (precisa de internet).
- Exemplos (empresa Nativa e seus números) são fictícios.
