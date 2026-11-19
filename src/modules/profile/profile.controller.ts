import type { Request, Response } from "express"

import { profileService } from "./profile.service.js"
import type { ProfileUpdateInput } from "./profile.validation.js"

const getProfile = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully.",
    data: profileService.get(req.user!),
  })
}

const updateProfile = async (req: Request, res: Response) => {
  const profile = await profileService.update(
    req.user!,
    (req.validated?.body ?? {}) as ProfileUpdateInput,
  )

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: profile,
  })
}

export const profileController = { getProfile, updateProfile }
