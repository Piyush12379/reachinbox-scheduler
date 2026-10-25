import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

router.post('/google', authController.googleAuth);
router.get('/me', authController.getMe);

export default router;
