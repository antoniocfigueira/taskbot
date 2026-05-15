import { Router } from 'express';
import * as ctrl from '../controllers/guiadosController.js';

const router = Router();

// 01 (POST /api/tasks/*)
router.post('/tasks/create', ctrl.createTask);
router.post('/tasks/refine', ctrl.refineTask);
router.post('/tasks/summarize', ctrl.summarize);
router.post('/tasks/suggest-tags', ctrl.suggestTags);

// 02 (POST /api/clickbot/chat)
router.post('/clickbot/chat', ctrl.clickbotChat);

// 03 (GET /chat)

export default router;
