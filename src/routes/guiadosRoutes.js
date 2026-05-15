import { Router } from 'express';
import * as ctrl from '../controllers/guiadosController.js';

const router = Router();

// Guiados 01 (POST /api/tasks/*)
router.post('/tasks/create', ctrl.createTask);
router.post('/tasks/refine', ctrl.refineTask);
router.post('/tasks/summarize', ctrl.summarize);
router.post('/tasks/suggest-tags', ctrl.suggestTags);

// Guiados 02 (POST /api/clickbot/chat)
router.post('/clickbot/chat', ctrl.clickbotChat);

// Guiados 03 (GET /chat e' registado a parte no server.js)

export default router;
