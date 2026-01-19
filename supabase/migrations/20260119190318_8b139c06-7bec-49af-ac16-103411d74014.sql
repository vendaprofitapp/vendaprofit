-- Adicionar colunas de personalização visual na store_settings
ALTER TABLE public.store_settings
ADD COLUMN background_color text DEFAULT '#fafaf9',
ADD COLUMN card_background_color text DEFAULT '#ffffff',
ADD COLUMN banner_link text NULL,
ADD COLUMN is_banner_visible boolean DEFAULT false,
ADD COLUMN banner_height_mobile text DEFAULT '150px';