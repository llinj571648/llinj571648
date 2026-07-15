const STORAGE_KEY = "navData";
const GITHUB_OWNER = "llinj571648";
const GITHUB_REPO = "bookmarks";
const GITHUB_PATH = "data.js";
const GITHUB_TOKEN = "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";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");

let currentCategory = null;
let githubSha = null;
let isSyncing = false;

async function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      window.data = JSON.parse(saved);
      return;
    } catch (e) {}
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (response.ok) {
      const result = await response.json();
      githubSha = result.sha;
      const content = atob(result.content);
      const match = content.match(/window\.data\s*=\s*(\{[\s\S]*\}\s*\});?/);
      if (match) {
        try {
          window.data = JSON.parse(match[1]);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data));
        } catch (e) {
          console.error("解析数据失败:", e);
        }
      }
    }
  } catch (e) {
    console.error("加载数据失败:", e);
  }
}

async function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data));

  try {
    const dataStr = generateDataJSString();
    const encodedContent = btoa(unescape(encodeURIComponent(dataStr)));

    const body = {
      message: "更新导航数据",
      content: encodedContent,
      sha: githubSha
    };

    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const result = await response.json();
      githubSha = result.content.sha;
      showToast("已同步到 GitHub");
    } else {
      const error = await response.json();
      showToast("同步失败: " + (error.message || "未知错误"));
    }
  } catch (e) {
    showToast("同步失败: " + e.message);
  }
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${message.includes('失败') ? '#ef4444' : '#22c55e'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    return "https://" + url;
  }
  return url;
}

function renderSidebar() {
  sidebar.innerHTML = "";

  Object.keys(window.data).forEach(category => {
    const div = document.createElement("div");
    div.className = "category" + (category === currentCategory ? " active" : "");
    div.innerHTML = `
      <span>${escapeHtml(category)}</span>
    `;
    div.onclick = () => {
      currentCategory = category;
      renderSidebar();
      renderCategory(category);
    };
    sidebar.appendChild(div);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-add";
  addBtn.innerText = "+ 新增分类";
  addBtn.onclick = () => toggleCategoryForm(true);
  sidebar.appendChild(addBtn);

  const form = document.createElement("div");
  form.id = "category-form";
  form.className = "form-panel hidden";
  form.innerHTML = `
    <input type="text" id="cat-name" placeholder="分类名称" />
    <div class="form-actions">
      <button class="btn btn-primary" id="cat-submit">确认</button>
      <button class="btn" id="cat-cancel">取消</button>
    </div>
  `;
  sidebar.appendChild(form);

  form.querySelector("#cat-submit").onclick = submitCategoryForm;
  form.querySelector("#cat-cancel").onclick = () => {
    form.querySelector("#cat-name").value = "";
    toggleCategoryForm(false);
  };
}

function toggleCategoryForm(show) {
  const form = document.getElementById("category-form");
  if (form) form.classList.toggle("hidden", !show);
}

function submitCategoryForm() {
  const input = document.getElementById("cat-name");
  const name = input.value.trim();

  if (!name) {
    alert("分类名称不能为空");
    return;
  }
  if (window.data[name]) {
    alert("分类已存在");
    return;
  }

  window.data[name] = [];
  saveData();
  currentCategory = name;
  input.value = "";
  toggleCategoryForm(false);
  renderSidebar();
  renderCategory(name);
}

function renderCategory(category) {
  if (!category || !window.data[category]) {
    content.innerHTML = "<h2>请选择分类</h2>";
    return;
  }

  const items = window.data[category];

  content.innerHTML = `
    <div class="header-row">
      <h2>${escapeHtml(category)}（${items.length}）<button class="btn btn-delete" data-category="${escapeHtml(category)}" style="margin-left:10px;padding:4px 10px;font-size:12px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;">删除分类</button></h2>
      <button class="btn btn-add" id="add-site-btn" style="width:auto;margin-top:0">+ 添加网站</button>
      <button class="btn" id="export-data-btn" style="width:auto;margin-top:0;margin-left:8px">导出 data.js</button>
      <button class="btn" id="export-bookmark-btn" style="width:auto;margin-top:0;margin-left:8px">导出到收藏夹</button>
    </div>
    <div id="site-form" class="form-panel hidden">
      <input type="text" id="site-name" placeholder="名称" />
      <input type="text" id="site-url" placeholder="URL" />
      <input type="text" id="site-desc" placeholder="描述（可选）" />
      <div class="form-actions">
        <button class="btn btn-primary" id="site-submit">添加</button>
        <button class="btn" id="site-cancel">取消</button>
      </div>
    </div>
    <div id="site-list"></div>
  `;

  const siteList = content.querySelector("#site-list");
  items.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "item";
    const noteText = item.note ? escapeHtml(item.note) : "点击添加备注";
    div.innerHTML = `
      <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.name)}</a>
      <small>${escapeHtml(item.desc || "")}</small>
      <small class="note-text" data-index="${index}" style="cursor:pointer;color:${item.note ? 'inherit' : '#999'};">${noteText}</small>
      <button class="btn btn-delete-site" data-index="${index}" style="float:right;padding:4px 10px;font-size:12px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-left:10px;">删除</button>
    `;
    siteList.appendChild(div);
  });

  siteList.addEventListener("click", (e) => {
    if (!e.target.classList.contains("note-text")) return;

    const idx = parseInt(e.target.getAttribute("data-index"), 10);
    const currentNote = window.data[category][idx].note || "";

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentNote;
    input.style.width = "220px";

    e.target.replaceWith(input);
    input.focus();

    const save = () => {
      const value = input.value.trim();
      if (value) {
        window.data[category][idx].note = value;
      } else {
        delete window.data[category][idx].note;
      }
      saveData();
      renderCategory(category);
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        input.blur();
      }
    });
  });

  const siteForm = content.querySelector("#site-form");
  content.querySelector("#add-site-btn").onclick = () => {
    siteForm.classList.remove("hidden");
  };

  content.querySelectorAll(".btn-delete").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const cat = btn.getAttribute("data-category");
      if (confirm(`确定删除分类 "${cat}" 吗？`)) {
        delete window.data[cat];
        saveData();
        currentCategory = null;
        renderSidebar();
        renderCategory(null);
      }
    };
  });
  content.querySelector("#site-cancel").onclick = () => {
    siteForm.classList.add("hidden");
    clearSiteForm();
  };
  content.querySelector("#site-submit").onclick = () => {
    const name = content.querySelector("#site-name").value.trim();
    const url = content.querySelector("#site-url").value.trim();
    const desc = content.querySelector("#site-desc").value.trim();

    if (!name || !url) {
      alert("名称和 URL 不能为空");
      return;
    }

    window.data[category].push({
      name,
      url: normalizeUrl(url),
      desc,
      star: 5
    });
    saveData();
    siteForm.classList.add("hidden");
    clearSiteForm();
    renderCategory(category);
  };

  content.querySelectorAll(".btn-delete-site").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (confirm(`确定删除该网址吗？`)) {
        window.data[category].splice(idx, 1);
        saveData();
        renderCategory(category);
      }
    };
  });
}

