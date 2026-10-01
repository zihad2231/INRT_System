ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "accent_color" TEXT DEFAULT '#176b55';

ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "bg_image_url" TEXT;

ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "login_bg_image_url" TEXT;

ALTER TABLE "organizations"
ADD COLUMN IF NOT EXISTS "login_bg_opacity" DOUBLE PRECISION DEFAULT 0.8;