ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photo_public_id" TEXT;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "cloudinary_public_id" TEXT;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "cloudinary_resource_type" TEXT;
