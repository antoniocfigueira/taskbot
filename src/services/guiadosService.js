import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ai, MODEL, generate, generateJSON, cleanJSON } from './geminiService.js';
import { query } from './dbService.js';
import { streamChat } from '../../stream_api.js';

// =============== GUIADOS 01 ===============

// ex01 guiados 01
export async function createTaskFromText(text) {
  const prompt = `Transforma o texto numa tarefa JSON. Responde so com o JSON.
Texto: "${text}"
Formato: { "title": "...", "description": "...", "priority": "high|medium|low", "tags": ["..."] }`;
  return JSON.parse(cleanJSON(await generate(prompt)));
}

// ex02 guiados 01
export async function refineTask(task) {
  const prompt = `Melhora a tarefa abaixo. So JSON.
${JSON.stringify(task, null, 2)}
Formato: { "title": "...", "description": "...", "priority": "high|medium|low", "tags": ["..."] }`;
  return JSON.parse(cleanJSON(await generate(prompt)));
}

// ex03 guiados 01
export async function summarizeTask(text) {
  return (await generate(`Resume em uma frase curta (max 20 palavras), so a frase: "${text}"`)).trim();
}

// ex03 guiados 01
export async function suggestTags(text) {
  return JSON.parse(cleanJSON(await generate(`Sugere 3 a 5 tags em portugues. So um array JSON.
Tarefa: "${text}"`)));
}

// =============== GUIADOS 02 ===============

// ex01 guiados 02
export function createSystemPrompt() {
  return `Es o ClickBot, assistente de produtividade.
Responde em portugues de Portugal, direto e profissional.
Quando o utilizador pedir uma tarefa, devolve JSON estruturado.
Se nao souberes, diz que nao sabes.`;
}

// ex02 guiados 02
export async function classifyPriority(text) {
  const examples = [
    { role: 'user', parts: [{ text: 'site caiu' }] },
    { role: 'model', parts: [{ text: 'Alta' }] },
    { role: 'user', parts: [{ text: 'mudar botao' }] },
    { role: 'model', parts: [{ text: 'Media' }] },
    { role: 'user', parts: [{ text: 'trocar favicon' }] },
    { role: 'model', parts: [{ text: 'Baixa' }] }
  ];
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: [...examples, { role: 'user', parts: [{ text }] }],
    config: { systemInstruction: 'Classifica a prioridade em uma palavra: Alta, Media ou Baixa.' }
  });
  return r.candidates[0].content.parts[0].text.trim();
}

// ex03 guiados 02
export async function generateNames(temp) {
  return await generate('Da-me 5 nomes criativos para uma app de gestao de tarefas. Lista numerada.', { temperature: temp });
}

// ex04 guiados 02
export async function planSprint() {
  return await generate('Organiza um sprint de 5 dias para lancar uma landing page. Para cada dia: objetivo, tarefas, responsavel.');
}

// ex05 + ex06 guiados 02
const sessions = new Map();
function getSession(id = 'default') {
  if (!sessions.has(id)) sessions.set(id, { history: [], summary: '' });
  return sessions.get(id);
}

export async function sendMessage(message, sessionId = 'default') {
  const s = getSession(sessionId);
  s.history.push({ role: 'user', parts: [{ text: message }] });
  const window = s.history.slice(-5);
  const systemInstruction = s.summary ? `${createSystemPrompt()}\n\nResumo anterior: ${s.summary}` : createSystemPrompt();
  const r = await ai.models.generateContent({ model: MODEL, contents: window, config: { systemInstruction } });
  const reply = r.candidates[0].content.parts[0].text;
  s.history.push({ role: 'model', parts: [{ text: reply }] });
  return reply;
}

// ex07 guiados 02
export async function summarizeHistory(sessionId = 'default') {
  const s = getSession(sessionId);
  if (s.history.length === 0) return '';
  const conv = s.history.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
  s.summary = (await generate(`Resume esta conversa em 2 frases:\n${conv}`)).trim();
  s.history = s.history.slice(-2);
  return s.summary;
}

// ex08 guiados 02
export async function generateTaskBreakdown(taskText) {
  const prompt = `Divide a tarefa em subtarefas. Pensa passo a passo antes de responder.
Tarefa: "${taskText}"
Responde so JSON:
{ "parent": "...", "subtasks": [ { "title": "...", "description": "...", "priority": "high|medium|low" } ] }`;
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { thinkingConfig: { thinkingBudget: 1024, includeThoughts: true }, responseMimeType: 'application/json' }
  });
  return JSON.parse(r.candidates[0].content.parts[0].text);
}

// =============== GUIADOS 03 ===============

