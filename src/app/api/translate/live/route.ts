import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";

export const LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";

const LANGS = new Set(["km", "en"]);

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
    const body = (await request.json()) as { targetLang?: string };
    const targetLang = LANGS.has(body.targetLang ?? "")
      ? body.targetLang!
      : "km";
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 2 * 60 * 1000
    ).toISOString();

    const payloads = [
      {
        uses: 5,
        expireTime,
        newSessionExpireTime,
      },
      {
        uses: 5,
        expireTime,
        newSessionExpireTime,
        live_connect_constraints: {
          model: `models/${LIVE_TRANSLATE_MODEL}`,
          config: {
            response_modalities: ["AUDIO"],
            input_audio_transcription: {},
            output_audio_transcription: {},
            translation_config: {
              target_language_code: targetLang,
              echo_target_language: true,
            },
          },
        },
      },
    ];

    let data: { name?: string; error?: { message?: string } } | null = null;
    let res: Response | null = null;
    for (const version of ["v1alpha", "v1beta"] as const) {
      for (const payload of payloads) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/${version}/auth_tokens`,
          {
            method: "POST",
            headers: {
              "x-goog-api-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        data = (await res.json()) as {
          name?: string;
          error?: { message?: string };
        };
        if (res.ok && data.name) break;
      }
      if (res?.ok && data?.name) break;
    }

    if (!res?.ok || !data?.name) {
      console.error("Gemini live token failed:", data);
      return NextResponse.json(
        { error: "live_token_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      token: data.name,
      model: LIVE_TRANSLATE_MODEL,
      targetLang,
    });
  } catch (error) {
    console.error("Gemini live token failed:", error);
    return NextResponse.json({ error: "live_token_failed" }, { status: 502 });
  }
}
