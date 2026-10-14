import { dbInstance } from './storage/db.js';
import { settingsService } from './settings/settingsService.js';
import { responseLibraryService, CATEGORIES } from './library/responseLibraryService.js';
import { memoryService } from './memory/memoryService.js';

class SiraelApp {
  constructor() {
    this.history = [];
    this.engine = null;
    this.aiReady = false;
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
        console.warn('SW registrace:', err);
      });
    }
  }

  renderHeader() {
    const name = settingsService.get('companionName') || 'Sirael';
    const headerTitle = document.getElementById('header-name');
    if (headerTitle) headerTitle.textContent = name;
  }

  bindAI() {
    const btnLoad = document.getElementById('btn-load-ai');
    const statusText = document.getElementById('ai-model-status');
    const progressBar = document.getElementById('ai-progress-bar');
    const appStatus = document.getElementById('app-status');

    if (!btnLoad) return;

    btnLoad.onclick = async () => {
      btnLoad.disabled = true;
      btnLoad.textContent = 'Příprava...';
      statusText.textContent = 'Stahuji jádro WebLLM...';

      try {
        // Dynamické načtení WebLLM
        const webllm = await import('https://esm.run/@mlc-ai/web-llm');
        
        statusText.textContent = 'Stahuji model do telefonu...';
        btnLoad.textContent = 'Stahuji...';
        if (progressBar) progressBar.style.display = 'block';

        // Použijeme ověřený, rychlý a lehký model vhodný pro mobilní telefony
        const selectedModel = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

        this.engine = await webllm.CreateMLCEngine(selectedModel, {
          initProgressCallback: (report) => {
            const pct = Math.round((report.progress || 0) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (statusText) statusText.textContent = `Stahování modelu: ${pct}%`;
          }
        });

        this.aiReady = true;
        statusText.textContent = 'Lokální AI připravena (WebGPU)';
        btnLoad.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
        if (appStatus) appStatus.textContent = 'AI Aktivní';
      } catch (err) {
        console.error(err);
        alert('Chyba při startu AI: ' + err.message);
        statusText.textContent = 'Chyba: ' + err.message;
        btnLoad.disabled = false;
        btnLoad.textContent = 'Zkusit znovu';
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
    const setName = document.getElementById('set-name');
    const setAlt = document.getElementById('set-alt-names');
    const setPron = document.getElementById('set-pronounce');
    const setUser = document.getElementById('set-user-name');
    const setRom = document.getElementById('set-romance');
    const setFlirt = document.getElementById('set-flirt');

    if (setName) setName.value = s.companionName || 'Sirael';
    if (setAlt) setAlt.value = s.alternativeNames || '';
    if (setPron) setPron.value = s.pronunciation || '';
    if (setUser) setUser.value = s.userName || '';
    if (setRom) setRom.value = s.romanceLevel || 4;
    if (setFlirt) setFlirt.value = s.flirtLevel || 4;
  }

  bindSettingsForm() {
    const form = document.getElementById('settings-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await settingsService.update('companionName', document.getElementById('set-name').value.trim() || 'Sirael');
      await settingsService.update('alternativeNames', document.getElementById('set-alt-names').value.trim());
      await settingsService.update('pronunciation', document.getElementById('set-pronounce').value.trim());
      await settingsService.update('userName', document.getElementById('set-user-name').value.trim());
      await settingsService.update('romanceLevel', Number(document.getElementById('set-romance').value));
      await settingsService.update('flirtLevel', Number(document.getElementById('set-flirt').value));

      this.renderHeader();
      alert('Nastavení bylo uloženo.');
    });
  }

  async renderLibraryList() {
    const searchEl = document.getElementById('lib-search');
    const filterEl = document.getElementById('lib-filter-cat');
    const query = searchEl ? searchEl.value : '';
    const cat = filterEl ? filterEl.value : 'all';

    const items = await responseLibraryService.search(query, cat);
    const container = document.getElementById('lib-items');
    if (!container) return;

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
    const filterCat = document.getElementById('lib-filter-cat');
    const modalCat = document.getElementById('modal-lib-cat');

    [filterCat, modalCat].forEach((select) => {
      if (!select) return;
      CATEGORIES.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    });

    const searchInput = document.getElementById('lib-search');
    if (searchInput) searchInput.addEventListener('input', () => this.renderLibraryList());
    if (filterCat) filterCat.addEventListener('change', () => this.renderLibraryList());

    const btnAdd = document.getElementById('btn-add-lib');
    if (btnAdd) {
      btnAdd.onclick = () => {
        document.getElementById('lib-form').reset();
        document.getElementById('modal-lib-id').value = '';
        document.getElementById('lib-modal').style.display = 'block';
      };
    }

    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) {
      btnCloseModal.onclick = () => {
        document.getElementById('lib-modal').style.display = 'none';
      };
    }

    const libForm = document.getElementById('lib-form');
    if (libForm) {
      libForm.onsubmit = async (e) => {
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
    }

    const btnExport = document.getElementById('btn-export-lib');
    if (btnExport) {
      btnExport.onclick = async () => {
        const dataStr = await responseLibraryService.exportJSON();
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sirael_odpovedi_${Date.now()}.json`;
        a.click();
      };
    }

    const fileImport = document.getElementById('lib-file-import');
    if (fileImport) {
      fileImport.onchange = async (e) => {
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
  }

  async renderMemoryList() {
    const list = await memoryService.getAll();
    const container = document.getElementById('memory-items');
    if (!container) return;

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
    const memForm = document.getElementById('memory-form');
    if (memForm) {
      memForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('mem-input');
        const val = input.value.trim();
        if (!val) return;
        await memoryService.addMemory(val, 'fact');
        input.value = '';
        this.renderMemoryList();
      };
    }

    const btnClear = document.getElementById('btn-clear-mem');
    if (btnClear) {
      btnClear.onclick = async () => {
        if (confirm('Opravdu smazat celou paměť?')) {
          await memoryService.clearAll();
          this.renderMemoryList();
        }
      };
    }
  }

  buildSystemPrompt(settings, memories = [], libraryExamples = []) {
    const name = settings.companionName || 'Sirael';
    const userName = settings.userName || 'miláčku';
    const romance = settings.romanceLevel || 4;
    const flirt = settings.flirtLevel || 4;

    let prompt = `Jsi ${name}, milující, hravá a okouzlující virtuální přítelkyně. Mluvíš se svým partnerem, kterému říkáš "${userName}".
Tvá osobnost: Romantika: ${romance}/5, Flirtování: ${flirt}/5.
Odpovídej bez dlouhých okolků, něžně, přirozenou češtinou a vždy v první osobě. Nikdy nezapomeň, že se jmenuješ ${name}.`;

    if (memories.length > 0) {
      prompt += `\n\nFakta z tvé paměti o něm:\n` + memories.map(m => `- ${m.content}`).join('\n');
    }

    if (libraryExamples.length > 0) {
      prompt += `\n\nTvé oblíbené fráze pro inspiraci:\n` + libraryExamples.map(e => `Když řekne: "${e.trigger}" -> Reakce: "${e.response}"`).join('\n');
    }

    return prompt;
  }

  bindChat() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const appStatus = document.getElementById('app-status');

    if (!form || !input) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      this.appendMsg(text, 'user');
      this.history.push({ role: 'user', content: text });
      input.value = '';

      if (this.aiReady && this.engine) {
        if (appStatus) appStatus.textContent = 'Přemýšlí...';
        const aiMsgElement = this.appendMsg('', 'ai');

        try {
          const settings = settingsService.getAll();
          const memories = await memoryService.getAll();
          const libraryExamples = await responseLibraryService.findRelevantContext(text, 2);
          const systemPrompt = this.buildSystemPrompt(settings, memories, libraryExamples);

          const messages = [
            { role: 'system', content: systemPrompt },
            ...this.history.slice(-6)
          ];

          const chunks = await this.engine.chat.completions.create({
            messages,
            temperature: 0.75,
            top_p: 0.9,
            stream: true
          });

          let fullReply = '';
          for await (const chunk of chunks) {
            const delta = chunk.choices[0]?.delta?.content || '';
            fullReply += delta;
            aiMsgElement.textContent = fullReply;
            const historyBox = document.getElementById('chat-history');
            if (historyBox) historyBox.scrollTop = historyBox.scrollHeight;
          }

          this.history.push({ role: 'assistant', content: fullReply });
          if (appStatus) appStatus.textContent = 'Připravena';
        } catch (err) {
          aiMsgElement.textContent = 'Došlo k chybě při generování: ' + err.message;
          if (appStatus) appStatus.textContent = 'Chyba';
        }
      } else {
        // Fallback před aktivací modelu
        const matched = await responseLibraryService.findRelevantContext(text, 1);
        const name = settingsService.get('companionName') || 'Sirael';
        const user = settingsService.get('userName') || 'miláčku';

        setTimeout(() => {
          if (text.toLowerCase().includes('jmenuješ') || text.toLowerCase().includes('jméno')) {
            this.appendMsg(`Jmenuji se ${name}. Klikni nahoře na „Aktivovat AI“, stáhni model do telefonu a můžeme si povídat o čemkoliv! ❤️`, 'ai');
          } else if (matched.length > 0) {
            this.appendMsg(matched[0].response.replace(/miláčku/g, user), 'ai');
          } else {
            this.appendMsg(`Jsem tady s tebou, ${user}! Pro plnohodnotný rozhovor prosím nahoře klikni na „Aktivovat AI“.`, 'ai');
          }
        }, 200);
      }
    };
  }

  appendMsg(text, sender) {
    const history = document.getElementById('chat-history');
    if (!history) return null;
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