export const smartTaskSchema = z.object({
  title: z.string().describe('Titulo curto e profissional.'),
  due_date: z.string().describe('Data ISO 8601 (YYYY-MM-DD).'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']),
  department: z.enum(['design', 'dev', 'marketing'])
});

export const bugTriageSchema = z.object({
  error_type: z.enum(['UI', 'API', 'Database']),
  severity: z.number().min(1).max(10),
  fix_suggestion: z.string()
});

export const sentimentSchema = z.object({
  team_mood: z.enum(['happy', 'stressed', 'neutral']),
  main_blocker: z.string(),
  burnout_risk: z.boolean()
});

// ex01 guiados 03
export async function streamSupportChat(res, userMessage) {
  const full = await streamChat(res, {
    prompt: userMessage,
    systemInstruction: 'Es um assistente de suporte do ClickUp. Responde em portugues de Portugal, curto e util.'
  });
  if (full) {
    try {
      await query('INSERT INTO chat_history (session_id, user_message, ai_response) VALUES (?, ?, ?)', [null, userMessage, full]);
    } catch (err) { console.warn('chat_history:', err.message); }
  }
}

// ex02 guiados 03
export async function smartTaskParser(text) {
  const prompt = `Extrai informacoes para criar uma tarefa.
Pedido: "${text}"`;
  const r = await generateJSON(prompt, zodToJsonSchema(smartTaskSchema));
  return smartTaskSchema.parse(r);
}

// ex03 guiados 03
export async function streamMeetingSummary(res, notes, projectId) {
  const prompt = `Sumariza estas notas com pontos chave, decisoes e proximos passos:\n"""\n${notes}\n"""`;
  const full = await streamChat(res, { prompt });
  if (full) {
    try {
      await query('INSERT INTO meeting_summaries (project_id, original_text, summary) VALUES (?, ?, ?)', [projectId || null, notes, full]);
    } catch (err) { console.warn('meeting_summaries:', err.message); }
  }
}

// ex04 guiados 03
export async function triageBug(errorText) {
  const triage = bugTriageSchema.parse(await generateJSON(`Classifica este reporte de erro: "${errorText}"`, zodToJsonSchema(bugTriageSchema)));
  let ticketId = null;
  if (triage.severity >= 8) {
    try {
      const r = await query('INSERT INTO tickets (error_text, error_type, severity, fix_suggestion) VALUES (?, ?, ?, ?)', [errorText, triage.error_type, triage.severity, triage.fix_suggestion]);
      ticketId = r.insertId;
    } catch (err) { console.warn('tickets:', err.message); }
  }
  return { ...triage, ticket_id: ticketId };
}

// ex05 guiados 03
export async function streamWeeklyPlan(res, userInput) {
  const prompt = `Organiza um plano semanal a partir de: "${userInput}"
No final devolve JSON: { "schedule": [ { "day": "Segunda", "tasks": ["..."] } ] }`;
  await streamChat(res, { prompt });
}

// ex06 guiados 03
const mockComments = [
  'Outro sprint atrasado, isto nao tem fim.',
  'A reuniao de hoje foi produtiva, gostei da direcao.',
  'Estou exausto, nao durmo bem ha uma semana.',
  'A nova feature ficou espetacular, parabens a equipa.',
  'Falta clareza sobre os requisitos do cliente.',
  'O ambiente esta pesado, ninguem fala muito.',
  'Consegui fechar o ticket que estava ha meses pendente.',
  'O design ainda nao chegou e eu nao consigo avancar.',
  'Sinto que estou a fazer o trabalho de duas pessoas.',
  'A onboarding do novo dev correu super bem.',
  'Ontem fiquei ate as 2h a fazer o deploy.',
  'O cliente mudou de ideias outra vez sobre o layout.',
  'A pizza de sexta foi a melhor coisa da semana.',
  'Os bugs aparecem mais rapido do que conseguimos fechar.',
  'Adorei o feedback da ultima retro, foi honesto.',
  'Ja nao aguento esta stack legacy.',
  'A documentacao esta finalmente em dia, sinto-me orgulhoso.',
  'Pediram-me para entregar isto amanha, sem hipotese.',
  'O code review do Joao foi muito util hoje.',
  'Ja nao sei se vale a pena continuar neste ritmo.'
];

export async function sentimentDashboard(comments) {
  const list = Array.isArray(comments) && comments.length > 0 ? comments : mockComments;
  const prompt = `Analisa estes comentarios da equipa e devolve JSON com humor, bloqueio e risco de burnout.
Comentarios:\n- ${list.join('\n- ')}`;
  return sentimentSchema.parse(await generateJSON(prompt, zodToJsonSchema(sentimentSchema)));
}
