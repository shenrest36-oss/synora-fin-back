import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { getPermissionsController } from './permissions.controller';

const router = Router();
router.use(authenticate);
router.get('/', authorize('ROLE_VIEW'), getPermissionsController);
export default router;
