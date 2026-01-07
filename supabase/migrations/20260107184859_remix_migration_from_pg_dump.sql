CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: group_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_role AS ENUM (
    'owner',
    'admin',
    'member'
);


--
-- Name: request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: handle_new_group(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_group() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Automatically add the creator as an owner member
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


--
-- Name: is_group_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
      AND gm.role IN ('owner', 'admin')
  );
$$;


--
-- Name: is_group_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = _group_id
      AND gm.user_id = _user_id
  );
$$;


--
-- Name: set_groups_created_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_groups_created_by() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.group_role DEFAULT 'member'::public.group_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    invite_code text DEFAULT "substring"(md5((random())::text), 1, 8),
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: partnership_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partnership_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    seller_cost_percent numeric DEFAULT 50 NOT NULL,
    seller_profit_percent numeric DEFAULT 70 NOT NULL,
    owner_cost_percent numeric DEFAULT 50 NOT NULL,
    owner_profit_percent numeric DEFAULT 30 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_partnerships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_partnerships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    group_id uuid,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    cost_price numeric(10,2) DEFAULT 0,
    sku text,
    size text,
    color text,
    stock_quantity integer DEFAULT 0 NOT NULL,
    min_stock_level integer DEFAULT 5 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    supplier_id uuid,
    image_url_2 text,
    image_url_3 text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    store_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric NOT NULL,
    total numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    customer_name text,
    customer_phone text,
    payment_method text DEFAULT 'dinheiro'::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    discount_type text DEFAULT 'fixed'::text,
    discount_value numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    total numeric DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status public.request_status DEFAULT 'pending'::public.request_status NOT NULL,
    notes text,
    response_notes text,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    cnpj text,
    phone text,
    email text,
    address text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_group_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_invite_code_key UNIQUE (invite_code);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: partnership_rules partnership_rules_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnership_rules
    ADD CONSTRAINT partnership_rules_group_id_key UNIQUE (group_id);


--
-- Name: partnership_rules partnership_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnership_rules
    ADD CONSTRAINT partnership_rules_pkey PRIMARY KEY (id);


--
-- Name: product_partnerships product_partnerships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_partnerships
    ADD CONSTRAINT product_partnerships_pkey PRIMARY KEY (id);


--
-- Name: product_partnerships product_partnerships_product_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_partnerships
    ADD CONSTRAINT product_partnerships_product_id_group_id_key UNIQUE (product_id, group_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: stock_requests stock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: groups on_group_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_group_created AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();


--
-- Name: groups set_groups_created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_groups_created_by BEFORE INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_groups_created_by();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: groups update_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: partnership_rules update_partnership_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_partnership_rules_updated_at BEFORE UPDATE ON public.partnership_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales update_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_requests update_stock_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_requests_updated_at BEFORE UPDATE ON public.stock_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: suppliers update_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: partnership_rules partnership_rules_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnership_rules
    ADD CONSTRAINT partnership_rules_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: product_partnerships product_partnerships_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_partnerships
    ADD CONSTRAINT product_partnerships_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: product_partnerships product_partnerships_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_partnerships
    ADD CONSTRAINT product_partnerships_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: products products_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: stock_requests stock_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stock_requests stock_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_requests stock_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_requests
    ADD CONSTRAINT stock_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: groups Authenticated users can create groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: group_members Group admins can add members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can add members" ON public.group_members FOR INSERT WITH CHECK (((user_id = auth.uid()) OR public.is_group_admin(group_id, auth.uid())));


--
-- Name: groups Group admins can delete groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can delete groups" ON public.groups FOR DELETE USING (public.is_group_admin(id, auth.uid()));


--
-- Name: partnership_rules Group admins can delete partnership rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can delete partnership rules" ON public.partnership_rules FOR DELETE USING (public.is_group_admin(group_id, auth.uid()));


--
-- Name: product_partnerships Group admins can delete product partnerships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can delete product partnerships" ON public.product_partnerships FOR DELETE USING (public.is_group_admin(group_id, auth.uid()));


--
-- Name: partnership_rules Group admins can insert partnership rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can insert partnership rules" ON public.partnership_rules FOR INSERT WITH CHECK (public.is_group_admin(group_id, auth.uid()));


--
-- Name: group_members Group admins can remove members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can remove members" ON public.group_members FOR DELETE USING (((user_id = auth.uid()) OR public.is_group_admin(group_id, auth.uid())));


--
-- Name: partnership_rules Group admins can update partnership rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group admins can update partnership rules" ON public.partnership_rules FOR UPDATE USING (public.is_group_admin(group_id, auth.uid()));


--
-- Name: partnership_rules Group members can view partnership rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view partnership rules" ON public.partnership_rules FOR SELECT USING (public.is_group_member(group_id, auth.uid()));


--
-- Name: product_partnerships Group members can view product partnerships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group members can view product partnerships" ON public.product_partnerships FOR SELECT USING (public.is_group_member(group_id, auth.uid()));


--
-- Name: groups Group owners can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Group owners can update" ON public.groups FOR UPDATE USING (public.is_group_admin(id, auth.uid()));


--
-- Name: group_members Members can view group members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT USING (public.is_group_member(group_id, auth.uid()));


--
-- Name: groups Members can view their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view their groups" ON public.groups FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.is_group_member(id, auth.uid())));


--
-- Name: stock_requests Owners can update requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update requests" ON public.stock_requests FOR UPDATE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: product_partnerships Product owners can delete product partnerships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Product owners can delete product partnerships" ON public.product_partnerships FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_partnerships.product_id) AND (p.owner_id = auth.uid())))));


