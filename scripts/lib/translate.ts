import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

interface TranslateOptions {
    text: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
}

export async function translateWithClaude(options: TranslateOptions): Promise<string> {
    const { text, sourceLang, targetLang, context } = options;

    const prompt = `You are a professional medical translator specializing in Korean traditional medicine (Hanbang/Oriental Medicine).

${context ? `Context: ${context}\n\n` : ''}
Translate the following ${sourceLang} text to ${targetLang}. 

IMPORTANT GUIDELINES:
1. Preserve all HTML tags and markdown formatting exactly as they appear
2. For Korean traditional medicine terms:
   - 기혈 (Qi and Blood) → "Qi and Blood" in English, "気血" in Japanese, "气血" in Chinese
   - 음양 → "Yin and Yang" / "陰陽" / "阴阳"
   - 한약 → "Korean Herbal Medicine" / "韓方薬" / "韩药"
   - 침 → "Acupuncture" / "鍼" / "针灸"
   - 뜸 → "Moxibustion" / "灸" / "灸"
3. Maintain a professional, trustworthy tone suitable for a medical clinic website
4. Keep brand names, addresses, and phone numbers unchanged
5. For Chinese: use Simplified Chinese (简体中文)

Text to translate:
${text}

Return ONLY the translated text, preserving all formatting.`;

    const message = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    const content = message.content[0];
    if (content.type === "text") {
        return content.text;
    }

    throw new Error("Unexpected response format from Claude");
}

// Quick test
async function test() {
    const result = await translateWithClaude({
        text: "백록담한의원은 전통 한의학과 현대 의학을 결합한 통합 치료를 제공합니다.",
        sourceLang: "Korean",
        targetLang: "English",
        context: "Korean medicine clinic homepage introduction",
    });
    console.log(result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    test();
}