function clearSiteForm() {
  const nameInput = content.querySelector("#site-name");
  const urlInput = content.querySelector("#site-url");
  const descInput = content.querySelector("#site-desc");
  if (nameInput) nameInput.value = "";
  if (urlInput) urlInput.value = "";
  if (descInput) descInput.value = "";
}

function generateDataJSString() {
  const entries = Object.entries(window.data).map(([category, items]) => {
    const itemsStr = items.map(item => {
      const descStr = item.desc ? `,\n      desc: "${item.desc.replace(/"/g, '\\"')}"` : "";
      const noteStr = item.note ? `,\n      note: "${item.note.replace(/"/g, '\\"')}"` : "";
      return `      {\n        name: "${item.name.replace(/"/g, '\\"')}",\n        url: "${item.url.replace(/"/g, '\\"')}"${descStr}${noteStr},\n        star: ${item.star}\n      }`;
    }).join(",\n");
    return `  "${category}": [\n${itemsStr}\n  ]`;
  });
  return `window.data = {\n\n${entries.join(",\n\n")}\n\n};`;
}

function generateBookmarkHTML() {
  const folderName = "导航站";
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3>${escapeHtml(folderName)}</H3>
  <DL><p>
`;

  Object.entries(window.data).forEach(([category, items]) => {
    html += `    <DT><H3>${escapeHtml(category)}</H3>\n    <DL><p>\n`;
    items.forEach(item => {
      html += `      <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="0">${escapeHtml(item.name)}</A>\n`;
    });
    html += `    </DL><p>\n`;
  });

  html += `  </DL><p>\n</DL><p>`;
  return html;
}

function downloadBookmarkHTML() {
  const content = generateBookmarkHTML();
  const blob = new Blob([content], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookmarks.html";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataJS() {
  const content = generateDataJSString();
  const blob = new Blob([content], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(url);
}

loadData();
renderSidebar();

setTimeout(() => {
  const first = Object.keys(window.data)[0];
  if (first) {
    currentCategory = first;
    renderSidebar();
    renderCategory(first);
  }
}, 500);

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "export-data-btn") {
    downloadDataJS();
  }
  if (e.target && e.target.id === "export-bookmark-btn") {
    downloadBookmarkHTML();
  }
});
