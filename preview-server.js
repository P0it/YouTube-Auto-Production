const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const htmlPath = path.join(__dirname, '.superpowers/brainstorm/44225-1775210503/content/multiplayer-board-v2.html');

const server = http.createServer((req, res) => {
  const fragment = fs.readFileSync(htmlPath, 'utf-8');
  const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dripple Design Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111; color: #e2e8f0; padding: 24px; line-height: 1.5; }
  h2 { font-size: 24px; margin-bottom: 4px; color: #f8fafc; }
  h3 { font-size: 18px; margin-bottom: 10px; color: #f8fafc; margin-top: 8px; }
  .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .mockup { border-radius: 16px; overflow: hidden; border: 1px solid #334155; margin-bottom: 8px; }
  .mockup-header { background: #1e293b; padding: 8px 16px; font-size: 13px; color: #94a3b8; font-weight: 600; }
  .mockup-body { padding: 16px; }
  .split { display: flex; gap: 12px; }
  .split > * { flex: 1; }
  .options { display: flex; flex-direction: column; gap: 12px; }
  .pros-cons { display: flex; gap: 12px; margin-top: 8px; }
  .pros-cons > div { flex: 1; }
  .pros-cons h4 { margin-bottom: 6px; }
  .pros-cons ul { padding-left: 18px; font-size: 13px; }
  .pros-cons li { margin-bottom: 4px; }
  p { margin: 4px 0; }
  code { background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
${fragment}
</body>
</html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fullHtml);
});

server.listen(PORT, () => {
  console.log("Preview server running on http://localhost:" + PORT);
});
