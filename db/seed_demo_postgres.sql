-- ============================================================================
-- DATOS DE DEMOSTRACIÓN (PostgreSQL) — restaurante ficticio "Restaurante Demo"
-- Ningún dato real: nombres, teléfonos y pedidos son inventados ✅
-- Uso: psql -f db/seed_demo_postgres.sql  (con el esquema ya cargado)
-- ============================================================================

-- 1) Configuración del negocio demo (tenant 99)
INSERT INTO restaurant_config (tenant_id, key, value) VALUES
  (99, 'manager_fcm_token', 'token-demo-no-real'),
  (99, 'pagos_auto', 'false')
ON CONFLICT DO NOTHING;

-- 2) Domiciliario de ejemplo (PIN 1234 → hash de la app; cámbialo en el demo)
INSERT INTO delivery_riders (name, phone, pin_hash, is_active, tenant_id)
VALUES ('Domiciliario Demo', '573000000001', 'demo-hash-cambiar', true, 99)
ON CONFLICT DO NOTHING;

-- 3) Sesión del bot (para ver la conversación en el panel)
INSERT INTO bot_sessions (phone, phone_number_id, tenant_id, business_name, state, followups_sent, last_human_at, updated_at)
VALUES ('573000000002', '1000000000000000', 99, 'Restaurante Demo', 'flow', 0, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- 4) Tres pedidos de ejemplo: uno entregado, uno en «Preparando» y uno en «Verificar pago»
INSERT INTO orders (tenant_id, customer_name, customer_phone, order_type, products, total, shipping_cost,
                    delivery_address, payment_method, status, created_at, updated_at, confirmed_at, delivered_at)
VALUES
  (99, 'Cliente Demo 1', '573000000003', 'Domicilio',
   '[{"nombre":"Hamburguesa demo","precio":18000,"cantidad":1},{"nombre":"Gaseosa","precio":4000,"cantidad":1}]'::jsonb,
   18000, 4000, 'Calle 00 #00-00, Barrio Demo', 'Efectivo', 'delivered',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),

  (99, 'Cliente Demo 2', '573000000004', 'Domicilio',
   '[{"nombre":"Pizza demo","precio":26000,"cantidad":1}]'::jsonb,
   26000, 4000, 'Carrera 00 #11-22, Barrio Demo', 'Nequi', 'preparing',
   NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '25 minutes', NULL),

  (99, 'Cliente Demo 3', '573000000005', 'Recoger',
   '[{"nombre":"Combo demo","precio":22000,"cantidad":1}]'::jsonb,
   22000, 0, NULL, 'Nequi', 'awaiting_verification',
   NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', NULL, NULL)
ON CONFLICT DO NOTHING;

-- 5) Un pago bancario simulado (para ver el panel de pagos recibidos)
INSERT INTO bank_payments (tenant_id, proveedor, message_id, huella, monto, pagador, banco_origen,
                           titular_cuenta, fecha_pago, spf, dkim, dmarc, crudo)
VALUES (99, 'Nequi', 'demo-message-id@example.com', 'demo-huella-1', 26000, 'Cliente Demo 2', 'Bancolombia',
        'Restaurante Demo', NOW() - INTERVAL '25 minutes', 'pass', 'pass', 'pass',
        '{"detalle":"Bre-B (demo)","es_credito":true,"cuenta_destino":"****0000"}'::jsonb)
ON CONFLICT DO NOTHING;

-- 6) Auditoría de verificación de pago del pedido «Preparando»
INSERT INTO payment_verifications (order_id, verified_by, action, notes, tenant_id)
SELECT id, 'encargado-demo', 'approved', 'Demostración: pago verificado por el encargado', 99
FROM orders WHERE tenant_id = 99 AND customer_phone = '573000000004'
ON CONFLICT DO NOTHING;

-- Resultado esperado:
--   SELECT id, customer_name, status FROM orders WHERE tenant_id = 99;
--   → 3 pedidos: delivered, preparing, awaiting_verification ✅
