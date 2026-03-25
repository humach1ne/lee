const menuEl = document.getElementById('menu');
const contentEl = document.getElementById('content');
const headerTitleEl = document.getElementById('headerTitle');
const themeToggleEl = document.getElementById('themeToggle');
const menuBtnEl = document.getElementById('menuBtn');
const overlayEl = document.getElementById('overlay');

let sidebarTree = [];

function normalizeFilePath(file) {
  return file.replace(/\.md$/i, '');
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

menuBtnEl.addEventListener('click', () => {
  document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
});

overlayEl.addEventListener('click', closeSidebar);

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
    return;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

themeToggleEl.addEventListener('click', () => {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
});

function parseSummary(text) {
  const lines = text.split('\n');
  const root = [];
  const stack = [{ children: root, level: -1 }];

  lines.forEach((line) => {
    const match = line.match(/^(\s*)\* \[(.*?)\]\((.*?)\)/);
    if (!match) return;

    const indent = match[1].length;
    const level = Math.floor(indent / 2);
    const title = match[2].trim();
    const file = normalizeFilePath(match[3].trim());

    const node = { title, file, children: [] };

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push({ ...node, level });
  });

  return root;
}

function findNodeTitle(nodes, file) {
  for (const node of nodes) {
    if (node.file === file) return node.title;
    if (node.children.length) {
      const nested = findNodeTitle(node.children, file);
      if (nested) return nested;
    }
  }
  return file === 'README' ? 'Home' : file;
}

function renderTree(nodes) {
  return nodes.map((node) => {
    if (node.children.length > 0) {
      return `
        <div class="folder">
          <button class="folder-title" onclick="toggleFolder(this)" type="button">
            <span class="folder-chevron">›</span>
            <span class="folder-label">${node.title}</span>
          </button>
          <div class="folder-content">
            ${renderTree(node.children)}
          </div>
        </div>
      `;
    }

    return `
      <a href="#${node.file}" data-file="${node.file}" class="menu-link">
        ${node.title}
      </a>
    `;
  }).join('');
}

async function loadSidebar() {
  try {
    const res = await fetch('./SUMMARY.md');
    if (!res.ok) throw new Error('SUMMARY.md not found');

    const text = await res.text();
    sidebarTree = parseSummary(text);
    menuEl.innerHTML = renderTree(sidebarTree);
    expandFoldersForCurrentPage();
  } catch (err) {
    menuEl.innerHTML = '<p class="empty-state">사이드바를 불러오지 못했습니다.</p>';
    console.error(err);
  }
}

function setActiveLink(page) {
  document.querySelectorAll('.menu-link').forEach((a) => {
    a.classList.toggle('active', a.dataset.file === page);
  });
}

function expandFoldersForCurrentPage() {
  const page = location.hash.replace('#', '') || 'README';
  const activeLink = document.querySelector(`.menu-link[data-file="${CSS.escape(page)}"]`);
  if (!activeLink) return;

  let current = activeLink.parentElement;
  while (current && current !== document.body) {
    if (current.classList && current.classList.contains('folder-content')) {
      current.style.display = 'block';
      const title = current.previousElementSibling;
      if (title && title.classList.contains('folder-title')) {
        title.classList.add('open');
      }
    }
    current = current.parentElement;
  }
}

async function loadPage() {
  const page = location.hash.replace('#', '') || 'README';

  try {
    const res = await fetch(`./${page}.md`);
    if (!res.ok) throw new Error(`${page}.md not found`);

    const md = await res.text();
    contentEl.innerHTML = marked.parse(md);
    setActiveLink(page);
    expandFoldersForCurrentPage();
    headerTitleEl.textContent = findNodeTitle(sidebarTree, page);

    if (window.innerWidth <= 980) {
      closeSidebar();
    }
  } catch (err) {
    contentEl.innerHTML = `
      <h1>문서를 불러오지 못했습니다</h1>
      <pre>${err.message}</pre>
    `;
    headerTitleEl.textContent = 'Error';
    console.error(err);
  }
}

function toggleFolder(el) {
  const content = el.nextElementSibling;
  const isOpen = content.style.display === 'block';
  content.style.display = isOpen ? 'none' : 'block';
  el.classList.toggle('open', !isOpen);
}

window.toggleFolder = toggleFolder;

window.addEventListener('hashchange', loadPage);
window.addEventListener('resize', () => {
  if (window.innerWidth > 980) closeSidebar();
});

initTheme();

(async function init() {
  await loadSidebar();
  await loadPage();
})();
