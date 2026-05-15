import 'dotenv/config';
import {
  createSystemPrompt, classifyPriority, generateNames, planSprint,
  sendMessage, summarizeHistory, generateTaskBreakdown
} from '../src/services/guiadosService.js';

function header(t) { console.log('\n========================================\n' + t + '\n========================================'); }

async function main() {
  header('ex01 - createSystemPrompt()');
  console.log(createSystemPrompt());

  header('ex02 - classifyPriority("o checkout deu erro 500")');
  console.log(await classifyPriority('o checkout deu erro 500'));

  header('ex03 - generateNames(0.2)'); console.log(await generateNames(0.2));
  header('ex03 - generateNames(0.8)'); console.log(await generateNames(0.8));
  header('ex03 - generateNames(1.2)'); console.log(await generateNames(1.2));

  header('ex04 - planSprint()');
  console.log(await planSprint());

  header('ex05 + ex06 - sendMessage com memoria + sliding window');
  console.log('User: O meu nome e Ana');
  console.log('Bot:', await sendMessage('O meu nome e Ana', 'demo'));
  console.log('User: Trabalho em marketing');
  console.log('Bot:', await sendMessage('Trabalho em marketing', 'demo'));
  console.log('User: Como me chamo?');
  console.log('Bot:', await sendMessage('Como me chamo?', 'demo'));

  header('ex07 - summarizeHistory()');
  console.log(await summarizeHistory('demo'));

  header('ex08 - generateTaskBreakdown() com Thinking');
  console.log(JSON.stringify(await generateTaskBreakdown('Criar sistema completo de login com recuperacao de password'), null, 2));

  console.log('\nFim guiados 02.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
