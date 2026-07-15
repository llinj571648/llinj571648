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

const GITHUB_CONFIG = {
  token: "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",
  owner: "llinj571648",
  repo: "bookmarks",
  path: "data.js",
};

function pushToGitHub(content) {
  return new Promise((resolve, reject) => {
    const encodedContent = Buffer.from(content).toString("base64");

    const options = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`,
      method: "GET",
      headers: {
        "Authorization": `token ${GITHUB_CONFIG.token}`,
        "User-Agent": "bookmarks-sync",
        "Accept": "application/vnd.github.v3+json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          const sha = result.sha;
          updateFile(content, sha, resolve, reject);
        } catch (e) {
          reject(new Error("获取文件 SHA 失败: " + e.message));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });

  function updateFile(content, sha, resolve, reject) {
    const encodedContent = Buffer.from(content).toString("base64");
    const body = JSON.stringify({
      message: "更新导航数据",
      content: encodedContent,
      sha: sha,
    });

    const options = {
      hostname: "api.github.com",
      path: `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`,
      method: "PUT",
      headers: {
        "Authorization": `token ${GITHUB_CONFIG.token}`,
        "User-Agent": "bookmarks-sync",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Accept": "application/vnd.github.v3+json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log("已同步到 GitHub");
          resolve();
        } else {
          reject(new Error(`GitHub 同步失败 (${res.statusCode})`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  }
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const content = generateDataJS(data);
        fs.writeFileSync(DATA_FILE, content, "utf8");
        console.log("数据已保存到本地");

        if (GITHUB_CONFIG.token) {
          await pushToGitHub(content);
          console.log("数据已同步到 GitHub");
        } else {
          console.log("未配置 GITHUB_TOKEN，跳过 GitHub 同步");
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.log("保存错误:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

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
