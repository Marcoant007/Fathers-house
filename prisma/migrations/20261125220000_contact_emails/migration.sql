-- E-mails de contato da igreja (Secretaria, Financeiro, Administrativo).
ALTER TABLE "site_settings"
    ADD COLUMN "secretary_email" TEXT,
    ADD COLUMN "finance_email" TEXT,
    ADD COLUMN "admin_email" TEXT,
    ADD CONSTRAINT "site_settings_secretary_email_format" CHECK ("secretary_email" IS NULL OR "secretary_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    ADD CONSTRAINT "site_settings_finance_email_format" CHECK ("finance_email" IS NULL OR "finance_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    ADD CONSTRAINT "site_settings_admin_email_format" CHECK ("admin_email" IS NULL OR "admin_email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
