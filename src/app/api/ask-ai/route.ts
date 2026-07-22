// 出題中の例文についてAIに質問するAPI（OpenAI APIはサーバー側でのみ呼び出す）
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

interface AskAiContext {
  ipa: string;
  jaIpa: string | null;
  enIpa: string | null;
  koText: string;
  jaText: string;
  enText: string | null;
}

interface AskAiRequestBody {
  question: string;
  studyItemId: string;
  context: AskAiContext;
}

const SYSTEM_PROMPT = `あなたは韓国語の発音・音韻を日本語話者に説明する講師です。IPA記法を使い、簡潔に答えてください。表示中の例文の情報を文脈として与えます。
6. 文法の説明で確信が持てない事項は断定せず、「〜という説明が一般的です」のような表現にとどめる。不正確な断定は学習者に深刻な害を与えるため、正確さを簡潔さより優先する
7. 発音・音韻に関する質問を最優先で丁寧に答える。高度な文法理論や語源の推測には深入りせず、必要なら「この点は教科書等での確認を勧めます」と添える`;

function isAskAiRequestBody(value: unknown): value is AskAiRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (typeof body.question !== "string" || body.question.trim() === "") return false;
  if (typeof body.studyItemId !== "string" || body.studyItemId.trim() === "") return false;
  if (typeof body.context !== "object" || body.context === null) return false;
  const context = body.context as Record<string, unknown>;
  return (
    typeof context.ipa === "string" &&
    typeof context.koText === "string" &&
    (typeof context.jaText === "string" || context.jaText === null || context.jaText === undefined)
  );
}

function buildContextText(context: AskAiContext): string {
  const lines = [
    `韓国語: ${context.koText}`,
    `IPA: ${context.ipa}`,
    context.jaIpa ? `日本語IPA: ${context.jaIpa}` : null,
    context.enIpa ? `英語IPA: ${context.enIpa}` : null,
    `日本語訳: ${context.jaText}`,
    context.enText ? `英語訳: ${context.enText}` : null,
  ].filter((line): line is string => line !== null);

  return `【表示中の例文】\n${lines.join("\n")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isAskAiRequestBody(body)) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI機能が設定されていません。" },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey });

  let answer: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${buildContextText(body.context)}\n\n【質問】\n${body.question}`,
        },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("empty response");
    }
    answer = content;
  } catch {
    return NextResponse.json(
      { error: "AIへの問い合わせに失敗しました。" },
      { status: 502 }
    );
  }

  const { error: insertError } = await supabase.from("ai_questions").insert({
    user_id: user.id,
    study_item_id: body.studyItemId,
    question: body.question,
    answer,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "回答の保存に失敗しました。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ answer });
}
