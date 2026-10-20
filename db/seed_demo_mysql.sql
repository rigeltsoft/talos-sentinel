-- ============================================================================
-- DATOS DE DEMOSTRACIÓN (MySQL / MariaDB) — usuarios y negocios
-- En el proyecto original el panel resuelve el negocio del usuario con
-- `findBusinessByUser(userId)`; por eso el demo necesita su usuario y negocio ✅
-- ============================================================================

-- Usuario demo (el login del panel se valida contra ADMIN_EMAIL / ADMIN_PASSWORD
-- del .env de la demo; esta fila es la que resuelve el NEGOCIO)
INSERT IGNORE INTO users (id, unionId, name, email, role, createdAt)
VALUES (99, 'demo-union-99', 'Usuario Demo', 'demo@talos.example', 'admin', NOW());

-- Negocio demo (tenant 99, el mismo que usan los pedidos del seed de Postgres)
INSERT IGNORE INTO businesses (id, userId, name, type, theme, phoneNumberId, apiBase,
                               liveMode, chatwootBaseUrl, chatwootAccountId, chatwootInboxId,
                               createdAt)
VALUES (99, 99, 'Restaurante Demo', 'restaurante', 'purpura', '1000000000000000',
        'http://localhost:5678', 0, NULL, NULL, NULL, NOW());

-- Resultado esperado:
--   SELECT b.id, b.name, u.email FROM businesses b JOIN users u ON u.id = b.userId WHERE b.id = 99;
--   → 99 | Restaurante Demo | demo@talos.example ✅
