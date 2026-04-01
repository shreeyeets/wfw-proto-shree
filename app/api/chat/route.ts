import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { system, messages } = await req.json();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: system },
        ...messages,
      ],
    });

    return NextResponse.json({ content: completion.choices[0].message.content ?? '' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/chat]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
