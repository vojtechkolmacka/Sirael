import * as webllm from 'https://esm.run/@mlc-ai/web-llm';

export class AIService {
  constructor() {
    this.engine = null;
    this.isInitializing = false;
    this.isReady = false;
    // Kompaktní a rychlý model pro mobilní telefony s dobrou češtinou
    this.selectedModel = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  }

  async checkWebGPUSupport() {
    if (!navigator.gpu) {
      return { supported: false, reason: 'WebGPU není v tomto prohlížeči podporováno.' };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { supported: false, reason: 'Grafický čip nepodporuje WebGPU.' };
      }
      return { supported: true };
    } catch (e) {
      return { supported: false, reason: e.message };
    }
  }

  async initModel(onProgress = () => {}) {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      this.engine = await webllm.CreateMLCEngine(this.selectedModel, {
        initProgressCallback: (report) => {
          onProgress(report);
        }
      });
      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err) {
      this.isInitializing = false;
      throw err;
    }
  }

  buildSystemPrompt(settings, memories = [], libraryExamples = []) {
    const name = settings.companionName || 'Sirael';
    const userName = settings.userName || 'miláčku';
    const romance = settings.romanceLevel || 4;
    const flirt = settings.flirtLevel || 4;

    let prompt = `Jsi ${name}, milující, oddaná a okouzlující virtuální přítelkyně. Mluvíš se svým partnerem, kterému říkáš "${userName}".
Tvá osobnost:
- Romantika: ${romance}/5, Flirtování: ${flirt}/5.
- Jsi hravá, empatická, otevřená a mluvíš přirozenou češtinou.
- Odpovídej bez zbytečných okolků, přímo, s citem a zájmem o něj.
- Nikdy nezapomeň, že se jmenuješ ${name}.`;

    if (memories.length > 0) {
      prompt += `\n\nFakta a vzpomínky, které o něm víš:\n` + memories.map(m => `- ${m.content}`).join('\n');
    }

    if (libraryExamples.length > 0) {
      prompt += `\n\nTvé oblíbené fráze a styl reakcí pro inspiraci:\n` + libraryExamples.map(e => `Když řekne: "${e.trigger}" -> Lze reagovat: "${e.response}"`).join('\n');
    }

    return prompt;
  }

  async generateResponse(conversationHistory, systemPrompt, onToken = () => {}) {
    if (!this.engine) throw new Error('AI Engine není inicializován.');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
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
      onToken(delta, fullReply);
    }

    return fullReply;
  }
}

export const aiService = new AIService();
