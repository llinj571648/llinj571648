const app = document.getElementById("app");

const data = window.data;

if (!data) {
  console.error("window.data is undefined! Check data.js");
}

Object.keys(data || {}).forEach(category => {

  const items = data[category];

  const pageName = category
    .toLowerCase()
    .replace(/\s+/g, "_") + ".html";

  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <a href="${pageName}">
      <h3>${category}</h3>
      <p>${items.length} sites</p>
    </a>
  `;

  app.appendChild(card);
});
