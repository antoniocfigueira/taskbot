import 'dotenv/config';
import { smartTaskParser, triageBug, sentimentDashboard } from '../src/services/guiadosService.js';
import { ai, MODEL } from '../src/services/geminiService.js';

function header(t) { console.log('\n========================================\n' + t + '\n========================================'); }

async function streamToConsole(prompt) {
  const r = await ai.models.generateContentStream({ model: MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  for await (const chunk of r) if (chunk.text) process.stdout.write(chunk.text);
  console.log();
}

async function main() {
  console.log('http://localhost:3000/chat?message=...');

  header('ex02 - Smart Task Parser');
  console.log(JSON.stringify(await smartTaskParser('Preciso de um design para a home page ate sexta com prioridade alta.'), null, 2));

  header('ex03 - Transcritor de Reunioes (stream)');
  await streamToConsole(`Sumariza estas notas de reuniao:
Reuniao 13/05/2026. Presentes: Ana, Joao, Pedro. Decidido lancar feature de notificacoes em junho. Joao no design, Ana no backend.`);

  header('ex04 - Triage de Bugs');
  console.log(JSON.stringify(await triageBug('O botao de pagamento da erro 500 e nao deixa finalizar a compra. Todos os utilizadores afetados.'), null, 2));

  header('ex05 - Smart Planner Semanal (stream)');
  await streamToConsole('Tenho que entregar o logo, ir ao dentista na terca e estudar React todos os dias. Organiza uma agenda semanal.');

  header('ex06 - Sentiment Dashboard (20 mock comments)');
  console.log(JSON.stringify(await sentimentDashboard(), null, 2));

  console.log('\nFim guiados 03.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
