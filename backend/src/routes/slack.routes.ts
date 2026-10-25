import { Router } from 'express';
import { slackController } from '../controllers/slack.controller';

const router = Router();

router.post('/connect', slackController.connect);
router.get('/status', slackController.getStatus);
router.post('/disconnect', slackController.disconnect);
router.post('/test', slackController.sendTestAlert);

export default router;
