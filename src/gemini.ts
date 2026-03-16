import { type GenerateContentResponse, GoogleGenAI } from "@google/genai";

type ExtractVideoResult =
  | { readonly isOk: true; readonly content: string }
  | {
      readonly isOk: false;
      readonly errorCode: "NO_API_KEY" | "INVALID_URL" | "API_ERROR";
      readonly message: string;
    };

export type { ExtractVideoResult };

export const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+$/;

const EXTRACTION_PROMPT = `この動画からDCCツールの操作手順を構造化して抽出してください。
以下の形式で出力:
- 使用アプリケーション名
- 成果物の概要と学べるテクニックの概要
- 操作手順（箇条書き、メニューパスを明示）
- ショートカットキー（あれば）
- 表現技法のポイント`;

export async function extractVideoContent(youtubeUrl: string): Promise<ExtractVideoResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { isOk: false, errorCode: "NO_API_KEY", message: "GEMINI_API_KEY is not set in .env" };
  }

  if (!YOUTUBE_URL_PATTERN.test(youtubeUrl)) {
    return { isOk: false, errorCode: "INVALID_URL", message: `Invalid YouTube URL: ${youtubeUrl}` };
  }

  const ai = new GoogleGenAI({ apiKey });

  let response: GenerateContentResponse;
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: youtubeUrl, mimeType: "video/mp4" } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isOk: false, errorCode: "API_ERROR" as const, message };
  }

  const text = response.text;
  if (!text || text.trim().length === 0) {
    return { isOk: false, errorCode: "API_ERROR", message: "Gemini returned empty response" };
  }

  return { isOk: true, content: text };
}
