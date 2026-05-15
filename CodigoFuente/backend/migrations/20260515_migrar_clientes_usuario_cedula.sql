-- Migra clientes existentes para que usuario = cedula y clave inicial = cedula.
-- Alcance: usuarios con rol cliente (id_rol = 4) o vinculados a t_usuario_afiliado.
-- Requiere pgcrypto para generar hashes bcrypt compatibles con el login actual.
--
-- Ejecutar primero en una copia/respaldo de la base.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Validar clientes sin cedula.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM usuarios.t_usuario_sistema u
    WHERE (
      u.id_rol = 4
      OR EXISTS (
        SELECT 1
        FROM usuarios.t_usuario_afiliado a
        WHERE a.id_usuario_sistema = u.id_usuario_sistema
      )
    )
      AND (u.cedula IS NULL OR btrim(u.cedula) = '')
  ) THEN
    RAISE EXCEPTION 'Existen clientes sin cedula; complete esos datos antes de migrar.';
  END IF;
END $$;

-- Validar conflictos: otro registro ya usa como usuario la cedula destino.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM usuarios.t_usuario_sistema objetivo
    JOIN usuarios.t_usuario_sistema conflicto
      ON conflicto.usuario = btrim(objetivo.cedula)
     AND conflicto.id_usuario_sistema <> objetivo.id_usuario_sistema
    WHERE (
      objetivo.id_rol = 4
      OR EXISTS (
        SELECT 1
        FROM usuarios.t_usuario_afiliado a
        WHERE a.id_usuario_sistema = objetivo.id_usuario_sistema
      )
    )
  ) THEN
    RAISE EXCEPTION 'Hay conflictos: una cedula destino ya existe como usuario en otro registro.';
  END IF;
END $$;

-- Migrar clientes/afiliados.
UPDATE usuarios.t_usuario_sistema u
SET
  usuario = btrim(u.cedula),
  clave = crypt(btrim(u.cedula), gen_salt('bf', 12)),
  intentos_fallidos = 0,
  bloqueado_hasta = NULL,
  bloqueado_permanente = FALSE
WHERE (
  u.id_rol = 4
  OR EXISTS (
    SELECT 1
    FROM usuarios.t_usuario_afiliado a
    WHERE a.id_usuario_sistema = u.id_usuario_sistema
  )
)
  AND u.cedula IS NOT NULL
  AND btrim(u.cedula) <> '';

COMMIT;
