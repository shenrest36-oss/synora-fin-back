import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  loginController,
  logoutController,
  getMeController,
  loginValidation,
} from './auth.controller';

const router = Router();

router.post('/login', loginValidation, loginController);
router.post('/logout', authenticate, logoutController);
router.get('/me', authenticate, getMeController);

export default router;
