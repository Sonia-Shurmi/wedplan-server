import type { Request, Response } from "express"

import { subscriptionService } from "./subscription.service.js"

const getStatus = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Subscription status retrieved successfully.",
    data: subscriptionService.getStatus(req.user!),
  })
}

const createCheckout = async (req: Request, res: Response) => {
  const session = await subscriptionService.createCheckout(req.user!)

  res.status(200).json({
    success: true,
    message: "Checkout session created.",
    data: session,
  })
}

export const subscriptionController = { getStatus, createCheckout }
