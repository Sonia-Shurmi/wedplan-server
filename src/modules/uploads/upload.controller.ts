import type { NextFunction, Request, Response } from "express"

import { uploadImageToImgBB } from "./imgbb.service.js"
import {
  parseImagePayload,
  type UploadBody,
  type UploadedImageResponse,
} from "./upload.validation.js"

const upload = async ({
  req,
  res,
  next,
  includeDisplayUrl,
}: {
  req: Request
  res: Response
  next: NextFunction
  includeDisplayUrl: boolean
}) => {
  try {
    const { image, name } = (req.validated?.body ?? {}) as UploadBody

    // Validate first so malformed or oversized files never reach ImgBB.
    const parsed = parseImagePayload(image)
    const uploaded = await uploadImageToImgBB(parsed.base64, name)

    const data: UploadedImageResponse = {
      id: uploaded.id,
      url: uploaded.url,
      width: uploaded.width,
      height: uploaded.height,
      size: uploaded.size,
      mimeType: parsed.mimeType,
      bytes: parsed.bytes,
    }

    if (includeDisplayUrl) {
      data.displayUrl = uploaded.displayUrl
    }

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data,
    })
  } catch (error) {
    next(error)
  }
}

/** Authenticated upload used by vendor service forms and profile settings. */
const uploadAuthenticated = (req: Request, res: Response, next: NextFunction) =>
  upload({ req, res, next, includeDisplayUrl: true })

/** Public upload used only for the sign-up avatar, so it stays rate limited. */
const uploadPublic = (req: Request, res: Response, next: NextFunction) =>
  upload({ req, res, next, includeDisplayUrl: false })

export const uploadController = {
  uploadAuthenticated,
  uploadPublic,
}
