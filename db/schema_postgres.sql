-- ============================================================================
-- ESQUEMA DE LA BASE OPERATIVA (PostgreSQL) — Talos Sentinel
-- Generado desde information_schema de una instancia en producción.
-- Solo estructura: NO incluye datos de clientes ✅
-- ============================================================================

CREATE TABLE orders (
  id                     integer NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  customer_id            integer,
  status                 text DEFAULT 'pending'::character varying,
  payment_method         varchar(30),
  total                  numeric(10,2) DEFAULT 0,
  notes                  text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  customer_name          text DEFAULT 'Sin nombre'::text,
  customer_phone         text,
  order_type             text DEFAULT 'Domicilio'::text,
  products               jsonb DEFAULT '[]'::jsonb,
  shipping_cost          numeric(12,2) DEFAULT 0,
  delivery_address       text,
  latitude               numeric(10,7),
  longitude              numeric(10,7),
  payment_proof_url      text,
  payment_proof_type     text,
  wa_message_id          text,
  confirmed_at           timestamptz,
  delivered_at           timestamptz,
  rider_id               integer,
  tenant_id              bigint NOT NULL,
  rider_accepted_at      timestamptz,
  PRIMARY KEY (id)
);
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE orders ADD CONSTRAINT orders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES delivery_riders(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_orders_phone ON public.orders USING btree (customer_phone);
CREATE INDEX idx_orders_pending ON public.orders USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'awaiting_verification'::text]));
CREATE INDEX idx_orders_rider_id ON public.orders USING btree (rider_id);
CREATE INDEX idx_orders_tenant ON public.orders USING btree (tenant_id, status, created_at);

CREATE TABLE delivery_riders (
  id                     integer NOT NULL DEFAULT nextval('delivery_riders_id_seq'::regclass),
  name                   text NOT NULL,
  pin_hash               text NOT NULL,
  is_active              boolean DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  fcm_token              text,
  tenant_id              bigint NOT NULL,
  last_lat               numeric(10,7),
  last_lng               numeric(10,7),
  last_seen_at           timestamptz,
  phone                  text,
  PRIMARY KEY (id)
);
CREATE INDEX idx_delivery_riders_tenant ON public.delivery_riders USING btree (tenant_id);
CREATE UNIQUE INDEX idx_delivery_riders_pin_hash ON public.delivery_riders USING btree (pin_hash);
CREATE INDEX idx_delivery_riders_ubicacion ON public.delivery_riders USING btree (tenant_id, is_active, last_seen_at);

CREATE TABLE bot_sessions (
  id                     bigint NOT NULL DEFAULT nextval('bot_sessions_id_seq'::regclass),
  phone                  text NOT NULL,
  phone_number_id        text NOT NULL,
  tenant_id              bigint,
  last_human_at          timestamptz,
  last_ai_at             timestamptz,
  followups_sent         integer NOT NULL DEFAULT 0,
  last_followup_at       timestamptz,
  state                  text NOT NULL DEFAULT 'flow'::text,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  business_name          text,
  PRIMARY KEY (id)
);
ALTER TABLE bot_sessions ADD CONSTRAINT bot_sessions_phone_phone_number_id_key UNIQUE (phone, phone_number_id);
CREATE UNIQUE INDEX bot_sessions_phone_phone_number_id_key ON public.bot_sessions USING btree (phone, phone_number_id);
CREATE INDEX idx_bot_sessions_silencio ON public.bot_sessions USING btree (last_human_at) WHERE (state <> 'done'::text);

CREATE TABLE restaurant_config (
  id                     integer NOT NULL DEFAULT nextval('restaurant_config_id_seq'::regclass),
  key                    varchar(100) NOT NULL,
  value                  text,
  updated_at             timestamp DEFAULT now(),
  tenant_id              bigint NOT NULL,
  PRIMARY KEY (id)
);
ALTER TABLE restaurant_config ADD CONSTRAINT restaurant_config_tenant_key_key UNIQUE (tenant_id, key);
CREATE UNIQUE INDEX restaurant_config_tenant_key_key ON public.restaurant_config USING btree (tenant_id, key);

CREATE TABLE n8n_chat_histories (
  id                     integer NOT NULL DEFAULT nextval('n8n_chat_histories_id_seq'::regclass),
  session_id             varchar(255) NOT NULL,
  message                jsonb NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE payment_verifications (
  id                     integer NOT NULL DEFAULT nextval('payment_verifications_id_seq'::regclass),
  order_id               integer NOT NULL,
  verified_by            text NOT NULL,
  action                 text NOT NULL DEFAULT 'approved'::text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  tenant_id              bigint NOT NULL,
  PRIMARY KEY (id)
);
ALTER TABLE payment_verifications ADD CONSTRAINT payment_verifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE payment_verifications ADD CONSTRAINT payment_verifications_action_check CHECK ((action = ANY (ARRAY['approved'::text, 'rejected'::text])));
CREATE INDEX idx_payment_verifications_tenant ON public.payment_verifications USING btree (tenant_id, order_id);

CREATE TABLE bank_payments (
  id                     bigint NOT NULL DEFAULT nextval('bank_payments_id_seq'::regclass),
  tenant_id              bigint NOT NULL,
  proveedor              text NOT NULL,
  message_id             text NOT NULL,
  huella                 text NOT NULL,
  monto                  numeric(14,2) NOT NULL,
  pagador                text,
  banco_origen           text,
  titular_cuenta         text,
  fecha_pago             timestamptz NOT NULL,
  spf                    text,
  dkim                   text,
  dmarc                  text,
  usado_por_pedido       bigint,
  usado_at               timestamptz,
  crudo                  jsonb,
  created_at             timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE bank_payments ADD CONSTRAINT bank_payments_usado_por_pedido_fkey FOREIGN KEY (usado_por_pedido) REFERENCES orders(id);
ALTER TABLE bank_payments ADD CONSTRAINT bank_payments_message_id_key UNIQUE (message_id);
ALTER TABLE bank_payments ADD CONSTRAINT chk_aviso_es_cobro CHECK (COALESCE(((crudo ->> 'es_credito'::text))::boolean, true));
CREATE UNIQUE INDEX bank_payments_message_id_key ON public.bank_payments USING btree (message_id);
CREATE INDEX bank_payments_cruce_idx ON public.bank_payments USING btree (tenant_id, monto, fecha_pago DESC) WHERE (usado_por_pedido IS NULL);
CREATE UNIQUE INDEX bank_payments_huella_uidx ON public.bank_payments USING btree (tenant_id, huella);
