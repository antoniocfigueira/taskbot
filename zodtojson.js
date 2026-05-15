import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import 'dotenv/config';

export const clickupTaskSchema = z.object({
  name: z.string().describe('Um título curto e profissional para a tarefa.'),
  description: z.string().describe('Um resumo detalhado do que precisa ser feito.'),
  priority: z.enum(['Urgente', 'Alta', 'Normal', 'Baixa']).describe('Nível de prioridade: (Urgente), (Alta), (Normal), (Baixa).'),
  tags: z.array(z.string()).describe('Lista de categorias/etiquetas relevantes (ex: bug, feature, design).'),
  estimated_hours: z.number().optional().describe('Estimativa de tempo em horas, se mencionada.')
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseWithSchema(rawUserRequest, schema = clickupTaskSchema) {
  const prompt = `Analisa o seguinte pedido e extrai as informações necessárias para criar uma tarefa.
Pedido: "${rawUserRequest}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: zodToJsonSchema(schema)
    }
  });

  const text = response.candidates[0].content.parts[0].text;
  return schema.parse(JSON.parse(text));
}
