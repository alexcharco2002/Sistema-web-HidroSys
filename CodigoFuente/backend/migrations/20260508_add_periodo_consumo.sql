-- Agrega periodo_consumo para separar:
-- - fecha_lectura: fecha real de toma/importacion
-- - periodo_consumo: periodo de consumo/facturacion (YYYY-MM)

BEGIN;

ALTER TABLE medidores.t_lecturas
ADD COLUMN IF NOT EXISTS periodo_consumo VARCHAR(7);

UPDATE medidores.t_lecturas l
SET periodo_consumo = COALESCE(
    f.periodo,
    to_char(l.fecha_lectura, 'YYYY-MM')
)
FROM facturacion.t_factura f
WHERE f.id_lectura = l.id_lectura
  AND l.periodo_consumo IS NULL;

UPDATE medidores.t_lecturas
SET periodo_consumo = to_char(fecha_lectura, 'YYYY-MM')
WHERE periodo_consumo IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM medidores.t_lecturas
        WHERE periodo_consumo !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ) THEN
        RAISE EXCEPTION 'Existen lecturas con periodo_consumo invalido';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM medidores.t_lecturas
        WHERE periodo_consumo IS NULL
    ) THEN
        RAISE EXCEPTION 'Existen lecturas sin periodo_consumo';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM medidores.t_lecturas
        WHERE activo = TRUE
        GROUP BY id_medidor, periodo_consumo
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existen lecturas activas duplicadas por medidor y periodo_consumo';
    END IF;
END $$;

ALTER TABLE medidores.t_lecturas
ALTER COLUMN periodo_consumo SET NOT NULL;

ALTER TABLE medidores.t_lecturas
DROP CONSTRAINT IF EXISTS unique_medidor_periodo;

DROP INDEX IF EXISTS medidores.unique_medidor_periodo_activo_idx;

CREATE UNIQUE INDEX unique_medidor_periodo_activo_idx
ON medidores.t_lecturas (id_medidor, periodo_consumo)
WHERE activo = TRUE;

ALTER TABLE medidores.t_lecturas
DROP CONSTRAINT IF EXISTS chk_lecturas_periodo_consumo_formato;

ALTER TABLE medidores.t_lecturas
ADD CONSTRAINT chk_lecturas_periodo_consumo_formato
CHECK (periodo_consumo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

CREATE INDEX IF NOT EXISTS idx_lecturas_periodo_consumo
ON medidores.t_lecturas (periodo_consumo);

CREATE INDEX IF NOT EXISTS idx_lecturas_medidor_periodo_consumo_activo
ON medidores.t_lecturas (id_medidor, periodo_consumo, activo);

COMMIT;
