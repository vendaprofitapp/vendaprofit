-- 1. Create main_categories table (global, admin-controlled)
CREATE TABLE public.main_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  has_subcategories BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create subcategories table (linked to main categories)
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  main_category_id UUID NOT NULL REFERENCES public.main_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(main_category_id, name)
);

-- 3. Add new columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS main_category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS is_new_release BOOLEAN NOT NULL DEFAULT false;

-- 4. Enable RLS on new tables
ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for main_categories (everyone can read, only admin can modify)
CREATE POLICY "Anyone can view main categories" 
ON public.main_categories FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage main categories" 
ON public.main_categories FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. RLS Policies for subcategories (everyone can read, only admin can modify)
CREATE POLICY "Anyone can view subcategories" 
ON public.subcategories FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage subcategories" 
ON public.subcategories FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Insert main categories
INSERT INTO public.main_categories (name, display_order, has_subcategories) VALUES
('Lançamentos', 0, false),
('Feminino', 1, true),
('Masculino', 2, true),
('Acessórios', 3, true),
('Moda Praia', 4, false),
('Óculos', 5, false),
('Infantil', 6, true),
('Empório FIT', 7, true);

-- 8. Insert subcategories for Feminino
INSERT INTO public.subcategories (main_category_id, name, display_order)
SELECT id, unnest(ARRAY['Shorts', 'Top', 'Legging', 'Macacão/Macaquinho', 'Camisetas/Regatas/Croppeds', 'Inverno', 'Moda Íntima']), 
       generate_series(0, 6)
FROM public.main_categories WHERE name = 'Feminino';

-- 9. Insert subcategories for Masculino
INSERT INTO public.subcategories (main_category_id, name, display_order)
SELECT id, unnest(ARRAY['Camisetas e Regatas', 'Bermudas', 'Inverno', 'Calças e Leggings']), 
       generate_series(0, 3)
FROM public.main_categories WHERE name = 'Masculino';

-- 10. Insert subcategories for Acessórios
INSERT INTO public.subcategories (main_category_id, name, display_order)
SELECT id, unnest(ARRAY['Bonés e Viseiras', 'Head Band', 'Meias', 'Joelheiras', 'Grip', 'Munhequeira', 'Speed Rope', 'Mochilas/Pochetes/Bolsas', 'Tênis', 'Aparelhos e Equipamentos']), 
       generate_series(0, 9)
FROM public.main_categories WHERE name = 'Acessórios';

-- 11. Insert subcategories for Infantil
INSERT INTO public.subcategories (main_category_id, name, display_order)
SELECT id, unnest(ARRAY['Camisetas', 'Bermuda', 'Shorts', 'Top']), 
       generate_series(0, 3)
FROM public.main_categories WHERE name = 'Infantil';

-- 12. Insert subcategories for Empório FIT
INSERT INTO public.subcategories (main_category_id, name, display_order)
SELECT id, unnest(ARRAY['Café', 'Cappuccino', 'Suplementos', 'Termogênicos']), 
       generate_series(0, 3)
FROM public.main_categories WHERE name = 'Empório FIT';

-- 13. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_main_category ON public.products(main_category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON public.products(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_is_new_release ON public.products(is_new_release);
CREATE INDEX IF NOT EXISTS idx_subcategories_main_category ON public.subcategories(main_category_id);

-- 14. Drop the old categories table
DROP TABLE IF EXISTS public.categories CASCADE;