import express from 'express';
import {
    getStations,
    getClients,
    getPaymentMethods,
    getPriceRequests,
    createPriceRequest,
    approvePriceRequest,
    rejectPriceRequest
} from '../controllers/dataController.js';

const router = express.Router();

// Get stations
router.get('/stations', getStations);

// Get clients
router.get('/clients', getClients);

// Get payment methods
router.get('/payment-methods', getPaymentMethods);

// Get price requests
router.get('/price-requests', getPriceRequests);

// Create price request
router.post('/price-requests', createPriceRequest);

// Approve price request
router.post('/price-requests/:id/approve', approvePriceRequest);

// Reject price request
router.post('/price-requests/:id/reject', rejectPriceRequest);

export default router;
