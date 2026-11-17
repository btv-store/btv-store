-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Products
CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  tag text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  features text[] NOT NULL DEFAULT '{}',
  best boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT TO anon, authenticated USING (active = true);

INSERT INTO public.products (id, name, tag, price, features, best, sort) VALUES
  ('lite', 'BTV Stick Lite', 'LITE', 199.90, ARRAY['Full HD 1080p','Wi‑Fi 2.4GHz','Controle remoto','Frete grátis'], false, 1),
  ('4k', 'BTV Stick 4K', '4K', 299.90, ARRAY['Ultra HD 4K HDR','Wi‑Fi dual band','Controle por voz','Frete grátis'], true, 2),
  ('max', 'BTV Stick 4K Max', 'MAX', 399.90, ARRAY['4K HDR10+','Wi‑Fi 6','Bluetooth 5.0 + voz','Frete grátis'], false, 3);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  address text NOT NULL,
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (status IN ('aguardando_pagamento','pagamento_confirmado','enviado','entregue','cancelado')),
  delivery_code text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create order: validates input and prices everything from the products table
CREATE OR REPLACE FUNCTION public.create_order(_name text, _phone text, _address text, _items jsonb)
RETURNS TABLE (order_number text, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := btrim(coalesce(_name, ''));
  v_phone text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  v_address text := btrim(coalesce(_address, ''));
  v_items jsonb := '[]'::jsonb;
  v_total numeric(10,2) := 0;
  v_number text;
  v_count int := 0;
  r record;
BEGIN
  IF char_length(v_name) < 3 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Nome inválido' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_phone) < 10 OR char_length(v_phone) > 13 THEN
    RAISE EXCEPTION 'WhatsApp inválido' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_address) < 10 OR char_length(v_address) > 300 THEN
    RAISE EXCEPTION 'Endereço inválido' USING ERRCODE = '22023';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 10 THEN
    RAISE EXCEPTION 'Carrinho inválido' USING ERRCODE = '22023';
  END IF;

  FOR r IN
    SELECT p.id, p.name, p.price, sum((i->>'qty')::int) AS qty
    FROM jsonb_array_elements(_items) AS i
    JOIN public.products p ON p.id = i->>'id' AND p.active
    WHERE (i->>'qty') ~ '^\d{1,2}$'
    GROUP BY p.id, p.name, p.price
  LOOP
    IF r.qty < 1 OR r.qty > 10 THEN
      RAISE EXCEPTION 'Quantidade inválida' USING ERRCODE = '22023';
    END IF;
    v_count := v_count + 1;
    v_total := v_total + r.price * r.qty;
    v_items := v_items || jsonb_build_object('id', r.id, 'name', r.name, 'price', r.price, 'qty', r.qty);
  END LOOP;

  IF v_count = 0 OR v_count <> (SELECT count(DISTINCT i->>'id') FROM jsonb_array_elements(_items) i) THEN
    RAISE EXCEPTION 'Carrinho inválido' USING ERRCODE = '22023';
  END IF;

  LOOP
    v_number := 'BTV' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = v_number);
  END LOOP;

  INSERT INTO public.orders (order_number, customer_name, customer_phone, address, items, total)
  VALUES (v_number, v_name, v_phone, v_address, v_items, v_total);

  RETURN QUERY SELECT v_number, v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.create_order(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, text, jsonb) TO anon, authenticated, service_role;

-- Track order: needs order number + last 4 phone digits; never returns personal data
CREATE OR REPLACE FUNCTION public.track_order(_number text, _phone_last4 text)
RETURNS TABLE (
  order_number text, status text, items jsonb, total numeric,
  delivery_code text, tracking_code text,
  created_at timestamptz, paid_at timestamptz, shipped_at timestamptz, delivered_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(_phone_last4, '') !~ '^\d{4}$' OR coalesce(_number, '') !~* '^\s*BTV[0-9A-F]{10}\s*$' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT o.order_number, o.status, o.items, o.total, o.delivery_code, o.tracking_code,
           o.created_at, o.paid_at, o.shipped_at, o.delivered_at
    FROM public.orders o
    WHERE o.order_number = upper(btrim(_number))
      AND right(o.customer_phone, 4) = _phone_last4
    LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated, service_role;

-- Admin status change: admin only, enforced transitions
CREATE OR REPLACE FUNCTION public.admin_set_status(_order_id uuid, _status text, _tracking text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current text;
  v_tracking text := nullif(btrim(coalesce(_tracking, '')), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF v_tracking IS NOT NULL AND (char_length(v_tracking) > 60 OR v_tracking !~ '^[A-Za-z0-9 \-]+$') THEN
    RAISE EXCEPTION 'Código de rastreio inválido' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_current FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    (v_current = 'aguardando_pagamento' AND _status IN ('pagamento_confirmado','cancelado')) OR
    (v_current = 'pagamento_confirmado' AND _status = 'enviado') OR
    (v_current = 'enviado' AND _status = 'entregue')
  ) THEN
    RAISE EXCEPTION 'Mudança de status não permitida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders SET
    status = _status,
    paid_at = CASE WHEN _status = 'pagamento_confirmado' THEN now() ELSE paid_at END,
    delivery_code = CASE WHEN _status = 'pagamento_confirmado'
      THEN lpad(((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
      ELSE delivery_code END,
    shipped_at = CASE WHEN _status = 'enviado' THEN now() ELSE shipped_at END,
    tracking_code = CASE WHEN _status = 'enviado' AND v_tracking IS NOT NULL THEN v_tracking ELSE tracking_code END,
    delivered_at = CASE WHEN _status = 'entregue' THEN now() ELSE delivered_at END
  WHERE id = _order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_status(uuid, text, text) TO authenticated, service_role;