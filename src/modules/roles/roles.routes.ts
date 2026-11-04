import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { getRolesController, getRoleController } from './roles.controller';

const router = Router();
router.use(authenticate);
router.get('/', authorize('ROLE_VIEW'), getRolesController);
router.get('/:id', authorize('ROLE_VIEW'), getRoleController);
export default router;
