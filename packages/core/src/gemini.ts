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
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]+([?&][a-zA-Z0-9_=-]*)*$/;

const EXTRACTION_PROMPT = `この動画からDCCツールの操作手順を構造化して抽出してください。
以下の形式で出力:

## 基本情報
- 使用アプリケーション名（バージョンがわかれば併記）
- 対象レベル: 初心者 / 中級者 / 上級者
- 前提条件（必要なプラグイン、素材、事前設定など）

## 概要
- 成果物の概要と学べるテクニックの概要

## 操作手順
- 操作手順（箇条書き、メニューパスを明示）
- 各ステップで使用するパラメータ値があれば明記

## ショートカットキー
- ショートカットキー（あれば）

## 表現技法のポイント
- 表現技法のポイント
- なぜその技法を使うのか（意図・効果）`;

export async function extractVideoContent(youtubeUrl: string): Promise<ExtractVideoResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { isOk: false, errorCode: "NO_API_KEY", message: "GEMINI_API_KEY is not set in .env" };
  }

  if (!YOUTUBE_URL_PATTERN.test(youtubeUrl)) {
    return { isOk: false, errorCode: "INVALID_URL", message: `Invalid YouTube URL: ${youtubeUrl}` };
  }

  const ai = new GoogleGenAI({ apiKey });

  const GEMINI_TIMEOUT_MS = 180_000;

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
      config: {
        httpOptions: { timeout: GEMINI_TIMEOUT_MS },
      },
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
