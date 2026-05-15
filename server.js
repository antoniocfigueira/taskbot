import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import guiadosRoutes from './src/routes/guiadosRoutes.js';
import projetoRoutes from './src/routes/projetoRoutes.js';
import { supportChat } from './src/controllers/guiadosController.js';
import { checkConnection } from './src/services/dbService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use('/api', guiadosRoutes);
app.use('/api/projeto', projetoRoutes);
app.get('/chat', supportChat);

app.listen(PORT, async () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
  await checkConnection();
});
