import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

export async function getStations(req: Request, res: Response) {
  try {
    const { data, error } = await supabaseAdmin
      .from('stations')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get stations error:', error);
    res.status(500).json({ message: 'Error fetching stations' });
  }
}

export async function getClients(req: Request, res: Response) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
}

export async function getPaymentMethods(req: Request, res: Response) {
  try {
    const { stationId } = req.query;

    let query = supabaseAdmin.from('tipos_pagamento').select('*');

    if (stationId) {
      query = query.eq('id_posto', stationId);
    }

    const { data, error } = await query.order('cartao');

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ message: 'Error fetching payment methods' });
  }
}

import { RequestService } from '../services/RequestService';

export async function getPriceRequests(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Use RequestService to fetch from price_suggestions
    const filters = {
      requested_by: userId,
      // Add other filters from query params if needed
      ...req.query
    };

    const data = await RequestService.getRequests(filters);
    res.json({ data });
  } catch (error: any) {
    console.error('Get price requests error:', error);
    res.status(500).json({ message: 'Error fetching price requests' });
  }
}

export async function createPriceRequest(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const requestData = req.body;

    // Use RequestService to create
    const data = await RequestService.createRequest(requestData, userId);

    res.status(201).json({ data });
  } catch (error: any) {
    console.error('Create price request error:', error);
    res.status(500).json({ message: 'Error creating price request', error: error.message });
  }
}

export async function approvePriceRequest(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    const { observations } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const result = await RequestService.approveRequest(id, userId, observations);
    res.json(result);
  } catch (error: any) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Error approving request', error: error.message });
  }
}

export async function rejectPriceRequest(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    const { observations } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const result = await RequestService.rejectRequest(id, userId, observations);
    res.json(result);
  } catch (error: any) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Error rejecting request', error: error.message });
  }
}
