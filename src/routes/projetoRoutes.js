import { Router } from 'express';
import * as ctrl from '../controllers/projetoController.js';

const router = Router();

router.post('/chat', ctrl.chat);
router.get('/tasks', ctrl.listTasks);
router.put('/tasks/:id', ctrl.updateTask);
router.delete('/tasks/:id', ctrl.deleteTask);
router.get('/history', ctrl.history);
router.post('/reset', ctrl.reset);

export default router;
