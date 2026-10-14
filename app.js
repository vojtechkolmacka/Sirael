import { dbInstance } from './storage/db.js';
import { settingsService } from './settings/settingsService.js';
import { responseLibraryService, CATEGORIES } from './library/responseLibraryService.js';
import { memoryService } from './memory/memoryService.js';
import { aiService } from './ai/aiService.js';

class SiraelApp {
  constructor() {
    this.history = [];
  }

  async init() {
    await dbInstance.init();
    await settingsService.load();
    await responseLibraryService.initDefaultItem();

    this.registerServiceWorker();
    this.renderHeader();
    this.bindNavigation();
    this.bindSettingsForm();
    this.bindLibrary();
    this.bindMemory();
    this.bindAI();
    this.bindChat();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('SW registrace selhala:', err);
      });
    }
  }

  renderHeader() {
    const name = settingsService.get('companionName');
    document.getElementById('header-name').textContent = name;
  }

  bindAI() {
    const btnLoad = document.getElementById('btn-load-ai');
    const statusText = document.getElementById('ai-model-status');
    const progressBar = document.getElementById('ai-progress-bar');
    const appStatus = document.getElementById('app-status');

    btnLoad.onclick = async () => {
      const gpu = await aiService.checkWebGPUSupport();
      if (!gpu.supported) {
        alert('WebGPU není v tomto prohlížeči dostupné: ' + gpu.reason);
        return;
      }

      btnLoad.disabled = true;
      btnLoad.textContent = 'Stahuji...';
      progressBar.style.display = 'block';

      try {
        await aiService.initModel((report) => {
          const pct = Math.round((report.progress || 0) * 100);
          progressBar.style.width = `${pct}%`;
          statusText.textContent = `Příprava AI: ${pct}%`;
        });

        statusText.textContent = 'Lokální AI připravena (WebGPU)';
        btnLoad.style.display = 'none';
        progressBar.style.display = 'none';
        appStatus.textContent = 'Aktivní (Lokální AI)';
      } catch (err) {
        statusText.textContent = 'Chyba načítání AI';
        btnLoad.disabled = false;
        btnLoad.textContent = 'Zkusit znovu';
        alert('Chyba při startu lokální AI: ' + err.message);
      }
    };
  }

  bindNavigation() {
    const buttons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.tab-view');

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        views.forEach((v) => v.classList.remove('active'));

        btn.classList.add('active');
        const targetView = document.getElementById(btn.dataset.target);
        if (targetView) targetView.classList.add('active');

        if (btn.dataset.target === 'view-library') this.renderLibraryList();
        if (btn.dataset.target === 'view-memory') this.renderMemoryList();
        if (btn.dataset.target === 'view-settings') this.fillSettingsForm();
      });
    });
  }

  fillSettingsForm() {
    const s = settingsService.getAll();
    document.getElementById('set-name').value = s.companionName;
    document.getElementById('set-alt-names').value = s.alternativeNames;
    document.getElementById('set-pronounce').value = s.pronunciation;
    document.getElementById('set-user-name').value = s.userName;
    document.getElementById('set-romance').value = s.romanceLevel;
    document.getElementById('set-flirt').value = s.flirtLevel;
  }

  bindSettingsForm() {
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await settingsService.update('companionName', document.getElementById('set-name').value.trim() || 'Sirael');
      await settingsService.update('alternativeNames', document.getElementById('set-alt-names').value.trim());
      await settingsService.update('pronunciation', document.getElementById('set-pronounce').value.trim());
      await settingsService.update('userName', document.getElementById('set-user-name').value.trim());
      await settingsService.update('romanceLevel', Number(document.getElementById('set-romance').value));
      await settingsService.update('flirtLevel', Number(document.getElementById('set-flirt').value));

      this.renderHeader();
      alert('Nastavení uloženo.');
    });
  }

  async renderLibraryList() {
    const query = document.getElementById('lib-search').value;
    const cat = document.getElementById('lib-filter-cat').value;
    const items = await responseLibraryService.search(query, cat);
    const container = document.getElementById('lib-items');

    container.innerHTML = items.length === 0 
      ? '<p style="color:var(--text-dim); text-align:center; padding:20px;">Žádné odpovědi nenalezeny.</p>'
      : items.map((item) => `
        <div class="card" data-id="${item.id}">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <strong>${item.title}</strong>
            <span class="badge">${item.category}</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-dim); margin-bottom:6px;">⚡ ${item.trigger}</p>
          <p style="font-size:0.95rem; margin-bottom:8px;">${item.response}</p>
          <div class="btn-group">
            <button class="btn btn-secondary btn-sm edit-lib" data-id="${item.id}">Upravit</button>
            <button class="btn btn-danger btn-sm del-lib" data-id="${item.id}">Smazat</button>
          </div>
        </div>
      `).join('');

    container.querySelectorAll('.del-lib').forEach((b) => {
      b.onclick = async () => {
        if (confirm('Opravdu smazat tuto odpověď?')) {
          await responseLibraryService.deleteItem(b.dataset.id);
          this.renderLibraryList();
        }
      };
    });

    container.querySelectorAll('.edit-lib').forEach((b) => {
      b.onclick = async () => {
        const item = (await responseLibraryService.getAll()).find((i) => i.id == b.dataset.id);
        if (!item) return;
        document.getElementById('modal-lib-id').value = item.id;
        document.getElementById('modal-lib-title').value = item.title;
        document.getElementById('modal-lib-trigger').value = item.trigger;
        document.getElementById('modal-lib-response').value = item.response;
        document.getElementById('modal-lib-cat').value = item.category;
        document.getElementById('modal-lib-tags').value = item.tags || '';
        document.getElementById('modal-lib-variants').value = (item.variants || []).join('\n');
        document.getElementById('lib-modal').style.display = 'block';
      };
    });
  }

  bindLibrary() {
    const catSelects = [document.getElementById('lib-filter-cat'), document.getElementById('modal-lib-cat')];
    catSelects.forEach((select) => {
      CATEGORIES.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    });

    document.getElementById('lib-search').addEventListener('input', () => this.renderLibraryList());
    document.getElementById('lib-filter-cat').addEventListener('change', () => this.renderLibraryList());

    document.getElementById('btn-add-lib').onclick = () => {
      document.getElementById('lib-form').reset();
      document.getElementById('modal-lib-id').value = '';
      document.getElementById('lib-modal').style.display = 'block';
    };

    document.getElementById('btn-close-modal').onclick = () => {
      document.getElementById('lib-modal').style.display = 'none';
    };

    document.getElementById('lib-form').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('modal-lib-id').value;
      const data = {
        title: document.getElementById('modal-lib-title').value.trim(),
        trigger: document.getElementById('modal-lib-trigger').value.trim(),
        response: document.getElementById('modal-lib-response').value.trim(),
        category: document.getElementById('modal-lib-cat').value,
        tags: document.getElementById('modal-lib-tags').value.trim(),
        variants: document.getElementById('modal-lib-variants').value
      };

      if (id) {
        await responseLibraryService.updateItem({ ...data, id: Number(id) });
      } else {
        await responseLibraryService.addItem(data);
      }
      document.getElementById('lib-modal').style.display = 'none';
      this.renderLibraryList();
    };

    document.getElementById('btn-export-lib').onclick = async () => {
      const dataStr = await responseLibraryService.exportJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sirael_odpovedi_${Date.now()}.json`;
      a.click();
    };

    document.getElementById('lib-file-import').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const count = await responseLibraryService.importJSON(text);
        alert(`Úspěšně importováno ${count} nových odpovědí.`);
        this.renderLibraryList();
      } catch (err) {
        alert('Chyba při importu: ' + err.message);
      }
    };
  }

  async renderMemoryList() {
    const list = await memoryService.getAll();
    const container = document.getElementById('memory-items');
    container.innerHTML = list.length === 0
      ? '<p style="color:var(--text-dim); text-align:center; padding:20px;">Žádné vzpomínky zatím nejsou uloženy.</p>'
      : list.map((m) => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="badge">${m.type}</span>
            <span style="font-size:0.95rem;">${m.content}</span>
          </div>
          <button class="btn btn-danger btn-sm" style="width:auto; padding:4px 8px;" data-id="${m.id}">×</button>
        </div>
      `).join('');

    container.querySelectorAll('button').forEach((b) => {
      b.onclick = async () => {
        await memoryService.deleteMemory(b.dataset.id);
        this.renderMemoryList();
      };
    });
  }

  bindMemory() {
    document.getElementById('memory-form').onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('mem-input');
      const val = input.value.trim();
      if (!val) return;
      await memoryService.addMemory(val, 'fact');
      input.value = '';
      this.renderMemoryList();
    };

    document.getElementById('btn-clear-mem').onclick = async () => {
      if (confirm('Opravdu smazat celou paměť?')) {
        await memoryService.clearAll();
        this.renderMemoryList();
      }
    };
  }

  bindChat() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const appStatus = document.getElementById('app-status');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      this.appendMsg(text, 'user');
      this.history.push({ role: 'user', content: text });
      input.value = '';

      if (aiService.isReady) {
        appStatus.textContent = 'Přemýšlí...';
        const aiMsgElement = this.appendMsg('', 'ai');

        try {
          const settings = settingsService.getAll();
          const memories = await memoryService.getAll();
          const libraryExamples = await responseLibraryService.findRelevantContext(text, 2);

          const systemPrompt = aiService.buildSystemPrompt(settings, memories, libraryExamples);

          const fullReply = await aiService.generateResponse(
            this.history.slice(-6),
            systemPrompt,
            (delta, currentFull) => {
              aiMsgElement.textContent = currentFull;
              document.getElementById('chat-history').scrollTop = document.getElementById('chat-history').scrollHeight;
            }
          );

          this.history.push({ role: 'assistant', content: fullReply });
          appStatus.textContent = 'Připravena';
        } catch (err) {
          aiMsgElement.textContent = 'Došlo k chybě: ' + err.message;
          appStatus.textContent = 'Chyba';
        }
      } else {
        const matched = await responseLibraryService.findRelevantContext(text, 1);
        const name = settingsService.get('companionName');
        const user = settingsService.get('userName') || 'miláčku';

        setTimeout(() => {
          if (text.toLowerCase().includes('jmenuješ') || text.toLowerCase().includes('jméno')) {
            this.appendMsg(`Jmenuji se ${name}. Klikni nahoře na „Aktivovat AI“, ať si můžeme povídat úplně o všem bez šablon!`, 'ai');
          } else if (matched.length > 0) {
            this.appendMsg(matched[0].response.replace(/miláčku/g, user), 'ai');
          } else {
            this.appendMsg(`Jsem tady s tebou, ${user}! Aktivuj prosím nahoře tlačítkem lokální AI model pro volnou konverzaci.`, 'ai');
          }
        }, 200);
      }
    };
  }

  appendMsg(text, sender) {
    const history = document.getElementById('chat-history');
    const msg = document.createElement('div');
    msg.className = `msg ${sender}`;
    msg.textContent = text;
    history.appendChild(msg);
    history.scrollTop = history.scrollHeight;
    return msg;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new SiraelApp();
  app.init();
});
