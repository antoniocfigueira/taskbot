import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY não está definida no .env');
  process.exit(1);
}

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const MODEL = 'gemini-3-flash-preview';

export async function generate(userPrompt, options = {}) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: options.config || {}
  });
  return response.candidates[0].content.parts[0].text;
}

export async function generateJSON(userPrompt, jsonSchema, options = {}) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema,
      ...options.config
    }
  });
  return JSON.parse(response.candidates[0].content.parts[0].text);
}

export function cleanJSON(text) {
  return text.replace(/```json\n?|```/g, '').trim();
}
