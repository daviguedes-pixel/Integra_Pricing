import express from 'express';
import { getMarketQuotations, getCompanyQuotations, getFilterOptions } from '../controllers/quotations.js';

const router = express.Router();

router.get('/market', getMarketQuotations);
router.get('/company', getCompanyQuotations);
router.get('/options', getFilterOptions);

export default router;
