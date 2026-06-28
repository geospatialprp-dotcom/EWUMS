import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeSnippet } from './jal-mitra-knowledge.service';
import { JalMitraLang } from './jal-mitra-i18n';
import { JalMitraIntent } from './jal-mitra-intent.util';

export type LlmReplyInput = {
  userText: string;
  language: JalMitraLang;
  kbSnippets: KnowledgeSnippet[];
  recentMessages: Array<{ role: string; content: string }>;
  consumerName?: string | null;
  intent?: JalMitraIntent;
};

export type LlmReplyResult = {
  content: string;
  source: 'openai' | 'rag' | 'none';
  kbArticleIds: string[];
};

@Injectable()
export class JalMitraLlmService {
  private readonly logger = new Logger(JalMitraLlmService.name);

  constructor(private config: ConfigService) {}

  isLive(): boolean {
    const mode = this.config.get<string>('JAL_MITRA_LLM_MODE', 'auto').toLowerCase();
    const hasKey = Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
    if (mode === 'off') return false;
    if (mode === 'live') return hasKey;
    return hasKey;
  }

  async generateReply(input: LlmReplyInput): Promise<LlmReplyResult | null> {
    const isLocal = input.language === 'garhwali' || input.language === 'kumaoni';
    if (!input.kbSnippets.length && !this.isLive() && !isLocal) return null;

    if (this.isLive()) {
      try {
        const content = await this.callOpenAi(input);
        if (content) {
          return {
            content,
            source: 'openai',
            kbArticleIds: input.kbSnippets.map((s) => s.id),
          };
        }
      } catch (err) {
        this.logger.warn(`OpenAI call failed, using RAG fallback: ${(err as Error).message}`);
      }
    }

    if (isLocal && !input.kbSnippets.length) {
      return null;
    }

    if (input.kbSnippets.length) {
      return {
        content: this.synthesizeFromKb(input),
        source: 'rag',
        kbArticleIds: input.kbSnippets.map((s) => s.id),
      };
    }

    return null;
  }

  private synthesizeFromKb(input: LlmReplyInput): string {
    const top = input.kbSnippets[0];
    const answerIntro = {
      en: 'As per your question:',
      hi: 'आपके प्रश्न के अनुसार:',
      garhwali: 'तुमारा सवाल मुताबिक:',
      kumaoni: 'तुमारा सवाल मुताबिक:',
    }[input.language];
    return `${answerIntro}\n\n${top.content}`;
  }

  private async callOpenAi(input: LlmReplyInput): Promise<string | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) return null;

    const model = this.config.get<string>('OPENAI_CHAT_MODEL', 'gpt-4o-mini');

    const kbBlock = input.kbSnippets.length
      ? `Knowledge base:\n${input.kbSnippets.map((s) => `- ${s.title}: ${s.content}`).join('\n')}`
      : 'No knowledge base articles matched.';

    const history = input.recentMessages
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const langInstructions = {
      en: 'Reply in simple Indian English (en-IN style). Use polite phrasing like "kindly", "as of now", "one officer", "how may I help". Keep Namaste where natural. Avoid American slang.',
      hi: 'Reply in simple Hindi (Devanagari). Do not use English unless for FHTC/OTP terms.',
      garhwali: `Reply ONLY in authentic Garhwali dialect (Devanagari). Use words like मेरो, तुमारो, पाणी, कै, छै, हो ग्यो, बोलूँल, चाहिय, कू, मां.
Do NOT reply in standard Hindi or English except FHTC/OTP/helpline numbers.`,
      kumaoni: `Reply ONLY in authentic Kumaoni dialect (Devanagari). Use words like मेरो, तुमार, पाणी, की, भयो, बताउ, बोलूँल, चाह, कू, मां.
Do NOT reply in standard Hindi or English except FHTC/OTP/helpline numbers.`,
    }[input.language];

    const system = `You are Jal Mitra, a friendly virtual water supply assistant for Uttarakhand Jal Sansthan (UJS).
${langInstructions}
Answer ONLY the consumer's specific question below. Stay on topic — do not change subject.
If the question is about bills, complaints, supply timing, tariff, or connection, answer that topic only.
Use the knowledge base when relevant. If the knowledge base does not cover the question, say you are not sure and suggest contacting the division office or using a quick action button.
Do not invent bill amounts, complaint numbers, or policies.`;

    const user = `${kbBlock}\n\nRecent chat:\n${history || '(none)'}\n\nConsumer question (answer this only): ${input.userText}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }
}
