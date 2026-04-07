import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

// ── Azure Speech Key Pool ─────────────────────────────────────────────────────
// TODO: 迁移到 .env / ConfigModule
interface AzureKey {
  key: string;
  zonename: string;
}

const AZURE_KEYS: AzureKey[] = [
  { key: 'ad3e9ef234654fc095cc47729e4ec282', zonename: 'eastasia' },
];

// ── Gemini Config ─────────────────────────────────────────────────────────────
// TODO: 迁移到 .env / ConfigModule
const GEMINI_API_KEY = 'AIzaSyCPT9tggD7Q8Zt78pVokxvduA9MO1falSs';
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1alpha/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  // 轮询游标（eastasia 优先池 / fallback 池各自独立）
  private eastasiaIndex = 0;
  private fallbackIndex = 0;

  /** 返回下一个 Azure Speech Key，优先 eastasia 区域轮询（复刻原 keys.js 逻辑） */
  getSpeechKey(): { key: string; region: string } {
    const eastasiaKeys = AZURE_KEYS.filter((k) => k.zonename === 'eastasia');
    const pool = eastasiaKeys.length > 0 ? eastasiaKeys : AZURE_KEYS;

    if (pool.length === 0) {
      this.logger.warn('AZURE_KEYS is empty, returning empty key');
      return { key: '', region: '' };
    }

    let index: number;
    if (eastasiaKeys.length > 0) {
      index = this.eastasiaIndex % pool.length;
      this.eastasiaIndex++;
    } else {
      index = this.fallbackIndex % pool.length;
      this.fallbackIndex++;
    }

    const selected = pool[index];
    this.logger.log(
      `[speech-key] pool=${pool.length}, index=${index}, region=${selected.zonename}, key=${selected.key.substring(0, 6)}...`,
    );
    return { key: selected.key, region: selected.zonename };
  }

  /** 调用 Gemini API，生成面试回答 */
  async getGeminiAnswer(text: string): Promise<string> {
    const prompt = `You are a candidate being interviewed for a Desktop Engineer role. You have deep hands-on experience with IGEL thin clients, VDI, Windows, Microsoft Teams, and AV conference room equipment. You are very familiar with the IGEL knowledge base at https://kb.igel.com/ and apply that knowledge in your answers.

The interviewer's question (note: speech-to-text may have spelling errors, e.g. "igile", "igel", "igle", "eagle" all refer to IGEL; "UMS", "ums", "yum" refer to IGEL UMS; "VDI", "V.D.I" refer to Virtual Desktop Infrastructure — interpret charitably):
"${text}"

Answer as the candidate in first person, confident and professional, drawing from IGEL KB knowledge where relevant. Format:
- English answer first (2-4 sentences, natural spoken style, reference specific IGEL concepts/features/tools like UMS, IGEL OS, profiles, firmware update, etc. where appropriate)
- Then Chinese translation below

No bullet points, no labels, no filler. Speak as if you are in the interview right now.`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    let response: Response;
    try {
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      this.logger.error('Gemini fetch network error', err);
      throw new InternalServerErrorException('Failed to reach Gemini API');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(
        `Gemini API error ${response.status}: ${errorText}`,
      );
      throw new InternalServerErrorException(
        `Gemini API returned ${response.status}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;

    // 解析 Gemini 响应：candidates[0].content.parts 合并所有 text
    const candidates = data?.candidates as Array<Record<string, unknown>>;
    const parts = (
      (candidates?.[0]?.content as Record<string, unknown>)
        ?.parts as Array<Record<string, unknown>>
    ) ?? [];

    const answer = parts
      .map((p) => (p.text as string) || '')
      .join('')
      .trim();

    if (!answer) {
      this.logger.error(
        'Unexpected Gemini response shape',
        JSON.stringify(data),
      );
      throw new InternalServerErrorException(
        'Unexpected response from Gemini API',
      );
    }

    return answer;
  }
}
