import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";

const LANGS: Record<string, string> = {
  km: "Khmer (Cambodian)",
  en: "English",
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as {
      text?: string;
      targetLang?: string;
    };
    const text = body.text?.trim() ?? "";
    const targetLang = LANGS[body.targetLang ?? "km"] ? body.targetLang! : "km";
    if (!text) {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }
    if (text.length > 8000) {
      return NextResponse.json({ error: "text_too_long" }, { status: 400 });
    }

    const targetName = LANGS[targetLang];
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                `Translate the following text into natural ${targetName}.`,
                "Return only the translation. No quotes, no notes, no language labels.",
                "",
                text,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const translation = result.response.text().trim();
    if (!translation) {
      return NextResponse.json({ error: "empty_translation" }, { status: 502 });
    }

    return NextResponse.json({ translation, targetLang });
  } catch (error) {
    console.error("Gemini translate failed:", error);
    return NextResponse.json({ error: "translate_failed" }, { status: 502 });
  }
}
