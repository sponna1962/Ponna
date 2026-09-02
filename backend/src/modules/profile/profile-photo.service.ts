// Profile Photo Upload (Part B — finalized requirement) — lets EVERY
// student upload their own photo, not just Google sign-ins who get one
// auto-captured (Part A, student-auth.service.ts). A student's own upload
// always takes precedence: student-auth.service.ts's Google-login photo
// backfill only ever fires when photoUrl is still null, so it never
// overwrites something uploaded here.
//
// Uses Cloudinary (configured via env vars — never hardcoded) for actual
// image storage; only the resulting secure URL is kept on User.photoUrl,
// never the raw image bytes in our own database.

import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let configured = false;
function ensureCloudinaryConfigured() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export class ProfilePhotoService {
  /**
   * `imageDataUrl` is a base64 data URL (e.g. "data:image/jpeg;base64,...")
   * from the browser's file picker — simplest to send as plain JSON,
   * avoids needing multipart/form-data handling for a single small image.
   * Cloudinary itself enforces a reasonable max file size; anything larger
   * is rejected there rather than filling up our own request body first —
   * an explicit ~5MB cap is applied here too as a first line of defense.
   */
  async uploadProfilePhoto(userId: string, imageDataUrl: string): Promise<string> {
    ensureCloudinaryConfigured();

    if (!imageDataUrl.startsWith('data:image/')) {
      throw new Error('Please choose a valid image file.');
    }
    const approxBytes = (imageDataUrl.length * 3) / 4;
    if (approxBytes > 5 * 1024 * 1024) {
      throw new Error('Image is too large — please choose one under 5MB.');
    }

    const result = await cloudinary.uploader.upload(imageDataUrl, {
      folder: 'ponna-profile-photos',
      public_id: userId,
      overwrite: true,
      transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
    });

    await prisma.user.update({ where: { id: userId }, data: { photoUrl: result.secure_url } });
    return result.secure_url;
  }
}
