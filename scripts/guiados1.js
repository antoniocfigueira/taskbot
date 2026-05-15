import 'dotenv/config';
import { createTaskFromText, refineTask, summarizeTask, suggestTags } from '../src/services/guiadosService.js';

function header(t) { console.log('\n========================================\n' + t + '\n========================================'); }

async function main() {
  header('ex01 - createTaskFromText()');
  console.log(JSON.stringify(await createTaskFromText('Preciso de corrigir o bug do login que falha para vários utilizadores e é urgente'), null, 2));

  header('ex02 - refineTask()');
  console.log(JSON.stringify(await refineTask({ title: 'Bug no login', description: 'login não funciona', priority: 'high', tags: ['bug'] }), null, 2));

  header('ex03 - summarizeTask()');
  console.log(await summarizeTask('Erro no login afeta vários utilizadores, fluxo de autenticacao falha em todos os browsers, urgente.'));

  header('ex03 - suggestTags()');
  console.log(await suggestTags('Pagina inicial demora muito a carregar, imagens nao otimizadas.'));

  console.log('\nFim guiados 01.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
