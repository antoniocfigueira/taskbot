import { Type } from '@google/genai';
import { ai, MODEL, generate, generateJSON, cleanJSON } from './geminiService.js';
import { query } from './dbService.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { bugTriageSchema, sentimentSchema } from './guiadosService.js';
import * as taskService from './guiadosService.js';

const sessions = new Map();

function getSession(sessionId = 'default') {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { history: [], lastTaskId: null });
  }
  return sessions.get(sessionId);
}

function systemPrompt() {
  return `Es o TaskBot, um assistente de produtividade integrado com o ClickUp.
Respondes sempre em portugues de Portugal de forma curta e amigavel.
Quando o utilizador pede para criar, alterar, listar ou apagar tarefas, usa as funcoes disponiveis.
Espacos validos: Desenvolvimento, Design, Marketing.
Prioridades validas: URGENT, HIGH, MEDIUM, LOW.
Quando o utilizador diz "essa tarefa", "a ultima" ou similar, usa target="last_task".
Tambem podes resumir textos, sugerir tags, melhorar tarefas, dividir tarefas grandes em subtarefas,
resumir reunioes, fazer triagem de bugs, planear a semana ou avaliar o moral da equipa.`;
}

const functionDeclarations = [
  {
    name: 'create_task',
    description: 'Cria uma nova tarefa no ClickUp.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Titulo curto da tarefa.' },
        priority: { type: Type.STRING, enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
        space: { type: Type.STRING, enum: ['Desenvolvimento', 'Design', 'Marketing'] },
        due_date: { type: Type.STRING, description: 'Data YYYY-MM-DD.' },
        assignee: { type: Type.STRING }
      },
      required: ['title']
    }
  },
  {
    name: 'update_task',
    description: 'Atualiza uma tarefa existente. target pode ser ID ou "last_task". Pode mudar titulo, prioridade, espaco, data, responsavel ou estado.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: { type: Type.STRING },
        title: { type: Type.STRING },
        priority: { type: Type.STRING, enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
        space: { type: Type.STRING, enum: ['Desenvolvimento', 'Design', 'Marketing'] },
        due_date: { type: Type.STRING },
        assignee: { type: Type.STRING },
        status: { type: Type.STRING, enum: ['open', 'done'] }
      },
      required: ['target']
    }
  },
  {
    name: 'delete_task',
    description: 'Apaga uma tarefa pelo ID ou "last_task".',
    parameters: {
      type: Type.OBJECT,
      properties: { target: { type: Type.STRING } },
      required: ['target']
    }
  },
  {
    name: 'list_tasks',
    description: 'Lista tarefas com filtros opcionais.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        priority: { type: Type.STRING, enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] },
        space: { type: Type.STRING, enum: ['Desenvolvimento', 'Design', 'Marketing'] },
        status: { type: Type.STRING, enum: ['open', 'done'] }
      }
    }
  },
  {
    name: 'summarize_text',
    description: 'Resume um texto longo numa frase curta. Usa quando o utilizador pede para resumir.',
    parameters: {
      type: Type.OBJECT,
      properties: { text: { type: Type.STRING } },
      required: ['text']
    }
  },
  {
    name: 'suggest_tags',
    description: 'Sugere tags relevantes para um texto ou tarefa.',
    parameters: {
      type: Type.OBJECT,
      properties: { text: { type: Type.STRING } },
      required: ['text']
    }
  },
  {
    name: 'refine_task',
    description: 'Melhora o titulo e descricao de uma tarefa existente. target pode ser ID ou "last_task".',
    parameters: {
      type: Type.OBJECT,
      properties: { target: { type: Type.STRING } },
      required: ['target']
    }
  },
  {
    name: 'breakdown_task',
    description: 'Divide uma tarefa grande em subtarefas usando raciocinio. Usa quando o utilizador pede para dividir, separar ou criar subtarefas.',
    parameters: {
      type: Type.OBJECT,
      properties: { text: { type: Type.STRING, description: 'Descricao da tarefa grande.' } },
      required: ['text']
    }
  },
  {
    name: 'summarize_meeting',
    description: 'Resume notas de reuniao e guarda na base de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: { notes: { type: Type.STRING } },
      required: ['notes']
    }
  },
  {
    name: 'triage_bug',
    description: 'Faz a triagem de um reporte de um bug, classifica a gravidade e cria ticket se for grave.',
    parameters: {
      type: Type.OBJECT,
      properties: { error_text: { type: Type.STRING } },
      required: ['error_text']
    }
  },
  {
    name: 'weekly_plan',
    description: 'Cria um plano semanal a partir do que o utilizador tem para fazer.',
    parameters: {
      type: Type.OBJECT,
      properties: { text: { type: Type.STRING } },
      required: ['text']
    }
  },
  {
    name: 'check_team_mood',
    description: 'Analisa os ultimos comentarios da equipa e devolve humor geral, bloqueio principal e risco de burnout.',
    parameters: { type: Type.OBJECT, properties: {} }
  }
];

