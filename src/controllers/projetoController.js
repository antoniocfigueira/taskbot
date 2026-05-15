import * as projeto from '../services/projetoService.js';

export async function chat(req, res) {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message e obrigatorio' });
  }

  await projeto.streamChat(res, message, sessionId);
}

export async function listTasks(req, res) {
  try {
    const tasks = await projeto.listTasks();
    res.status(200).json({ success: true, data: tasks });
  } catch (err) {
    console.error('listTasks:', err);
    res.status(500).json({ success: false, error: 'Falha ao listar tarefas' });
  }
}

export async function updateTask(req, res) {
  try {
    const task = await projeto.updateTaskFields(req.params.id, req.body);
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    console.error('updateTask:', err);
    res.status(500).json({ success: false, error: 'Falha ao atualizar tarefa' });
  }
}

export async function deleteTask(req, res) {
  try {
    await projeto.deleteTask(req.params.id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('deleteTask:', err);
    res.status(500).json({ success: false, error: 'Falha ao apagar tarefa' });
  }
}

export async function history(req, res) {
  try {
    const sessionId = req.query.sessionId || 'default';
    const rows = await projeto.getHistory(sessionId);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('history:', err);
    res.status(500).json({ success: false, error: 'Falha ao ler historico' });
  }
}

export async function reset(req, res) {
  try {
    await projeto.resetSession(req.body.sessionId);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('reset:', err);
    res.status(500).json({ success: false, error: 'Falha ao limpar' });
  }
}
