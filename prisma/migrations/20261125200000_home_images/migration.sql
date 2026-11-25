-- Fotos da página inicial editáveis em Aparência (antes ficavam fixas no código).
ALTER TABLE "site_settings" ADD COLUMN "hero_image_path" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "about_image_path" TEXT;
