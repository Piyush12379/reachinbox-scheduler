import { Router } from 'express';
import multer from 'multer';
import { emailController } from '../controllers/email.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

router.post('/parse-csv', upload.single('file'), emailController.parseCsvLeads);
router.post('/schedule', emailController.schedule);
router.get('/scheduled', emailController.getScheduled);
router.get('/sent', emailController.getSent);
router.get('/search', emailController.search);
router.get('/metrics', emailController.getQueueMetrics);

export default router;
