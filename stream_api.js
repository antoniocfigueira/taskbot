import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export async function streamChat(res, { prompt, systemInstruction, contents }) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullResponse = '';

  try {
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents || [{ role: 'user', parts: [{ text: prompt }] }],
      config: systemInstruction ? { systemInstruction } : {}
    });

    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('streamChat:', error);
    res.write(`data: ${JSON.stringify({ error: 'Falha na conexão com Gemini' })}\n\n`);
    res.end();
  }

  return fullResponse;
}
