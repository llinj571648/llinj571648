const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data.js");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
};

function generateDataJS(data) {
  const entries = Object.entries(data).map(([category, items]) => {
    const itemsStr = items.map(item => {
      const descStr = item.desc ? `,\n      desc: "${item.desc.replace(/"/g, '\\"')}"` : "";
      const noteStr = item.note ? `,\n      note: "${item.note.replace(/"/g, '\\"')}"` : "";
      return `      {\n        name: "${item.name.replace(/"/g, '\\"')}",\n        url: "${item.url.replace(/"/g, '\\"')}"${descStr}${noteStr},\n        star: ${item.star}\n      }`;
    }).join(",\n");
    return `  "${category}": [\n${itemsStr}\n  ]`;
  });
  return `window.data = {\n\n${entries.join(",\n\n")}\n\n};\n`;
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /save — 保存 data.js
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const content = generateDataJS(data);
        fs.writeFileSync(DATA_FILE, content, "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /data — 读取当前 data.js 内容
  if (req.method === "GET" && req.url === "/data") {
    try {
      const content = fs.readFileSync(DATA_FILE, "utf8");
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(content);
    } catch (e) {
      res.writeHead(500);
      res.end("Cannot read data.js");
    }
    return;
  }

  // 静态文件服务
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(__dirname, urlPath);

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`导航站已启动: http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});
