import * as g from '../services/guiadosService.js';

function validateText(req, res) {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ success: false, error: 'text e obrigatorio' });
    return null;
  }
  return text.trim();
}

// ex01-01
export async function createTask(req, res) {
  const text = validateText(req, res); if (!text) return;
  try { res.status(201).json({ success: true, data: await g.createTaskFromText(text) }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Falha' }); }
}

// ex02-01
export async function refineTask(req, res) {
  const { task } = req.body;
  if (!task || !task.title) return res.status(400).json({ success: false, error: 'task com title obrigatorio' });
  try { res.status(200).json({ success: true, data: await g.refineTask(task) }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Falha' }); }
}

// ex03-01
export async function summarize(req, res) {
  const text = validateText(req, res); if (!text) return;
  try { res.status(200).json({ success: true, data: { summary: await g.summarizeTask(text) } }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Falha' }); }
}

export async function suggestTags(req, res) {
  const text = validateText(req, res); if (!text) return;
  try { res.status(200).json({ success: true, data: { tags: await g.suggestTags(text) } }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Falha' }); }
}

// ex09-02
export async function clickbotChat(req, res) {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'message obrigatorio' });
  try { res.status(200).json({ success: true, data: { reply: await g.sendMessage(message, sessionId) } }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Falha' }); }
}

// ex01-03
export async function supportChat(req, res) {
  const message = req.query.message || req.body?.message;
  if (!message) return res.status(400).json({ success: false, error: 'message obrigatorio' });
  await g.streamSupportChat(res, message);
}
