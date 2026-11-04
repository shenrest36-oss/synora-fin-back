import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  getUsersController,
  getUserController,
  createUserController,
  updateUserController,
  createUserValidation,
} from './users.controller';

const router = Router();

router.use(authenticate);
router.get('/', authorize('USER_VIEW'), getUsersController);
router.get('/:id', authorize('USER_VIEW'), getUserController);
router.post('/', authorize('USER_CREATE'), createUserValidation, createUserController);
router.patch('/:id', authorize('USER_UPDATE'), updateUserController);

export default router;
