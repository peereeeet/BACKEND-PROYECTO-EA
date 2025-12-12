import { Router } from 'express';
import { searchEventsWithAi } from '../controller/aiController';
import { authenticateToken } from '../auth/middleware';

const router = Router();

/**
 * @swagger
 * /api/ai/search:
 *   post:
 *     summary: Cerca semàntica d'esdeveniments usant IA
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 example: "Busco partits de futbol a Barcelona aquest cap de setmana"
 *     responses:
 *       200:
 *         description: Llista d'esdeveniments trobats
 */
router.post('/search', authenticateToken, searchEventsWithAi);

export default router;