async function executeCreate(args, session) {
  const result = await query(
    'INSERT INTO tasks (title, priority, space, due_date, assignee) VALUES (?, ?, ?, ?, ?)',
    [args.title, args.priority || 'MEDIUM', args.space || null, args.due_date || null, args.assignee || null]
  );
  session.lastTaskId = result.insertId;
  const [task] = await query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  return { ok: true, task };
}

function resolveTarget(target, session) {
  if (target === 'last_task') return session.lastTaskId;
  const id = parseInt(target, 10);
  return Number.isNaN(id) ? null : id;
}

async function executeUpdate(args, session) {
  const id = resolveTarget(args.target, session);
  if (!id) return { ok: false, error: 'Tarefa nao encontrada' };

  const fields = [];
  const values = [];
  ['title', 'priority', 'space', 'due_date', 'assignee', 'status'].forEach(f => {
    if (args[f] !== undefined) { fields.push(`${f} = ?`); values.push(args[f]); }
  });

  if (fields.length === 0) return { ok: false, error: 'Nada para atualizar' };

  values.push(id);
  await query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  const [task] = await query('SELECT * FROM tasks WHERE id = ?', [id]);
  return { ok: true, task };
}

async function executeDelete(args, session) {
  const id = resolveTarget(args.target, session);
  if (!id) return { ok: false, error: 'Tarefa nao encontrada' };
  await query('DELETE FROM tasks WHERE id = ?', [id]);
  if (session.lastTaskId === id) session.lastTaskId = null;
  return { ok: true, deletedId: id };
}

async function executeList(args) {
  const where = [];
  const values = [];
  ['priority', 'space', 'status'].forEach(f => {
    if (args[f]) { where.push(`${f} = ?`); values.push(args[f]); }
  });
  const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const tasks = await query(sql, values);
  return { ok: true, tasks };
}

async function executeSummarize(args) {
  const summary = await taskService.summarizeTask(args.text);
  return { ok: true, summary };
}

async function executeSuggestTags(args) {
  const tags = await taskService.suggestTags(args.text);
  return { ok: true, tags };
}

async function executeRefineTask(args, session) {
  const id = resolveTarget(args.target, session);
  if (!id) return { ok: false, error: 'Tarefa nao encontrada' };
  const [current] = await query('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!current) return { ok: false, error: 'Tarefa nao encontrada' };
  const refined = await taskService.refineTask({
    title: current.title,
    description: current.description || '',
    priority: current.priority,
    tags: []
  });
  await query('UPDATE tasks SET title = ?, description = ?, priority = ? WHERE id = ?',
    [refined.title, refined.description, (refined.priority || current.priority).toString().toUpperCase(), id]);
  const [task] = await query('SELECT * FROM tasks WHERE id = ?', [id]);
  return { ok: true, task, refined };
}

async function executeBreakdown(args) {
  const prompt = `Recebes uma tarefa grande e tens de a dividir em subtarefas.
Tarefa: "${args.text}"
Pensa passo a passo antes de responder.
Responde apenas com JSON neste formato:
{
  "parent": "titulo principal",
  "subtasks": [
    { "title": "...", "description": "...", "priority": "high" }
  ]
}`;
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 1024 },
      responseMimeType: 'application/json'
    }
  });
  const json = JSON.parse(response.candidates[0].content.parts[0].text);
  return { ok: true, ...json };
}

async function executeMeetingSummary(args) {
  const summary = await generate(`Resume estas notas de reuniao em pontos chave, decisoes e proximos passos:\n\n${args.notes}`);
  try {
    await query('INSERT INTO meeting_summaries (original_text, summary) VALUES (?, ?)', [args.notes, summary]);
  } catch (err) {
    console.warn('Nao foi possivel guardar meeting_summaries:', err.message);
  }
  return { ok: true, summary };
}

async function executeTriageBug(args) {
  const prompt = `Analisa o seguinte reporte de erro e classifica-o.\nReporte: "${args.error_text}"`;
  const triage = bugTriageSchema.parse(await generateJSON(prompt, zodToJsonSchema(bugTriageSchema)));
  let ticketId = null;
  if (triage.severity >= 8) {
    try {
      const r = await query(
        'INSERT INTO tickets (error_text, error_type, severity, fix_suggestion) VALUES (?, ?, ?, ?)',
        [args.error_text, triage.error_type, triage.severity, triage.fix_suggestion]
      );
      ticketId = r.insertId;
    } catch (err) {
      console.warn('Nao foi possivel criar ticket:', err.message);
    }
  }
  return { ok: true, ...triage, ticket_id: ticketId };
}

async function executeWeeklyPlan(args) {
  const prompt = `Cria um plano semanal a partir deste pedido: "${args.text}"
Responde apenas com JSON neste formato:
{ "schedule": [ { "day": "Segunda", "tasks": ["..."] } ] }`;
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' }
  });
  return { ok: true, ...JSON.parse(response.candidates[0].content.parts[0].text) };
}

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
  'A onboarding do novo dev correu super bem.'
];

