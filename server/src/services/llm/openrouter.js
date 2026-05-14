const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const JSON_FENCE = /```(?:json)?\s*(\{.*?\})\s*```/s;

function coerceToPlanJson(text) {
  text = text.trim();
  let candidate = text;
  const m = JSON_FENCE.exec(text);
  if (m) {
    candidate = m[1];
  } else {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      candidate = text.slice(first, last + 1);
    }
  }
  try {
    const data = JSON.parse(candidate);
    data.recommendations = data.recommendations || [];
    data.plan_steps = data.plan_steps || [];
    data.companion_materials = data.companion_materials || [];
    return data;
  } catch {
    return {
      recommendations: [{ title: "Model returned malformed JSON", body: text.slice(0, 600), tag: "other", sources: [] }],
      plan_steps: [],
      companion_materials: [],
    };
  }
}

class OpenRouterProvider {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
    this.name = "openrouter";
  }

  async generate({ system, user, maxTokens = 4096 }) {
    const res = await fetch(OPENROUTER_BASE, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ADAPT",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${error}`);
    }

    const data = await res.json();
    return {
      text: data.choices[0].message.content,
      model: this.model,
      provider: this.name,
      tokenCount: data.usage?.total_tokens,
      raw: data,
    };
  }

  async ping() {
    try {
      await this.generate({ system: "Reply OK", user: "ping", maxTokens: 8 });
      return [true, null];
    } catch (e) {
      return [false, e.message];
    }
  }
}

module.exports = { OpenRouterProvider, coerceToPlanJson };