--
-- Name: product_partnerships Product owners can insert product partnerships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Product owners can insert product partnerships" ON public.product_partnerships FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_partnerships.product_id) AND (p.owner_id = auth.uid())))) AND public.is_group_member(group_id, auth.uid())));


--
-- Name: stock_requests Requesters can cancel own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Requesters can cancel own requests" ON public.stock_requests FOR UPDATE TO authenticated USING (((requester_id = auth.uid()) AND (status = 'pending'::public.request_status)));


--
-- Name: stock_requests Users can create requests for group products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create requests for group products" ON public.stock_requests FOR INSERT WITH CHECK (((requester_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = stock_requests.product_id) AND (p.group_id IS NOT NULL) AND public.is_group_member(p.group_id, auth.uid()))))));


--
-- Name: categories Users can delete own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: products Users can delete own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own products" ON public.products FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: sale_items Users can delete own sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own sale items" ON public.sale_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND (sales.owner_id = auth.uid())))));


--
-- Name: sales Users can delete own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own sales" ON public.sales FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: suppliers Users can delete own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own suppliers" ON public.suppliers FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: categories Users can insert own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: products Users can insert own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: sale_items Users can insert own sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sale items" ON public.sale_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND (sales.owner_id = auth.uid())))));


--
-- Name: sales Users can insert own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own sales" ON public.sales FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: suppliers Users can insert own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own suppliers" ON public.suppliers FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: categories Users can update own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: products Users can update own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own products" ON public.products FOR UPDATE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: sale_items Users can update own sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sale items" ON public.sale_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND (sales.owner_id = auth.uid())))));


--
-- Name: sales Users can update own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sales" ON public.sales FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: suppliers Users can update own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own suppliers" ON public.suppliers FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: products Users can view group products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view group products" ON public.products FOR SELECT USING (((group_id IS NOT NULL) AND public.is_group_member(group_id, auth.uid())));


--
-- Name: categories Users can view own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: products Users can view own products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: stock_requests Users can view own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own requests" ON public.stock_requests FOR SELECT TO authenticated USING (((requester_id = auth.uid()) OR (owner_id = auth.uid())));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: sale_items Users can view own sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sale items" ON public.sale_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sales
  WHERE ((sales.id = sale_items.sale_id) AND (sales.owner_id = auth.uid())))));


--
-- Name: sales Users can view own sales; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: suppliers Users can view own suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own suppliers" ON public.suppliers FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: partnership_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partnership_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: product_partnerships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_partnerships ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;