async function executeCheckMood() {
  const prompt = `Analisa estes comentarios da equipa:\n- ${mockComments.join('\n- ')}\nDevolve JSON com humor geral, bloqueio principal e risco de burnout.`;
  const result = sentimentSchema.parse(await generateJSON(prompt, zodToJsonSchema(sentimentSchema)));
  return { ok: true, ...result };
}

async function executeFunction(name, args, session) {
  switch (name) {
    case 'create_task': return await executeCreate(args, session);
    case 'update_task': return await executeUpdate(args, session);
    case 'delete_task': return await executeDelete(args, session);
    case 'list_tasks': return await executeList(args);
    case 'summarize_text': return await executeSummarize(args);
    case 'suggest_tags': return await executeSuggestTags(args);
    case 'refine_task': return await executeRefineTask(args, session);
    case 'breakdown_task': return await executeBreakdown(args);
    case 'summarize_meeting': return await executeMeetingSummary(args);
    case 'triage_bug': return await executeTriageBug(args);
    case 'weekly_plan': return await executeWeeklyPlan(args);
    case 'check_team_mood': return await executeCheckMood();
    default: return { ok: false, error: `Funcao ${name} desconhecida` };
  }
}

async function saveToHistory(sessionId, userMessage, aiResponse) {
  try {
    await query(
      'INSERT INTO chat_history (session_id, user_message, ai_response) VALUES (?, ?, ?)',
      [sessionId, userMessage, aiResponse]
    );
  } catch (err) {
    console.warn('Nao foi possivel guardar chat_history:', err.message);
  }
}

export async function streamChat(res, message, sessionId = 'default') {
  const session = getSession(sessionId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  session.history.push({ role: 'user', parts: [{ text: message }] });

  try {
    const initial = await ai.models.generateContent({
      model: MODEL,
      contents: session.history,
      config: {
        systemInstruction: systemPrompt(),
        tools: [{ functionDeclarations }],
        temperature: 0.3
      }
    });

    const calls = initial.functionCalls || [];

    if (calls.length > 0) {
      session.history.push(initial.candidates[0].content);

      const fnResponses = [];
      for (const call of calls) {
        const result = await executeFunction(call.name, call.args || {}, session);
        fnResponses.push({
          functionResponse: { name: call.name, response: { result }, id: call.id }
        });
        res.write(`data: ${JSON.stringify({ action: { name: call.name, args: call.args, result } })}\n\n`);
      }

      session.history.push({ role: 'user', parts: fnResponses });

      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: session.history,
        config: { systemInstruction: systemPrompt(), tools: [{ functionDeclarations }], temperature: 0.3 }
      });

      let full = '';
      for await (const chunk of stream) {
        const t = chunk.text;
        if (t) { full += t; res.write(`data: ${JSON.stringify({ text: t })}\n\n`); }
      }
      session.history.push({ role: 'model', parts: [{ text: full }] });
      await saveToHistory(sessionId, message, full);
    } else {
      const text = initial.candidates[0].content.parts[0].text || '';
      const words = text.split(' ');
      for (const w of words) {
        res.write(`data: ${JSON.stringify({ text: w + ' ' })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
      session.history.push({ role: 'model', parts: [{ text }] });
      await saveToHistory(sessionId, message, text);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('streamChat projeto:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}

export async function getHistory(sessionId = 'default') {
  try {
    return await query(
      'SELECT user_message, ai_response, created_at FROM chat_history WHERE session_id = ? ORDER BY id ASC',
      [sessionId]
    );
  } catch (err) {
    console.warn('Nao foi possivel ler chat_history:', err.message);
    return [];
  }
}

export async function clearHistory(sessionId = 'default') {
  try {
    await query('DELETE FROM chat_history WHERE session_id = ?', [sessionId]);
  } catch (err) {
    console.warn('Nao foi possivel limpar chat_history:', err.message);
  }
}

export async function listTasks() {
  return await query('SELECT * FROM tasks ORDER BY created_at DESC');
}

export async function updateTaskFields(id, fields) {
  const allowed = ['title', 'description', 'priority', 'space', 'due_date', 'assignee', 'status'];
  const cols = [];
  const values = [];
  allowed.forEach(f => {
    if (fields[f] !== undefined) { cols.push(`${f} = ?`); values.push(fields[f] === '' ? null : fields[f]); }
  });
  if (cols.length === 0) return null;
  values.push(id);
  await query(`UPDATE tasks SET ${cols.join(', ')} WHERE id = ?`, values);
  const [task] = await query('SELECT * FROM tasks WHERE id = ?', [id]);
  return task;
}

export async function deleteTask(id) {
  await query('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function resetSession(sessionId = 'default') {
  sessions.delete(sessionId);
  await clearHistory(sessionId);
}
