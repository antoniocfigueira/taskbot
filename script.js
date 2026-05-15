const messagesEl = document.getElementById('messages');
const composerEl = document.getElementById('composer');
const inputEl = document.getElementById('input');
const tasksEl = document.getElementById('tasks');
const filterPriority = document.getElementById('filter-priority');
const filterSpace = document.getElementById('filter-space');
const resetBtn = document.getElementById('reset-btn');

let allTasks = [];
let editingId = null;

function addMessage(text, type = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.innerHTML = `<p>${text}</p>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div.querySelector('p');
}

function priorityLabel(p) {
  return ({ URGENT: 'Urgente', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baixa' })[p] || p;
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-PT');
}

function renderTaskCard(t) {
  if (editingId === t.id) return renderEditForm(t);

  const pri = t.priority ? `<span class="badge ${t.priority.toLowerCase()}">${priorityLabel(t.priority)}</span>` : '';
  const space = t.space ? `<span class="badge">${escapeHtml(t.space)}</span>` : '';
  const status = t.status === 'done' ? `<span class="badge done">Concluida</span>` : `<span class="badge">Aberta</span>`;
  const assignee = t.assignee ? `<div><strong>Responsavel:</strong></div><div>${escapeHtml(t.assignee)}</div>` : '';
  const dueDate = t.due_date ? `<div><strong>Entrega:</strong></div><div>${formatDate(t.due_date)}</div>` : '';
  const created = `<div><strong>Criada:</strong></div><div>${formatDate(t.created_at)}</div>`;
  const desc = t.description ? `<p class="desc">${escapeHtml(t.description)}</p>` : '';

  return `
    <div class="task-card" data-id="${t.id}">
      <div class="actions">
        <button class="edit" data-id="${t.id}" title="Editar">edit</button>
        <button class="delete" data-id="${t.id}" title="Apagar">x</button>
      </div>
      <h3>${escapeHtml(t.title)}</h3>
      ${desc}
      <div class="meta">${pri}${space}${status}</div>
      <div class="details">${assignee}${dueDate}${created}</div>
    </div>
  `;
}

function renderEditForm(t) {
  return `
    <div class="task-card editing" data-id="${t.id}">
      <form class="edit-form" data-id="${t.id}">
        <label>Titulo</label>
        <textarea name="title" required>${escapeHtml(t.title)}</textarea>

        <label>Descricao</label>
        <textarea name="description">${escapeHtml(t.description || '')}</textarea>

        <div class="row">
          <div>
            <label>Prioridade</label>
            <select name="priority">
              ${['URGENT','HIGH','MEDIUM','LOW'].map(p => `<option value="${p}" ${t.priority===p?'selected':''}>${priorityLabel(p)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Espaco</label>
            <select name="space">
              <option value="">--</option>
              ${['Desenvolvimento','Design','Marketing'].map(s => `<option value="${s}" ${t.space===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="row">
          <div>
            <label>Responsavel</label>
            <input type="text" name="assignee" value="${escapeHtml(t.assignee||'')}">
          </div>
          <div>
            <label>Entrega</label>
            <input type="date" name="due_date" value="${t.due_date ? t.due_date.substring(0,10) : ''}">
          </div>
        </div>

        <label>Estado</label>
        <select name="status">
          <option value="open" ${t.status==='open'?'selected':''}>Aberta</option>
          <option value="done" ${t.status==='done'?'selected':''}>Concluida</option>
        </select>

        <div class="save-row">
          <button type="submit" class="save">Guardar</button>
          <button type="button" class="cancel" data-id="${t.id}">Cancelar</button>
        </div>
      </form>
    </div>
  `;
}

function renderTasks() {
  const pri = filterPriority.value;
  const space = filterSpace.value;

  const filtered = allTasks.filter(t => {
    if (pri && t.priority !== pri) return false;
    if (space && t.space !== space) return false;
    return true;
  });

  if (filtered.length === 0) {
    tasksEl.innerHTML = '<p class="empty">Sem tarefas. Pede uma ao bot.</p>';
    return;
  }

  tasksEl.innerHTML = filtered.map(renderTaskCard).join('');

  tasksEl.querySelectorAll('.delete').forEach(b => b.addEventListener('click', () => deleteTask(b.dataset.id)));
  tasksEl.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => { editingId = parseInt(b.dataset.id, 10); renderTasks(); }));
  tasksEl.querySelectorAll('.cancel').forEach(b => b.addEventListener('click', () => { editingId = null; renderTasks(); }));
  tasksEl.querySelectorAll('.edit-form').forEach(f => f.addEventListener('submit', onSaveEdit));
}

async function onSaveEdit(e) {
  e.preventDefault();
  const id = e.target.dataset.id;
  const form = new FormData(e.target);
  const body = {};
  for (const [k, v] of form.entries()) body[k] = v;

  try {
    const res = await fetch(`/api/projeto/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      editingId = null;
      await loadTasks();
    } else {
      alert('Erro ao guardar: ' + (json.error || 'desconhecido'));
    }
  } catch (err) {
    alert('Erro ao guardar: ' + err.message);
  }
}

async function loadTasks() {
  try {
    const res = await fetch('/api/projeto/tasks');
    const json = await res.json();
    if (json.success) {
      allTasks = json.data;
      renderTasks();
    }
  } catch (err) {
    console.error('loadTasks:', err);
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/projeto/history');
    const json = await res.json();
    if (json.success && json.data.length > 0) {
      messagesEl.innerHTML = '';
      for (const row of json.data) {
        addMessage(escapeHtml(row.user_message), 'user');
        addMessage(escapeHtml(row.ai_response), 'bot');
      }
    }
  } catch (err) {
    console.error('loadHistory:', err);
  }
}

async function deleteTask(id) {
  await fetch(`/api/projeto/tasks/${id}`, { method: 'DELETE' });
  await loadTasks();
}

async function sendMessage(message) {
  addMessage(escapeHtml(message), 'user');

  const botMsg = addMessage('', 'bot');
  botMsg.classList.add('typing');

  try {
    const res = await fetch('/api/projeto/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);

        if (data === '[DONE]') {
          botMsg.classList.remove('typing');
          continue;
        }

        try {
          const event = JSON.parse(data);

          if (event.text) {
            text += event.text;
            botMsg.textContent = text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          if (event.action) {
            const { name } = event.action;
            const verb = {
              create_task: 'criou tarefa',
              update_task: 'atualizou tarefa',
              delete_task: 'apagou tarefa',
              list_tasks: 'listou tarefas',
              summarize_text: 'resumiu texto',
              suggest_tags: 'sugeriu tags',
              refine_task: 'melhorou tarefa',
              breakdown_task: 'dividiu em subtarefas',
              summarize_meeting: 'resumiu reuniao',
              triage_bug: 'fez triagem do bug',
              weekly_plan: 'gerou plano semanal',
              check_team_mood: 'avaliou moral da equipa'
            }[name] || 'executou';
            addMessage(`(check) ${verb}`, 'action');
            await loadTasks();
          }

          if (event.error) {
            text += ` [erro: ${event.error}]`;
            botMsg.textContent = text;
          }
        } catch (e) {
          console.warn('parse SSE:', e);
        }
      }
    }

    botMsg.classList.remove('typing');
  } catch (err) {
    console.error('sendMessage:', err);
    botMsg.textContent = 'Erro ao falar com o servidor.';
    botMsg.classList.remove('typing');
  }
}

composerEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = inputEl.value.trim();
  if (!msg) return;
  inputEl.value = '';
  inputEl.disabled = true;
  await sendMessage(msg);
  inputEl.disabled = false;
  inputEl.focus();
});

filterPriority.addEventListener('change', renderTasks);
filterSpace.addEventListener('change', renderTasks);

resetBtn.addEventListener('click', async () => {
  await fetch('/api/projeto/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  messagesEl.innerHTML = '<div class="msg bot"><p>Conversa limpa. O que queres fazer agora?</p></div>';
});

loadTasks();
loadHistory();
