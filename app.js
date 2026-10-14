let currentName = 'Sirael';
let deferredPrompt = null;

// Registrace Service Workeru pro PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.log('SW reg error:', err));
  });
}

// Obsluha instalace PWA tlačítkem
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstallPwa');
  if (btn) btn.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', async () => {
  await window.appDb.init();
  await loadInitialSettings();
  await ensureDefaultLibraryItem();
  setupNavigation();
  setupChat();
  setupLibrary();
  setupMemory();
  setupSettingsUI();
});

// --- Načtení nastavení & Výchozí stav ---
async function loadInitialSettings() {
  const savedName = await window.appDb.getSetting('companionName', 'Sirael');
  currentName = savedName;
  updateNameUI(currentName);

  const userNick = await window.appDb.getSetting('userNick', '');
  const inputNick = document.getElementById('settingUserNick');
  if (inputNick) inputNick.value = userNick;
}

function updateNameUI(name) {
  document.getElementById('headerName').textContent = name;
  document.getElementById('displayHeroName').textContent = name;
  document.getElementById('settingNameInput').value = name;
}

// Zajištění výchozí položky dle požadavku v zadání
async function ensureDefaultLibraryItem() {
  const hasSeeded = await window.appDb.getSetting('hasSeededDefaultLib', false);
  if (!hasSeeded) {
    await window.appDb.saveLibraryItem({
      title: 'Návrat domů',
      trigger: 'Když se vrátím domů',
      category: 'Flirt',
      response: 'Ahoj, miláčku! Pojď ke mně, chci slyšet, jaký jsi měl den. ❤️',
      tags: ['příchod', 'domov', 'uvítání']
    });
    await window.appDb.setSetting('hasSeededDefaultLib', true);
  }
}

// --- Navigace mezi záložkami ---
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      navBtns.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-view');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'view-library') renderLibrary();
      if (targetId === 'view-memory') renderMemory();
    });
  });
}

// --- Chat simulace s napojením na Knihovnu ---
function setupChat() {
  const btnSend = document.getElementById('btnSend');
  const chatInput = document.getElementById('chatInput');

  // Počáteční uvítací zpráva
  appendMessage(currentName, `Ahoj, jsem tady s tebou. Na co máš chuť?`, 'sirael');

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage('Ty', text, 'user');
    chatInput.value = '';

    // Vyhledání shody v knihovně pro 1. etapu
    const libItems = await window.appDb.getAllLibraryItems();
    const query = text.toLowerCase();
    const match = libItems.find(item => 
      (item.trigger && query.includes(item.trigger.toLowerCase())) || 
      (item.title && query.includes(item.title.toLowerCase()))
    );

    setTimeout(() => {
      if (match) {
        appendMessage(currentName, match.response, 'sirael');
      } else {
        appendMessage(currentName, `Slyším tě. V další etapě sem připojíme lokální AI model!`, 'sirael');
      }
    }, 400);
  }

  btnSend.addEventListener('click', handleSend);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

function appendMessage(sender, text, type) {
  const box = document.getElementById('chatHistory');
  const msg = document.createElement('div');
  msg.className = `msg ${type}`;
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

// --- Knihovna Odpovědí (CRUD) ---
function setupLibrary() {
  const modal = document.getElementById('modalNewItem');
  document.getElementById('btnOpenNewItemModal').addEventListener('click', () => {
    modal.style.display = 'block';
  });
  document.getElementById('btnCancelNewItem').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('btnSaveNewItem').addEventListener('click', async () => {
    const title = document.getElementById('newTitle').value.trim();
    const trigger = document.getElementById('newTrigger').value.trim();
    const category = document.getElementById('newCategory').value;
    const response = document.getElementById('newResponse').value.trim();

    if (!title || !response) {
      alert('Vyplň prosím název a odpověď.');
      return;
    }

    await window.appDb.saveLibraryItem({ title, trigger, category, response, tags: [] });
    // Vyčištění formuláře
    document.getElementById('newTitle').value = '';
    document.getElementById('newTrigger').value = '';
    document.getElementById('newResponse').value = '';
    modal.style.display = 'none';
    renderLibrary();
  });

  // Filtrování a vyhledávání
  document.getElementById('libSearch').addEventListener('input', renderLibrary);
  document.getElementById('libFilterCategory').addEventListener('change', renderLibrary);

  // Export do JSON
  document.getElementById('btnExportLib').addEventListener('click', async () => {
    const items = await window.appDb.getAllLibraryItems();
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sirael_knihovna_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  // Import z JSON
  document.getElementById('fileImportLib').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          for (const item of imported) {
            delete item.id; // Přidělit nové ID
            await window.appDb.saveLibraryItem(item);
          }
          alert('Knihovna byla úspěšně importována.');
          renderLibrary();
        }
      } catch (err) {
        alert('Neplatný formát JSON souboru.');
      }
    };
    reader.readAsText(file);
  });
}

async function renderLibrary() {
  const container = document.getElementById('libraryList');
  container.innerHTML = '';

  const search = document.getElementById('libSearch').value.toLowerCase();
  const filterCat = document.getElementById('libFilterCategory').value;
  const items = await window.appDb.getAllLibraryItems();

  const filtered = items.filter(item => {
    const matchSearch = item.title.toLowerCase().includes(search) || 
                        item.response.toLowerCase().includes(search) ||
                        (item.trigger && item.trigger.toLowerCase().includes(search));
    const matchCat = filterCat === '' || item.category === filterCat;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px;">Žádné položky nenalezeny.</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <strong>${item.title}</strong>
        <span class="badge">${item.category}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">Spouštěč: ${item.trigger || '—'}</div>
      <div style="font-size: 0.95rem; margin-bottom: 10px;">${item.response}</div>
      <div style="text-align: right;">
        <button class="secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="deleteLibItem(${item.id})">Smazat</button>
      </div>
    `;
    container.appendChild(card);
  });
}

window.deleteLibItem = async (id) => {
  if (confirm('Opravdu smazat tuto položku?')) {
    await window.appDb.deleteLibraryItem(id);
    renderLibrary();
  }
};

// --- Paměť ---
function setupMemory() {
  document.getElementById('btnSaveMemory').addEventListener('click', async () => {
    const input = document.getElementById('memFactInput');
    const fact = input.value.trim();
    if (!fact) return;

    await window.appDb.saveMemoryItem({ fact, type: 'fact' });
    input.value = '';
    renderMemory();
  });
}

async function renderMemory() {
  const container = document.getElementById('memoryList');
  container.innerHTML = '';
  const items = await window.appDb.getAllMemory();

  if (items.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px;">Zatím žádné vzpomínky.</p>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.innerHTML = `
      <span>${item.fact}</span>
      <button class="secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteMemItem(${item.id})">✕</button>
    `;
    container.appendChild(card);
  });
}

window.deleteMemItem = async (id) => {
  await window.appDb.deleteMemoryItem(id);
  renderMemory();
};

// --- Nastavení UI ---
function setupSettingsUI() {
  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const newName = document.getElementById('settingNameInput').value.trim();
    const newNick = document.getElementById('settingUserNick').value.trim();

    if (newName) {
      currentName = newName;
      await window.appDb.setSetting('companionName', currentName);
      updateNameUI(currentName);
    }
    if (newNick) {
      await window.appDb.setSetting('userNick', newNick);
    }
    alert('Nastavení uloženo.');
  });

  const btnPwa = document.getElementById('btnInstallPwa');
  btnPwa.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt = null;
      btnPwa.style.display = 'none';
    }
  });
}
