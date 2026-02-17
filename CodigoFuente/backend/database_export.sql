--
-- PostgreSQL database dump
--

-- Dumped from database version 17.0
-- Dumped by pg_dump version 17.0

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
-- Name: auditoria; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auditoria;


ALTER SCHEMA auditoria OWNER TO postgres;

--
-- Name: configuracion; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA configuracion;


ALTER SCHEMA configuracion OWNER TO postgres;

--
-- Name: facturacion; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA facturacion;


ALTER SCHEMA facturacion OWNER TO postgres;

--
-- Name: medidores; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA medidores;


ALTER SCHEMA medidores OWNER TO postgres;

--
-- Name: multas; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA multas;


ALTER SCHEMA multas OWNER TO postgres;

--
-- Name: notificaciones; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA notificaciones;


ALTER SCHEMA notificaciones OWNER TO postgres;

--
-- Name: pgagent; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA pgagent;


ALTER SCHEMA pgagent OWNER TO postgres;

--
-- Name: SCHEMA pgagent; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA pgagent IS 'pgAgent system tables';


--
-- Name: seguridad; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA seguridad;


ALTER SCHEMA seguridad OWNER TO postgres;

--
-- Name: usuarios; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA usuarios;


ALTER SCHEMA usuarios OWNER TO postgres;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgagent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgagent WITH SCHEMA pgagent;


--
-- Name: EXTENSION pgagent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgagent IS 'A PostgreSQL job scheduler';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: actualizar_fecha_iva(); Type: FUNCTION; Schema: configuracion; Owner: postgres
--

CREATE FUNCTION configuracion.actualizar_fecha_iva() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION configuracion.actualizar_fecha_iva() OWNER TO postgres;

--
-- Name: obtener_ivas_activos(); Type: FUNCTION; Schema: configuracion; Owner: postgres
--

CREATE FUNCTION configuracion.obtener_ivas_activos() RETURNS TABLE(id_iva integer, codigo character varying, descripcion character varying, porcentaje numeric, es_no_aplicable boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id_iva,
        i.codigo,
        i.descripcion,
        i.porcentaje,
        i.es_no_aplicable
    FROM configuracion.t_iva i
    WHERE i.activo = true
    ORDER BY i.es_no_aplicable ASC, i.porcentaje DESC;
END;
$$;


ALTER FUNCTION configuracion.obtener_ivas_activos() OWNER TO postgres;

--
-- Name: sincronizar_num_medidor_a_afiliado(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sincronizar_num_medidor_a_afiliado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Actualizar en t_usuario_afiliado cuando cambie en t_medidor
    UPDATE usuarios.t_usuario_afiliado
    SET num_medidor = NEW.num_medidor
    WHERE id_usuario_afi = NEW.id_usuario_afi;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.sincronizar_num_medidor_a_afiliado() OWNER TO postgres;

--
-- Name: actualizar_fecha_modificacion_config(); Type: FUNCTION; Schema: seguridad; Owner: postgres
--

CREATE FUNCTION seguridad.actualizar_fecha_modificacion_config() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_modificacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION seguridad.actualizar_fecha_modificacion_config() OWNER TO postgres;

--
-- Name: limpiar_historial_antiguo(); Type: FUNCTION; Schema: seguridad; Owner: postgres
--

CREATE FUNCTION seguridad.limpiar_historial_antiguo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Mantener solo las últimas 5 contraseñas por usuario
    DELETE FROM seguridad.t_historial_contrasenas
    WHERE id_usuario_sistema = NEW.id_usuario_sistema
    AND id_historial NOT IN (
        SELECT id_historial
        FROM seguridad.t_historial_contrasenas
        WHERE id_usuario_sistema = NEW.id_usuario_sistema
        ORDER BY fecha_cambio DESC
        LIMIT 5
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION seguridad.limpiar_historial_antiguo() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: t_auditoria_sistema; Type: TABLE; Schema: auditoria; Owner: postgres
--

CREATE TABLE auditoria.t_auditoria_sistema (
    id_auditoria_sistema integer NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    accion character varying(100) NOT NULL,
    descripcion text,
    id_usuario_sistema integer
);


ALTER TABLE auditoria.t_auditoria_sistema OWNER TO postgres;

--
-- Name: t_auditoria_sistema_id_seq; Type: SEQUENCE; Schema: auditoria; Owner: postgres
--

CREATE SEQUENCE auditoria.t_auditoria_sistema_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auditoria.t_auditoria_sistema_id_seq OWNER TO postgres;

--
-- Name: t_auditoria_sistema_id_seq; Type: SEQUENCE OWNED BY; Schema: auditoria; Owner: postgres
--

ALTER SEQUENCE auditoria.t_auditoria_sistema_id_seq OWNED BY auditoria.t_auditoria_sistema.id_auditoria_sistema;


--
-- Name: t_limites_geograficos; Type: TABLE; Schema: configuracion; Owner: postgres
--

CREATE TABLE configuracion.t_limites_geograficos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    norte numeric(10,7) NOT NULL,
    sur numeric(10,7) NOT NULL,
    este numeric(10,7) NOT NULL,
    oeste numeric(10,7) NOT NULL,
    poligono_geojson jsonb,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    altitud_min numeric(10,2),
    altitud_max numeric(10,2)
);


ALTER TABLE configuracion.t_limites_geograficos OWNER TO postgres;

--
-- Name: limites_geograficos_id_seq; Type: SEQUENCE; Schema: configuracion; Owner: postgres
--

CREATE SEQUENCE configuracion.limites_geograficos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE configuracion.limites_geograficos_id_seq OWNER TO postgres;

--
-- Name: limites_geograficos_id_seq; Type: SEQUENCE OWNED BY; Schema: configuracion; Owner: postgres
--

ALTER SEQUENCE configuracion.limites_geograficos_id_seq OWNED BY configuracion.t_limites_geograficos.id;


--
-- Name: t_configuracion_backup; Type: TABLE; Schema: configuracion; Owner: postgres
--

CREATE TABLE configuracion.t_configuracion_backup (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    backup_diario_habilitado boolean DEFAULT true,
    backup_hour integer DEFAULT 2,
    backup_minute integer DEFAULT 0,
    backup_12h_habilitado boolean DEFAULT false,
    backup_semanal_habilitado boolean DEFAULT true,
    backup_semanal_dia character varying(10) DEFAULT 'sun'::character varying,
    backup_semanal_hora integer DEFAULT 3,
    retention_days integer DEFAULT 30,
    max_backups integer DEFAULT 50,
    limpieza_habilitada boolean DEFAULT true,
    limpieza_dia character varying(10) DEFAULT 'sun'::character varying,
    limpieza_hora integer DEFAULT 3,
    verificacion_salud_habilitada boolean DEFAULT true,
    verificacion_salud_hora integer DEFAULT 8,
    notificar_exito boolean DEFAULT false,
    notificar_error boolean DEFAULT true,
    notificar_espacio_bajo boolean DEFAULT true,
    umbral_espacio_gb integer DEFAULT 5,
    dias_excepciones jsonb,
    horarios_personalizados jsonb,
    backup_local_habilitado boolean DEFAULT true,
    backup_nube_habilitado boolean DEFAULT false,
    backup_nube_provider character varying(50),
    backup_nube_config jsonb,
    cifrado_habilitado boolean DEFAULT false,
    cifrado_algoritmo character varying(50) DEFAULT 'aes-256-cbc'::character varying,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_por integer,
    CONSTRAINT t_configuracion_backup_backup_hour_check CHECK (((backup_hour >= 0) AND (backup_hour <= 23))),
    CONSTRAINT t_configuracion_backup_backup_minute_check CHECK (((backup_minute >= 0) AND (backup_minute <= 59))),
    CONSTRAINT t_configuracion_backup_max_backups_check CHECK ((max_backups > 0)),
    CONSTRAINT t_configuracion_backup_retention_days_check CHECK ((retention_days > 0))
);


ALTER TABLE configuracion.t_configuracion_backup OWNER TO postgres;

--
-- Name: TABLE t_configuracion_backup; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON TABLE configuracion.t_configuracion_backup IS 'Configuración del sistema de backups automáticos';


--
-- Name: COLUMN t_configuracion_backup.dias_excepciones; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON COLUMN configuracion.t_configuracion_backup.dias_excepciones IS 'Fechas en las que NO se ejecutan backups';


--
-- Name: COLUMN t_configuracion_backup.horarios_personalizados; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON COLUMN configuracion.t_configuracion_backup.horarios_personalizados IS 'Horarios adicionales configurados por el usuario';


--
-- Name: t_configuracion_backup_id_seq; Type: SEQUENCE; Schema: configuracion; Owner: postgres
--

CREATE SEQUENCE configuracion.t_configuracion_backup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE configuracion.t_configuracion_backup_id_seq OWNER TO postgres;

--
-- Name: t_configuracion_backup_id_seq; Type: SEQUENCE OWNED BY; Schema: configuracion; Owner: postgres
--

ALTER SEQUENCE configuracion.t_configuracion_backup_id_seq OWNED BY configuracion.t_configuracion_backup.id;


--
-- Name: t_iva; Type: TABLE; Schema: configuracion; Owner: postgres
--

CREATE TABLE configuracion.t_iva (
    id_iva integer NOT NULL,
    codigo character varying(10) NOT NULL,
    descripcion character varying(100) NOT NULL,
    porcentaje numeric(5,2) NOT NULL,
    es_aplicable boolean DEFAULT false NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_porcentaje_valido CHECK (((porcentaje >= (0)::numeric) AND (porcentaje <= (100)::numeric)))
);


ALTER TABLE configuracion.t_iva OWNER TO postgres;

--
-- Name: TABLE t_iva; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON TABLE configuracion.t_iva IS 'Catálogo de tasas de IVA para facturación de agua';


--
-- Name: COLUMN t_iva.codigo; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON COLUMN configuracion.t_iva.codigo IS 'Código único del IVA (ej: IVA12, NO_APLICA)';


--
-- Name: COLUMN t_iva.es_aplicable; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON COLUMN configuracion.t_iva.es_aplicable IS 'true = opción para NO aplicar IVA';


--
-- Name: COLUMN t_iva.activo; Type: COMMENT; Schema: configuracion; Owner: postgres
--

COMMENT ON COLUMN configuracion.t_iva.activo IS 'false = deshabilitado (borrado lógico)';


--
-- Name: t_iva_id_iva_seq; Type: SEQUENCE; Schema: configuracion; Owner: postgres
--

CREATE SEQUENCE configuracion.t_iva_id_iva_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE configuracion.t_iva_id_iva_seq OWNER TO postgres;

--
-- Name: t_iva_id_iva_seq; Type: SEQUENCE OWNED BY; Schema: configuracion; Owner: postgres
--

ALTER SEQUENCE configuracion.t_iva_id_iva_seq OWNED BY configuracion.t_iva.id_iva;


--
-- Name: t_asignacion_servicio_permanente; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_asignacion_servicio_permanente (
    id_asignacion_sp integer NOT NULL,
    id_configuracion_sp integer NOT NULL,
    id_usuario_afi integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    fecha_asignacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    asignado_por integer,
    observaciones text,
    CONSTRAINT chk_fechas_asignacion CHECK (((fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)))
);


ALTER TABLE facturacion.t_asignacion_servicio_permanente OWNER TO postgres;

--
-- Name: t_asignacion_servicio_permanente_id_asignacion_sp_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_asignacion_servicio_permanente_id_asignacion_sp_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_asignacion_servicio_permanente_id_asignacion_sp_seq OWNER TO postgres;

--
-- Name: t_asignacion_servicio_permanente_id_asignacion_sp_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_asignacion_servicio_permanente_id_asignacion_sp_seq OWNED BY facturacion.t_asignacion_servicio_permanente.id_asignacion_sp;


--
-- Name: t_configuracion_mora; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_configuracion_mora (
    id_configuracion_mora integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    aplicar_mora boolean DEFAULT true,
    activo boolean DEFAULT true,
    dias_gracia integer DEFAULT 0,
    tipo_calculo character varying(20),
    porcentaje_mora numeric(5,2),
    valor_fijo numeric(10,2),
    interes_diario numeric(5,4),
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    vigencia_desde date NOT NULL,
    vigencia_hasta date,
    es_vigente boolean DEFAULT true,
    mora_maxima numeric(10,2),
    aplicar_sobre character varying(20),
    tipo_periodo character varying(20) DEFAULT 'dias'::character varying NOT NULL,
    meses_gracia integer DEFAULT 0,
    CONSTRAINT t_configuracion_mora_aplicar_sobre_check CHECK (((aplicar_sobre)::text = ANY (ARRAY[('total'::character varying)::text, ('consumo'::character varying)::text, ('base'::character varying)::text]))),
    CONSTRAINT t_configuracion_mora_dias_gracia_check CHECK ((dias_gracia >= 0)),
    CONSTRAINT t_configuracion_mora_meses_gracia_check CHECK (((meses_gracia >= 0) AND (meses_gracia <= 12))),
    CONSTRAINT t_configuracion_mora_tipo_calculo_check CHECK (((tipo_calculo)::text = ANY (ARRAY[('porcentaje'::character varying)::text, ('fijo'::character varying)::text, ('interes_diario'::character varying)::text]))),
    CONSTRAINT t_configuracion_mora_tipo_periodo_check CHECK (((tipo_periodo)::text = ANY ((ARRAY['dias'::character varying, 'meses'::character varying])::text[])))
);


ALTER TABLE facturacion.t_configuracion_mora OWNER TO postgres;

--
-- Name: COLUMN t_configuracion_mora.dias_gracia; Type: COMMENT; Schema: facturacion; Owner: postgres
--

COMMENT ON COLUMN facturacion.t_configuracion_mora.dias_gracia IS 'Número de días de gracia antes de aplicar mora (usado cuando tipo_periodo=dias)';


--
-- Name: COLUMN t_configuracion_mora.tipo_periodo; Type: COMMENT; Schema: facturacion; Owner: postgres
--

COMMENT ON COLUMN facturacion.t_configuracion_mora.tipo_periodo IS 'Tipo de periodo de gracia: dias (por días corridos) o meses (por cambio de mes calendario)';


--
-- Name: COLUMN t_configuracion_mora.meses_gracia; Type: COMMENT; Schema: facturacion; Owner: postgres
--

COMMENT ON COLUMN facturacion.t_configuracion_mora.meses_gracia IS 'Número de meses de gracia antes de aplicar mora (usado cuando tipo_periodo=meses). Si es 0, aplica al siguiente mes.';


--
-- Name: t_configuracion_mora_id_configuracion_mora_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_configuracion_mora_id_configuracion_mora_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_configuracion_mora_id_configuracion_mora_seq OWNER TO postgres;

--
-- Name: t_configuracion_mora_id_configuracion_mora_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_configuracion_mora_id_configuracion_mora_seq OWNED BY facturacion.t_configuracion_mora.id_configuracion_mora;


--
-- Name: t_configuracion_servicio_permanente; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_configuracion_servicio_permanente (
    id_configuracion_sp integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    aplicar_servicio boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT false NOT NULL,
    id_servicio integer NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vigencia_desde date NOT NULL,
    vigencia_hasta date,
    es_vigente boolean DEFAULT true NOT NULL,
    aplicar_en_periodo character varying(20) DEFAULT 'mensual'::character varying NOT NULL,
    precio_override numeric(10,2),
    observaciones text,
    CONSTRAINT chk_aplicar_en_periodo CHECK (((aplicar_en_periodo)::text = ANY ((ARRAY['mensual'::character varying, 'bimestral'::character varying, 'trimestral'::character varying])::text[]))),
    CONSTRAINT chk_precio_override_positivo CHECK (((precio_override IS NULL) OR (precio_override >= (0)::numeric))),
    CONSTRAINT chk_vigencia_fechas CHECK (((vigencia_hasta IS NULL) OR (vigencia_hasta >= vigencia_desde)))
);


ALTER TABLE facturacion.t_configuracion_servicio_permanente OWNER TO postgres;

--
-- Name: t_configuracion_servicio_permanente_id_configuracion_sp_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_configuracion_servicio_permanente_id_configuracion_sp_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_configuracion_servicio_permanente_id_configuracion_sp_seq OWNER TO postgres;

--
-- Name: t_configuracion_servicio_permanente_id_configuracion_sp_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_configuracion_servicio_permanente_id_configuracion_sp_seq OWNED BY facturacion.t_configuracion_servicio_permanente.id_configuracion_sp;


--
-- Name: t_detalle_factura; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_detalle_factura (
    id_detalle integer NOT NULL,
    id_factura integer NOT NULL,
    id_servicio integer,
    subtotal_detalle numeric(10,2),
    descripcion text,
    id_multa_afiliados integer,
    tipo_detalle character varying(20) DEFAULT 'servicio'::character varying NOT NULL,
    id_asignacion_sp integer,
    CONSTRAINT chk_detalle_tipo_coherente CHECK (((((tipo_detalle)::text = 'servicio'::text) AND (id_servicio IS NOT NULL)) OR (((tipo_detalle)::text = 'multa'::text) AND (id_multa_afiliados IS NOT NULL)) OR (((tipo_detalle)::text = 'consumo'::text) AND (id_servicio IS NULL) AND (id_multa_afiliados IS NULL)) OR ((tipo_detalle)::text <> ALL (ARRAY[('servicio'::character varying)::text, ('multa'::character varying)::text, ('consumo'::character varying)::text]))))
);


ALTER TABLE facturacion.t_detalle_factura OWNER TO postgres;

--
-- Name: COLUMN t_detalle_factura.id_asignacion_sp; Type: COMMENT; Schema: facturacion; Owner: postgres
--

COMMENT ON COLUMN facturacion.t_detalle_factura.id_asignacion_sp IS 'Si el detalle fue generado automáticamente por un servicio permanente, referencia a la asignación que lo generó';


--
-- Name: t_factura; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_factura (
    id_factura integer NOT NULL,
    num_factura character varying(50),
    id_usuario_afi integer,
    id_lectura integer,
    consumo_m3 integer,
    valor_consumo numeric(10,2),
    valor_exceso numeric(10,2),
    descuento numeric(10,2),
    subtotal numeric(10,2),
    impuesto numeric(10,2),
    total numeric(10,2),
    fecha_emision date DEFAULT CURRENT_DATE,
    exceso_m3 integer,
    id_tarifa integer,
    estado_factura character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    periodo character varying(7) NOT NULL
);


ALTER TABLE facturacion.t_factura OWNER TO postgres;

--
-- Name: t_factura_cod_factura_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_factura_cod_factura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_factura_cod_factura_seq OWNER TO postgres;

--
-- Name: t_factura_cod_factura_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_factura_cod_factura_seq OWNED BY facturacion.t_factura.id_factura;


--
-- Name: t_factura_servicio_cod_factura_servicio_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_factura_servicio_cod_factura_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_factura_servicio_cod_factura_servicio_seq OWNER TO postgres;

--
-- Name: t_factura_servicio_cod_factura_servicio_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_factura_servicio_cod_factura_servicio_seq OWNED BY facturacion.t_detalle_factura.id_detalle;


--
-- Name: t_mora_factura; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_mora_factura (
    id_mora integer NOT NULL,
    id_factura integer,
    id_configuracion_mora integer,
    monto_base numeric(10,2),
    dias_mora integer,
    tipo_calculo character varying(20),
    tasa_aplicada numeric(5,2),
    monto_mora numeric(10,2) NOT NULL,
    fecha_calculo timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    aplicada boolean DEFAULT false,
    fecha_aplicacion timestamp without time zone,
    observaciones text
);


ALTER TABLE facturacion.t_mora_factura OWNER TO postgres;

--
-- Name: t_mora_factura_id_mora_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_mora_factura_id_mora_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_mora_factura_id_mora_seq OWNER TO postgres;

--
-- Name: t_mora_factura_id_mora_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_mora_factura_id_mora_seq OWNED BY facturacion.t_mora_factura.id_mora;


--
-- Name: t_pagos; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_pagos (
    id_pago integer NOT NULL,
    id_factura integer,
    monto_pago numeric(12,2),
    fecha_pago timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metodo_pago character varying(50),
    id_usuario_afi integer,
    id_cajero integer,
    observaciones text,
    motivo_anulacion character varying(200),
    fecha_anulacion timestamp with time zone,
    activo boolean DEFAULT true NOT NULL,
    estado_pago character varying(20) DEFAULT 'REGISTRADO'::character varying NOT NULL,
    comprobante_pdf bytea,
    nombre_archivo character varying(255),
    tipo_mime character varying(50) DEFAULT 'application/pdf'::character varying,
    CONSTRAINT chk_monto_pago_positivo CHECK ((monto_pago > (0)::numeric))
);


ALTER TABLE facturacion.t_pagos OWNER TO postgres;

--
-- Name: COLUMN t_pagos.comprobante_pdf; Type: COMMENT; Schema: facturacion; Owner: postgres
--

COMMENT ON COLUMN facturacion.t_pagos.comprobante_pdf IS 'Contenido binario del PDF del comprobante';


--
-- Name: t_pagos_cod_pago_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_pagos_cod_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_pagos_cod_pago_seq OWNER TO postgres;

--
-- Name: t_pagos_cod_pago_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_pagos_cod_pago_seq OWNED BY facturacion.t_pagos.id_pago;


--
-- Name: t_tarifa; Type: TABLE; Schema: facturacion; Owner: postgres
--

CREATE TABLE facturacion.t_tarifa (
    id_tarifa integer NOT NULL,
    nombre character varying(100) NOT NULL,
    detalle text,
    precio_por_m3 numeric(10,2) NOT NULL,
    limite_min_m3 numeric(10,2) NOT NULL,
    limite_max_m3 numeric(10,2),
    tipo_tarifa character varying(50) NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    activo boolean NOT NULL,
    vigencia_desde timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vigencia_hasta timestamp with time zone,
    es_vigente boolean DEFAULT true NOT NULL,
    CONSTRAINT check_limites_coherentes CHECK (((limite_max_m3 IS NULL) OR (limite_max_m3 > limite_min_m3)))
);


ALTER TABLE facturacion.t_tarifa OWNER TO postgres;

--
-- Name: t_tarifa_cod_tarifa_seq; Type: SEQUENCE; Schema: facturacion; Owner: postgres
--

CREATE SEQUENCE facturacion.t_tarifa_cod_tarifa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE facturacion.t_tarifa_cod_tarifa_seq OWNER TO postgres;

--
-- Name: t_tarifa_cod_tarifa_seq; Type: SEQUENCE OWNED BY; Schema: facturacion; Owner: postgres
--

ALTER SEQUENCE facturacion.t_tarifa_cod_tarifa_seq OWNED BY facturacion.t_tarifa.id_tarifa;


--
-- Name: t_historial_medidor; Type: TABLE; Schema: medidores; Owner: postgres
--

CREATE TABLE medidores.t_historial_medidor (
    id_historial integer NOT NULL,
    id_medidor integer NOT NULL,
    id_usuario_afi_anterior integer,
    id_usuario_afi_nuevo integer,
    fecha_cambio timestamp with time zone DEFAULT now() NOT NULL,
    motivo_cambio character varying(255),
    costo_cambio numeric(10,2),
    id_usuario_sistema integer NOT NULL,
    observaciones text,
    activo boolean DEFAULT true NOT NULL,
    facturado boolean DEFAULT false NOT NULL
);


ALTER TABLE medidores.t_historial_medidor OWNER TO postgres;

--
-- Name: t_historial_medidor_id_historial_seq; Type: SEQUENCE; Schema: medidores; Owner: postgres
--

CREATE SEQUENCE medidores.t_historial_medidor_id_historial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE medidores.t_historial_medidor_id_historial_seq OWNER TO postgres;

--
-- Name: t_historial_medidor_id_historial_seq; Type: SEQUENCE OWNED BY; Schema: medidores; Owner: postgres
--

ALTER SEQUENCE medidores.t_historial_medidor_id_historial_seq OWNED BY medidores.t_historial_medidor.id_historial;


--
-- Name: t_lecturas; Type: TABLE; Schema: medidores; Owner: postgres
--

CREATE TABLE medidores.t_lecturas (
    id_lectura integer NOT NULL,
    id_medidor integer,
    lectura_actual integer,
    lectura_anterior integer,
    consumo_m3 integer,
    fecha_lectura date,
    id_lector integer,
    observacion text,
    activo boolean,
    es_estimada boolean DEFAULT false
);


ALTER TABLE medidores.t_lecturas OWNER TO postgres;

--
-- Name: t_lecturas_cod_lectura_seq; Type: SEQUENCE; Schema: medidores; Owner: postgres
--

CREATE SEQUENCE medidores.t_lecturas_cod_lectura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE medidores.t_lecturas_cod_lectura_seq OWNER TO postgres;

--
-- Name: t_lecturas_cod_lectura_seq; Type: SEQUENCE OWNED BY; Schema: medidores; Owner: postgres
--

ALTER SEQUENCE medidores.t_lecturas_cod_lectura_seq OWNED BY medidores.t_lecturas.id_lectura;


--
-- Name: t_medidor; Type: TABLE; Schema: medidores; Owner: postgres
--

CREATE TABLE medidores.t_medidor (
    id_medidor integer NOT NULL,
    num_medidor character varying(50),
    id_usuario_afi integer,
    id_sector integer,
    latitud double precision,
    longitud double precision,
    altitud numeric(10,2),
    activo boolean
);


ALTER TABLE medidores.t_medidor OWNER TO postgres;

--
-- Name: t_medidor_cod_medidor_seq; Type: SEQUENCE; Schema: medidores; Owner: postgres
--

CREATE SEQUENCE medidores.t_medidor_cod_medidor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE medidores.t_medidor_cod_medidor_seq OWNER TO postgres;

--
-- Name: t_medidor_cod_medidor_seq; Type: SEQUENCE OWNED BY; Schema: medidores; Owner: postgres
--

ALTER SEQUENCE medidores.t_medidor_cod_medidor_seq OWNED BY medidores.t_medidor.id_medidor;


--
-- Name: t_sector; Type: TABLE; Schema: medidores; Owner: postgres
--

CREATE TABLE medidores.t_sector (
    id_sector integer NOT NULL,
    nombre_sector character varying(100),
    descripcion text,
    activo boolean
);


ALTER TABLE medidores.t_sector OWNER TO postgres;

--
-- Name: t_sector_cod_sector_seq; Type: SEQUENCE; Schema: medidores; Owner: postgres
--

CREATE SEQUENCE medidores.t_sector_cod_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE medidores.t_sector_cod_sector_seq OWNER TO postgres;

--
-- Name: t_sector_cod_sector_seq; Type: SEQUENCE OWNED BY; Schema: medidores; Owner: postgres
--

ALTER SEQUENCE medidores.t_sector_cod_sector_seq OWNED BY medidores.t_sector.id_sector;


--
-- Name: t_servicios; Type: TABLE; Schema: medidores; Owner: postgres
--

CREATE TABLE medidores.t_servicios (
    id_servicio integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    precio_base numeric(10,2) NOT NULL,
    activo boolean NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vigencia_desde timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    vigencia_hasta timestamp with time zone,
    es_vigente boolean DEFAULT true NOT NULL
);


ALTER TABLE medidores.t_servicios OWNER TO postgres;

--
-- Name: t_servicios_cod_servicio_seq; Type: SEQUENCE; Schema: medidores; Owner: postgres
--

CREATE SEQUENCE medidores.t_servicios_cod_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE medidores.t_servicios_cod_servicio_seq OWNER TO postgres;

--
-- Name: t_servicios_cod_servicio_seq; Type: SEQUENCE OWNED BY; Schema: medidores; Owner: postgres
--

ALTER SEQUENCE medidores.t_servicios_cod_servicio_seq OWNED BY medidores.t_servicios.id_servicio;


--
-- Name: t_multa; Type: TABLE; Schema: multas; Owner: postgres
--

CREATE TABLE multas.t_multa (
    id_tipo_multa integer NOT NULL,
    nombre_multa character varying(100) NOT NULL,
    descripcion text,
    monto numeric(10,2),
    activo boolean DEFAULT true,
    vigencia_desde timestamp with time zone DEFAULT now() NOT NULL,
    vigencia_hasta timestamp with time zone,
    es_vigente boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE multas.t_multa OWNER TO postgres;

--
-- Name: t_multa_cod_tipo_multa_seq; Type: SEQUENCE; Schema: multas; Owner: postgres
--

CREATE SEQUENCE multas.t_multa_cod_tipo_multa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE multas.t_multa_cod_tipo_multa_seq OWNER TO postgres;

--
-- Name: t_multa_cod_tipo_multa_seq; Type: SEQUENCE OWNED BY; Schema: multas; Owner: postgres
--

ALTER SEQUENCE multas.t_multa_cod_tipo_multa_seq OWNED BY multas.t_multa.id_tipo_multa;


--
-- Name: t_multas_afiliados; Type: TABLE; Schema: multas; Owner: postgres
--

CREATE TABLE multas.t_multas_afiliados (
    id_multa_afi integer NOT NULL,
    id_usuario_afi integer NOT NULL,
    id_tipo_multa integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    fecha_multa date DEFAULT CURRENT_DATE NOT NULL,
    fecha_pago date,
    observaciones text,
    activo boolean DEFAULT true,
    estado character varying(20) DEFAULT 'pendiente'::character varying,
    facturado boolean DEFAULT false NOT NULL,
    CONSTRAINT t_multas_afiliados_fecha_check CHECK (((fecha_pago IS NULL) OR (fecha_pago >= fecha_multa)))
);


ALTER TABLE multas.t_multas_afiliados OWNER TO postgres;

--
-- Name: t_multas_usuario_cod_multa_usuario_seq; Type: SEQUENCE; Schema: multas; Owner: postgres
--

CREATE SEQUENCE multas.t_multas_usuario_cod_multa_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE multas.t_multas_usuario_cod_multa_usuario_seq OWNER TO postgres;

--
-- Name: t_multas_usuario_cod_multa_usuario_seq; Type: SEQUENCE OWNED BY; Schema: multas; Owner: postgres
--

ALTER SEQUENCE multas.t_multas_usuario_cod_multa_usuario_seq OWNED BY multas.t_multas_afiliados.id_multa_afi;


--
-- Name: t_notificaciones; Type: TABLE; Schema: notificaciones; Owner: postgres
--

CREATE TABLE notificaciones.t_notificaciones (
    id_notificacion integer NOT NULL,
    id_usuario_sistema integer,
    titulo character varying(100),
    mensaje text,
    tipo character varying(50),
    estado character varying(20),
    fecha_creacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_leido timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    es_mantenimiento boolean DEFAULT false NOT NULL,
    fecha_inicio_mantenimiento timestamp without time zone,
    fecha_fin_mantenimiento timestamp without time zone,
    modulos_afectados text,
    enviar_email boolean DEFAULT false NOT NULL,
    email_enviado boolean DEFAULT false NOT NULL,
    fecha_envio_email timestamp without time zone,
    prioridad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    duracion_estimada character varying(50)
);


ALTER TABLE notificaciones.t_notificaciones OWNER TO postgres;

--
-- Name: COLUMN t_notificaciones.es_mantenimiento; Type: COMMENT; Schema: notificaciones; Owner: postgres
--

COMMENT ON COLUMN notificaciones.t_notificaciones.es_mantenimiento IS 'Indica si es una notificación de mantenimiento programado';


--
-- Name: COLUMN t_notificaciones.fecha_inicio_mantenimiento; Type: COMMENT; Schema: notificaciones; Owner: postgres
--

COMMENT ON COLUMN notificaciones.t_notificaciones.fecha_inicio_mantenimiento IS 'Fecha y hora de inicio del mantenimiento';


--
-- Name: COLUMN t_notificaciones.prioridad; Type: COMMENT; Schema: notificaciones; Owner: postgres
--

COMMENT ON COLUMN notificaciones.t_notificaciones.prioridad IS 'Prioridad: baja, media, alta, critica';


--
-- Name: t_notificaciones_cod_notificacion_seq; Type: SEQUENCE; Schema: notificaciones; Owner: postgres
--

CREATE SEQUENCE notificaciones.t_notificaciones_cod_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE notificaciones.t_notificaciones_cod_notificacion_seq OWNER TO postgres;

--
-- Name: t_notificaciones_cod_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: notificaciones; Owner: postgres
--

ALTER SEQUENCE notificaciones.t_notificaciones_cod_notificacion_seq OWNED BY notificaciones.t_notificaciones.id_notificacion;


--
-- Name: respaldo_tarifa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.respaldo_tarifa (
    id_tarifa integer,
    nombre character varying(100),
    detalle text,
    precio_por_m3 numeric(10,2),
    limite_min_m3 numeric(10,2),
    limite_max_m3 numeric(10,2),
    tipo_tarifa character varying(50),
    fecha_creacion timestamp with time zone,
    activo boolean,
    vigencia_desde timestamp with time zone,
    vigencia_hasta timestamp with time zone,
    es_vigente boolean
);


ALTER TABLE public.respaldo_tarifa OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: t_auditoria_contrasenas; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_auditoria_contrasenas (
    id_auditoria integer NOT NULL,
    id_usuario_sistema integer NOT NULL,
    accion character varying(50) NOT NULL,
    motivo_rechazo character varying(255),
    fecha_hora timestamp without time zone DEFAULT now() NOT NULL,
    ip_origen character varying(45),
    user_agent character varying(255),
    exitoso boolean NOT NULL
);


ALTER TABLE seguridad.t_auditoria_contrasenas OWNER TO postgres;

--
-- Name: TABLE t_auditoria_contrasenas; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON TABLE seguridad.t_auditoria_contrasenas IS 'Auditoría de cambios de contraseña - ISO 27002 A.12.4.1';


--
-- Name: COLUMN t_auditoria_contrasenas.accion; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON COLUMN seguridad.t_auditoria_contrasenas.accion IS 'CAMBIO_EXITOSO, CAMBIO_RECHAZADO, INTENTO_REUTILIZAR';


--
-- Name: t_auditoria_contrasenas_id_auditoria_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_auditoria_contrasenas_id_auditoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_auditoria_contrasenas_id_auditoria_seq OWNER TO postgres;

--
-- Name: t_auditoria_contrasenas_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_auditoria_contrasenas_id_auditoria_seq OWNED BY seguridad.t_auditoria_contrasenas.id_auditoria;


--
-- Name: t_auditoria_sesiones; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_auditoria_sesiones (
    id_auditoria integer NOT NULL,
    id_usuario_sistema integer NOT NULL,
    usuario character varying(50) NOT NULL,
    evento character varying(50) NOT NULL,
    session_token character varying(255),
    ip_address character varying(45),
    user_agent text,
    navegador character varying(100),
    sistema_operativo character varying(100),
    dispositivo character varying(100),
    motivo character varying(255),
    exitoso boolean DEFAULT true NOT NULL,
    fecha_hora timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE seguridad.t_auditoria_sesiones OWNER TO postgres;

--
-- Name: TABLE t_auditoria_sesiones; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON TABLE seguridad.t_auditoria_sesiones IS 'Registro de auditoría de sesiones según ISO 27002';


--
-- Name: COLUMN t_auditoria_sesiones.evento; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON COLUMN seguridad.t_auditoria_sesiones.evento IS 'LOGIN, LOGOUT, SESSION_INVALIDATED, etc.';


--
-- Name: COLUMN t_auditoria_sesiones.session_token; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON COLUMN seguridad.t_auditoria_sesiones.session_token IS 'Token único de la sesión';


--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_auditoria_sesiones_id_auditoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_auditoria_sesiones_id_auditoria_seq OWNER TO postgres;

--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_auditoria_sesiones_id_auditoria_seq OWNED BY seguridad.t_auditoria_sesiones.id_auditoria;


--
-- Name: t_configuracion_sistema; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_configuracion_sistema (
    id_configuracion integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor character varying(500) NOT NULL,
    tipo_dato character varying(20) DEFAULT 'string'::character varying NOT NULL,
    descripcion text,
    categoria character varying(50) DEFAULT 'general'::character varying,
    modificable boolean DEFAULT true,
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modificado_por character varying(100)
);


ALTER TABLE seguridad.t_configuracion_sistema OWNER TO postgres;

--
-- Name: t_configuracion_sistema_id_configuracion_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_configuracion_sistema_id_configuracion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_configuracion_sistema_id_configuracion_seq OWNER TO postgres;

--
-- Name: t_configuracion_sistema_id_configuracion_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_configuracion_sistema_id_configuracion_seq OWNED BY seguridad.t_configuracion_sistema.id_configuracion;


--
-- Name: t_historial_contrasenas; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_historial_contrasenas (
    id_historial integer NOT NULL,
    id_usuario_sistema integer NOT NULL,
    clave_hash character varying(255) NOT NULL,
    fecha_cambio timestamp without time zone DEFAULT now() NOT NULL,
    cambiado_por_admin boolean DEFAULT false,
    motivo_cambio character varying(100),
    ip_cambio character varying(45)
);


ALTER TABLE seguridad.t_historial_contrasenas OWNER TO postgres;

--
-- Name: TABLE t_historial_contrasenas; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON TABLE seguridad.t_historial_contrasenas IS 'Historial de contraseñas por usuario - ISO 27002 A.9.4.3';


--
-- Name: COLUMN t_historial_contrasenas.clave_hash; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON COLUMN seguridad.t_historial_contrasenas.clave_hash IS 'Hash bcrypt de contraseña anterior';


--
-- Name: COLUMN t_historial_contrasenas.motivo_cambio; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON COLUMN seguridad.t_historial_contrasenas.motivo_cambio IS 'primer_login, voluntario, admin_reset, expiracion';


--
-- Name: t_historial_contrasenas_id_historial_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_historial_contrasenas_id_historial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_historial_contrasenas_id_historial_seq OWNER TO postgres;

--
-- Name: t_historial_contrasenas_id_historial_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_historial_contrasenas_id_historial_seq OWNED BY seguridad.t_historial_contrasenas.id_historial;


--
-- Name: t_rol_acciones; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_rol_acciones (
    id_rol_accion integer NOT NULL,
    id_rol integer NOT NULL,
    nombre_accion character varying(100) NOT NULL,
    tipo_accion character varying(20),
    activo boolean DEFAULT true,
    fecha_asignacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE seguridad.t_rol_acciones OWNER TO postgres;

--
-- Name: t_rol_acciones_id_rol_accion_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_rol_acciones_id_rol_accion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_rol_acciones_id_rol_accion_seq OWNER TO postgres;

--
-- Name: t_rol_acciones_id_rol_accion_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_rol_acciones_id_rol_accion_seq OWNED BY seguridad.t_rol_acciones.id_rol_accion;


--
-- Name: t_roles; Type: TABLE; Schema: seguridad; Owner: postgres
--

CREATE TABLE seguridad.t_roles (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE seguridad.t_roles OWNER TO postgres;

--
-- Name: t_roles_id_rol_seq; Type: SEQUENCE; Schema: seguridad; Owner: postgres
--

CREATE SEQUENCE seguridad.t_roles_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE seguridad.t_roles_id_rol_seq OWNER TO postgres;

--
-- Name: t_roles_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: seguridad; Owner: postgres
--

ALTER SEQUENCE seguridad.t_roles_id_rol_seq OWNED BY seguridad.t_roles.id_rol;


--
-- Name: t_usuario_sistema; Type: TABLE; Schema: usuarios; Owner: postgres
--

CREATE TABLE usuarios.t_usuario_sistema (
    id_usuario_sistema integer NOT NULL,
    usuario character varying(15) NOT NULL,
    clave text NOT NULL,
    nombres character varying(100),
    apellidos character varying(100),
    cedula character varying(10),
    email character varying(50),
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    foto bytea,
    telefono character varying(10),
    direccion character varying(255),
    activo boolean DEFAULT true,
    sexo character varying(10),
    fecha_nac timestamp without time zone,
    intentos_fallidos integer DEFAULT 0,
    bloqueado_hasta timestamp without time zone,
    bloqueado_permanente boolean DEFAULT false,
    ultimo_acceso timestamp without time zone,
    id_rol integer,
    session_token character varying(255),
    session_created_at timestamp without time zone,
    session_expires_at timestamp without time zone,
    session_ip character varying(50),
    session_user_agent text,
    last_activity timestamp without time zone
);


ALTER TABLE usuarios.t_usuario_sistema OWNER TO postgres;

--
-- Name: COLUMN t_usuario_sistema.session_token; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON COLUMN usuarios.t_usuario_sistema.session_token IS 'Token único de sesión activa (ISO 27002 - Control de acceso)';


--
-- Name: COLUMN t_usuario_sistema.session_created_at; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON COLUMN usuarios.t_usuario_sistema.session_created_at IS 'Fecha/hora de creación de sesión';


--
-- Name: COLUMN t_usuario_sistema.session_expires_at; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON COLUMN usuarios.t_usuario_sistema.session_expires_at IS 'Fecha/hora de expiración de sesión';


--
-- Name: COLUMN t_usuario_sistema.session_ip; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON COLUMN usuarios.t_usuario_sistema.session_ip IS 'IP desde donde se inició sesión';


--
-- Name: COLUMN t_usuario_sistema.last_activity; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON COLUMN usuarios.t_usuario_sistema.last_activity IS 'Última actividad del usuario';


--
-- Name: v_reporte_seguridad_passwords; Type: VIEW; Schema: seguridad; Owner: postgres
--

CREATE VIEW seguridad.v_reporte_seguridad_passwords AS
 SELECT u.id_usuario_sistema,
    u.usuario,
    u.nombres,
    u.apellidos,
    u.email,
    count(h.id_historial) AS cambios_realizados,
    max(h.fecha_cambio) AS ultimo_cambio,
    count(
        CASE
            WHEN (a.exitoso = false) THEN 1
            ELSE NULL::integer
        END) AS intentos_fallidos_ultimos_30_dias
   FROM ((usuarios.t_usuario_sistema u
     LEFT JOIN seguridad.t_historial_contrasenas h ON ((u.id_usuario_sistema = h.id_usuario_sistema)))
     LEFT JOIN seguridad.t_auditoria_contrasenas a ON (((u.id_usuario_sistema = a.id_usuario_sistema) AND (a.fecha_hora >= (now() - '30 days'::interval)))))
  GROUP BY u.id_usuario_sistema, u.usuario, u.nombres, u.apellidos, u.email;


ALTER VIEW seguridad.v_reporte_seguridad_passwords OWNER TO postgres;

--
-- Name: VIEW v_reporte_seguridad_passwords; Type: COMMENT; Schema: seguridad; Owner: postgres
--

COMMENT ON VIEW seguridad.v_reporte_seguridad_passwords IS 'Vista de reporte de seguridad de contraseñas';


--
-- Name: t_auditoria_sesiones; Type: TABLE; Schema: usuarios; Owner: postgres
--

CREATE TABLE usuarios.t_auditoria_sesiones (
    id_auditoria integer NOT NULL,
    id_usuario_sistema integer NOT NULL,
    usuario character varying(50) NOT NULL,
    evento character varying(50) NOT NULL,
    session_token character varying(255),
    ip_address character varying(50),
    user_agent text,
    navegador character varying(100),
    sistema_operativo character varying(100),
    dispositivo character varying(50),
    fecha_evento timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    motivo text,
    exitoso boolean DEFAULT true,
    CONSTRAINT chk_evento CHECK (((evento)::text = ANY (ARRAY[('LOGIN'::character varying)::text, ('LOGOUT'::character varying)::text, ('SESSION_INVALIDATED'::character varying)::text, ('AUTO_LOGOUT'::character varying)::text, ('TOKEN_EXPIRED'::character varying)::text, ('CONCURRENT_LOGIN'::character varying)::text])))
);


ALTER TABLE usuarios.t_auditoria_sesiones OWNER TO postgres;

--
-- Name: TABLE t_auditoria_sesiones; Type: COMMENT; Schema: usuarios; Owner: postgres
--

COMMENT ON TABLE usuarios.t_auditoria_sesiones IS 'Registro de auditoría de sesiones (ISO 27002 - Logging y monitoreo)';


--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE; Schema: usuarios; Owner: postgres
--

CREATE SEQUENCE usuarios.t_auditoria_sesiones_id_auditoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE usuarios.t_auditoria_sesiones_id_auditoria_seq OWNER TO postgres;

--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE OWNED BY; Schema: usuarios; Owner: postgres
--

ALTER SEQUENCE usuarios.t_auditoria_sesiones_id_auditoria_seq OWNED BY usuarios.t_auditoria_sesiones.id_auditoria;


--
-- Name: t_usuario_afiliado; Type: TABLE; Schema: usuarios; Owner: postgres
--

CREATE TABLE usuarios.t_usuario_afiliado (
    id_usuario_afi integer NOT NULL,
    fecha_afiliacion date,
    id_sector integer NOT NULL,
    id_usuario_sistema integer NOT NULL,
    activo boolean,
    cod_usuario_afi character varying(6) NOT NULL,
    num_medidor character varying(50)
);


ALTER TABLE usuarios.t_usuario_afiliado OWNER TO postgres;

--
-- Name: t_usuario_afiliado_cod_usuario_afi_seq; Type: SEQUENCE; Schema: usuarios; Owner: postgres
--

CREATE SEQUENCE usuarios.t_usuario_afiliado_cod_usuario_afi_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE usuarios.t_usuario_afiliado_cod_usuario_afi_seq OWNER TO postgres;

--
-- Name: t_usuario_afiliado_cod_usuario_afi_seq; Type: SEQUENCE OWNED BY; Schema: usuarios; Owner: postgres
--

ALTER SEQUENCE usuarios.t_usuario_afiliado_cod_usuario_afi_seq OWNED BY usuarios.t_usuario_afiliado.id_usuario_afi;


--
-- Name: t_usuario_sistema_cod_usuario_sistema_seq; Type: SEQUENCE; Schema: usuarios; Owner: postgres
--

CREATE SEQUENCE usuarios.t_usuario_sistema_cod_usuario_sistema_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE usuarios.t_usuario_sistema_cod_usuario_sistema_seq OWNER TO postgres;

--
-- Name: t_usuario_sistema_cod_usuario_sistema_seq; Type: SEQUENCE OWNED BY; Schema: usuarios; Owner: postgres
--

ALTER SEQUENCE usuarios.t_usuario_sistema_cod_usuario_sistema_seq OWNED BY usuarios.t_usuario_sistema.id_usuario_sistema;


--
-- Name: t_auditoria_sistema id_auditoria_sistema; Type: DEFAULT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.t_auditoria_sistema ALTER COLUMN id_auditoria_sistema SET DEFAULT nextval('auditoria.t_auditoria_sistema_id_seq'::regclass);


--
-- Name: t_configuracion_backup id; Type: DEFAULT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_configuracion_backup ALTER COLUMN id SET DEFAULT nextval('configuracion.t_configuracion_backup_id_seq'::regclass);


--
-- Name: t_iva id_iva; Type: DEFAULT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_iva ALTER COLUMN id_iva SET DEFAULT nextval('configuracion.t_iva_id_iva_seq'::regclass);


--
-- Name: t_limites_geograficos id; Type: DEFAULT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_limites_geograficos ALTER COLUMN id SET DEFAULT nextval('configuracion.limites_geograficos_id_seq'::regclass);


--
-- Name: t_asignacion_servicio_permanente id_asignacion_sp; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_asignacion_servicio_permanente ALTER COLUMN id_asignacion_sp SET DEFAULT nextval('facturacion.t_asignacion_servicio_permanente_id_asignacion_sp_seq'::regclass);


--
-- Name: t_configuracion_mora id_configuracion_mora; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_configuracion_mora ALTER COLUMN id_configuracion_mora SET DEFAULT nextval('facturacion.t_configuracion_mora_id_configuracion_mora_seq'::regclass);


--
-- Name: t_configuracion_servicio_permanente id_configuracion_sp; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_configuracion_servicio_permanente ALTER COLUMN id_configuracion_sp SET DEFAULT nextval('facturacion.t_configuracion_servicio_permanente_id_configuracion_sp_seq'::regclass);


--
-- Name: t_detalle_factura id_detalle; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura ALTER COLUMN id_detalle SET DEFAULT nextval('facturacion.t_factura_servicio_cod_factura_servicio_seq'::regclass);


--
-- Name: t_factura id_factura; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura ALTER COLUMN id_factura SET DEFAULT nextval('facturacion.t_factura_cod_factura_seq'::regclass);


--
-- Name: t_mora_factura id_mora; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_mora_factura ALTER COLUMN id_mora SET DEFAULT nextval('facturacion.t_mora_factura_id_mora_seq'::regclass);


--
-- Name: t_pagos id_pago; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_pagos ALTER COLUMN id_pago SET DEFAULT nextval('facturacion.t_pagos_cod_pago_seq'::regclass);


--
-- Name: t_tarifa id_tarifa; Type: DEFAULT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_tarifa ALTER COLUMN id_tarifa SET DEFAULT nextval('facturacion.t_tarifa_cod_tarifa_seq'::regclass);


--
-- Name: t_historial_medidor id_historial; Type: DEFAULT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor ALTER COLUMN id_historial SET DEFAULT nextval('medidores.t_historial_medidor_id_historial_seq'::regclass);


--
-- Name: t_lecturas id_lectura; Type: DEFAULT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_lecturas ALTER COLUMN id_lectura SET DEFAULT nextval('medidores.t_lecturas_cod_lectura_seq'::regclass);


--
-- Name: t_medidor id_medidor; Type: DEFAULT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_medidor ALTER COLUMN id_medidor SET DEFAULT nextval('medidores.t_medidor_cod_medidor_seq'::regclass);


--
-- Name: t_sector id_sector; Type: DEFAULT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_sector ALTER COLUMN id_sector SET DEFAULT nextval('medidores.t_sector_cod_sector_seq'::regclass);


--
-- Name: t_servicios id_servicio; Type: DEFAULT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_servicios ALTER COLUMN id_servicio SET DEFAULT nextval('medidores.t_servicios_cod_servicio_seq'::regclass);


--
-- Name: t_multa id_tipo_multa; Type: DEFAULT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multa ALTER COLUMN id_tipo_multa SET DEFAULT nextval('multas.t_multa_cod_tipo_multa_seq'::regclass);


--
-- Name: t_multas_afiliados id_multa_afi; Type: DEFAULT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multas_afiliados ALTER COLUMN id_multa_afi SET DEFAULT nextval('multas.t_multas_usuario_cod_multa_usuario_seq'::regclass);


--
-- Name: t_notificaciones id_notificacion; Type: DEFAULT; Schema: notificaciones; Owner: postgres
--

ALTER TABLE ONLY notificaciones.t_notificaciones ALTER COLUMN id_notificacion SET DEFAULT nextval('notificaciones.t_notificaciones_cod_notificacion_seq'::regclass);


--
-- Name: t_auditoria_contrasenas id_auditoria; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_contrasenas ALTER COLUMN id_auditoria SET DEFAULT nextval('seguridad.t_auditoria_contrasenas_id_auditoria_seq'::regclass);


--
-- Name: t_auditoria_sesiones id_auditoria; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_sesiones ALTER COLUMN id_auditoria SET DEFAULT nextval('seguridad.t_auditoria_sesiones_id_auditoria_seq'::regclass);


--
-- Name: t_configuracion_sistema id_configuracion; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_configuracion_sistema ALTER COLUMN id_configuracion SET DEFAULT nextval('seguridad.t_configuracion_sistema_id_configuracion_seq'::regclass);


--
-- Name: t_historial_contrasenas id_historial; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_historial_contrasenas ALTER COLUMN id_historial SET DEFAULT nextval('seguridad.t_historial_contrasenas_id_historial_seq'::regclass);


--
-- Name: t_rol_acciones id_rol_accion; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_rol_acciones ALTER COLUMN id_rol_accion SET DEFAULT nextval('seguridad.t_rol_acciones_id_rol_accion_seq'::regclass);


--
-- Name: t_roles id_rol; Type: DEFAULT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_roles ALTER COLUMN id_rol SET DEFAULT nextval('seguridad.t_roles_id_rol_seq'::regclass);


--
-- Name: t_auditoria_sesiones id_auditoria; Type: DEFAULT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_auditoria_sesiones ALTER COLUMN id_auditoria SET DEFAULT nextval('usuarios.t_auditoria_sesiones_id_auditoria_seq'::regclass);


--
-- Name: t_usuario_afiliado id_usuario_afi; Type: DEFAULT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_afiliado ALTER COLUMN id_usuario_afi SET DEFAULT nextval('usuarios.t_usuario_afiliado_cod_usuario_afi_seq'::regclass);


--
-- Name: t_usuario_sistema id_usuario_sistema; Type: DEFAULT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_sistema ALTER COLUMN id_usuario_sistema SET DEFAULT nextval('usuarios.t_usuario_sistema_cod_usuario_sistema_seq'::regclass);


--
-- Data for Name: t_auditoria_sistema; Type: TABLE DATA; Schema: auditoria; Owner: postgres
--

COPY auditoria.t_auditoria_sistema (id_auditoria_sistema, fecha, accion, descripcion, id_usuario_sistema) FROM stdin;
\.


--
-- Data for Name: t_configuracion_backup; Type: TABLE DATA; Schema: configuracion; Owner: postgres
--

COPY configuracion.t_configuracion_backup (id, nombre, descripcion, activo, backup_diario_habilitado, backup_hour, backup_minute, backup_12h_habilitado, backup_semanal_habilitado, backup_semanal_dia, backup_semanal_hora, retention_days, max_backups, limpieza_habilitada, limpieza_dia, limpieza_hora, verificacion_salud_habilitada, verificacion_salud_hora, notificar_exito, notificar_error, notificar_espacio_bajo, umbral_espacio_gb, dias_excepciones, horarios_personalizados, backup_local_habilitado, backup_nube_habilitado, backup_nube_provider, backup_nube_config, cifrado_habilitado, cifrado_algoritmo, creado_en, actualizado_en, actualizado_por) FROM stdin;
1	Configuración Producción	Configuración estándar para ambiente de producción - Backup diario a las 2:00 AM	t	t	2	0	f	t	sun	3	30	50	t	sun	3	t	8	f	t	t	5	["2026-01-01", "2026-12-25"]	\N	t	f	\N	\N	f	aes-256-cbc	2026-01-05 23:28:18.047386	2026-01-05 23:28:18.047386	\N
2	Configuración Desarrollo	Configuración para ambiente de desarrollo - Backups más frecuentes	f	t	14	0	f	t	sun	3	7	20	t	sun	3	t	8	t	t	t	5	\N	\N	t	f	\N	\N	f	aes-256-cbc	2026-01-05 23:28:18.047386	2026-01-05 23:28:18.047386	\N
\.


--
-- Data for Name: t_iva; Type: TABLE DATA; Schema: configuracion; Owner: postgres
--

COPY configuracion.t_iva (id_iva, codigo, descripcion, porcentaje, es_aplicable, observaciones, activo, fecha_creacion, fecha_actualizacion) FROM stdin;
4	EXENTO	Exento de IVA - No Aplicable	0.00	f	Legalmente exento	f	2025-12-17 15:35:09.866809-05	2025-12-17 19:00:45.187293-05
5	IVA15	IVA 15%	15.00	t	\N	f	2025-12-17 16:17:35.114936-05	2026-01-11 12:59:47.628962-05
2	IVA12	IVA 12%	12.00	t	Tarifa general Ecuador	f	2025-12-17 15:35:09.866809-05	2026-01-12 13:21:50.887853-05
\.


--
-- Data for Name: t_limites_geograficos; Type: TABLE DATA; Schema: configuracion; Owner: postgres
--

COPY configuracion.t_limites_geograficos (id, nombre, norte, sur, este, oeste, poligono_geojson, activo, creado_en, actualizado_en, altitud_min, altitud_max) FROM stdin;
1	Comunidad Sanjapamba	-1.4813850	-1.5606350	-78.7505510	-78.7839790	{"type": "Polygon", "coordinates": [[[-78.783979, -1.481385], [-78.750551, -1.481385], [-78.750551, -1.560635], [-78.783979, -1.560635], [-78.783979, -1.481385]]]}	t	2025-11-25 21:29:31.887736	2025-12-15 09:24:32.767063	3370.00	3380.00
\.


--
-- Data for Name: t_asignacion_servicio_permanente; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_asignacion_servicio_permanente (id_asignacion_sp, id_configuracion_sp, id_usuario_afi, activo, fecha_inicio, fecha_fin, fecha_asignacion, asignado_por, observaciones) FROM stdin;
2	1	11	t	2026-01-30	\N	2026-01-30 14:41:40.431951-05	1	\N
3	1	18	t	2026-01-30	\N	2026-01-30 14:41:40.431951-05	1	\N
4	1	27	t	2026-01-30	\N	2026-01-30 15:20:44.610617-05	1	\N
5	1	1	t	2026-01-30	\N	2026-01-30 15:22:45.772081-05	1	\N
\.


--
-- Data for Name: t_configuracion_mora; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_configuracion_mora (id_configuracion_mora, nombre, descripcion, aplicar_mora, activo, dias_gracia, tipo_calculo, porcentaje_mora, valor_fijo, interes_diario, fecha_creacion, vigencia_desde, vigencia_hasta, es_vigente, mora_maxima, aplicar_sobre, tipo_periodo, meses_gracia) FROM stdin;
1	Mora predeterminada	\N	t	t	\N	fijo	\N	1.00	\N	2026-01-03 11:13:05.645455	2026-01-03	\N	t	\N	total	meses	1
\.


--
-- Data for Name: t_configuracion_servicio_permanente; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_configuracion_servicio_permanente (id_configuracion_sp, nombre, descripcion, aplicar_servicio, activo, id_servicio, fecha_creacion, vigencia_desde, vigencia_hasta, es_vigente, aplicar_en_periodo, precio_override, observaciones) FROM stdin;
1	Alcantarillado	\N	t	t	1	2026-01-30 14:32:15.506766-05	2026-01-30	\N	t	mensual	\N	\N
\.


--
-- Data for Name: t_detalle_factura; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_detalle_factura (id_detalle, id_factura, id_servicio, subtotal_detalle, descripcion, id_multa_afiliados, tipo_detalle, id_asignacion_sp) FROM stdin;
142	68	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
143	69	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
144	69	\N	20.00	Inacistencia a Reuniones - Sin observaciones	58	multa	\N
145	70	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
146	71	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
147	72	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
148	73	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
149	73	\N	20.00	Inacistencia a Reuniones - Sin observaciones	35	multa	\N
150	74	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
151	75	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
152	76	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
153	77	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
154	78	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
155	79	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
156	79	\N	13.50	Mingas - Sin observaciones	56	multa	\N
157	80	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
158	81	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
159	82	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
160	83	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
161	84	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
162	85	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
163	86	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
164	87	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
165	88	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
166	89	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
167	90	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
168	91	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
169	92	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
170	93	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
171	94	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
172	95	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
173	96	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
174	97	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
175	98	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
177	100	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
179	102	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
180	103	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
182	105	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
183	106	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
184	107	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
185	108	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
186	109	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
188	111	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
189	111	\N	13.50	Mingas - Sin observaciones	65	multa	\N
190	111	\N	20.00	Inacistencia a Reuniones - Sin observaciones	51	multa	\N
191	111	\N	20.00	Inacistencia a Reuniones - Sin observaciones	62	multa	\N
192	112	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 20.00 m³)	\N	consumo	\N
193	112	\N	5.00	Exceso de Consumo: 5.00 m³ × $1.00/m³ = $5.00	\N	consumo	\N
194	113	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
195	114	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
196	115	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
197	116	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
198	117	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
199	118	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
200	119	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
201	120	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
202	121	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
203	122	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
204	123	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
205	124	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
206	125	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
207	126	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
208	118	1	2.00	Alcantarillado - $2.00	\N	servicio	\N
210	128	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
211	128	7	13.50	Cambio de afiliado del medidor - Medidor: 008 - Fecha: 12/01/2026 - Cambio realizado desde API por admin	\N	servicio	\N
212	129	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
213	129	7	13.50	Cambio de afiliado del medidor - Medidor: 008 - Fecha: 12/01/2026 - Cambio realizado desde API por admin	\N	servicio	\N
214	130	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 10.00 m³)	\N	consumo	\N
215	130	7	13.50	Cambio de afiliado del medidor - Medidor: 008 - Fecha: 12/01/2026 - Cambio realizado desde API por admin	\N	servicio	\N
217	131	\N	13.50	Mingas - Sin observaciones	66	multa	\N
218	131	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 15.00 m³)	\N	consumo	\N
221	101	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 20.00 m³)	\N	consumo	\N
222	101	\N	5.00	Exceso de Consumo: 5.00 m³ × $1.00/m³ = $5.00	\N	consumo	\N
223	132	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 13.00 m³)	\N	consumo	\N
224	132	7	13.50	Cambio de afiliado del medidor - Medidor: 0005 - Fecha: 25/01/2026 - Cambio realizado por admin	\N	servicio	\N
225	133	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 5.00 m³)	\N	consumo	\N
226	133	1	2.00	Alcantarillado (Servicio Permanente) - $2.00	\N	servicio	\N
227	134	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 12.00 m³)	\N	consumo	\N
228	135	\N	2.00	Consumo Básico: Cargo fijo 0-15 m³ = $2.00 (consumo: 14.00 m³)	\N	consumo	\N
\.


--
-- Data for Name: t_factura; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_factura (id_factura, num_factura, id_usuario_afi, id_lectura, consumo_m3, valor_consumo, valor_exceso, descuento, subtotal, impuesto, total, fecha_emision, exceso_m3, id_tarifa, estado_factura, periodo) FROM stdin;
113	FACT-202602-0002	10	185	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
114	FACT-202602-0003	11	187	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
115	FACT-202602-0004	9	186	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
85	FACT-202512-0004	6	152	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pendiente	2025-12
90	FACT-202512-0009	18	161	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pendiente	2025-12
81	FACT-202511-0014	20	136	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
95	FACT-202512-0014	20	150	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
80	FACT-202511-0013	17	148	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
78	FACT-202511-0011	16	144	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
77	FACT-202511-0010	4	141	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
76	FACT-202511-0009	18	145	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
79	FACT-202511-0012	14	149	10	2.00	0.00	0.00	15.50	0.00	15.50	2026-01-08	0	8	pagada	2025-11
75	FACT-202511-0008	5	140	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
73	FACT-202511-0006	7	147	10	2.00	0.00	0.00	22.00	0.00	22.00	2026-01-08	0	8	pagada	2025-11
69	FACT-202511-0002	11	139	10	2.00	0.00	0.00	22.00	0.00	22.00	2026-01-08	0	8	pagada	2025-11
96	FACT-202601-0001	10	170	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pendiente	2026-01
100	FACT-202601-0005	12	171	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pendiente	2026-01
109	FACT-202601-0014	20	164	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pendiente	2026-01
116	FACT-202602-0005	12	182	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
111	FACT-202601-0015	18	179	10	2.00	0.00	0.00	55.50	0.00	55.50	2026-01-10	0	8	pagada	2026-01
112	FACT-202602-0001	6	189	20	2.00	5.00	0.00	7.00	0.00	7.00	2026-01-11	5	8	pendiente	2026-02
117	FACT-202602-0006	7	181	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
119	FACT-202602-0008	5	193	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
120	FACT-202602-0009	18	180	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
121	FACT-202602-0010	4	188	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
122	FACT-202602-0011	16	190	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
123	FACT-202602-0012	14	191	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
125	FACT-202602-0014	20	192	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pendiente	2026-02
74	FACT-202511-0007	1	138	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
72	FACT-202511-0005	12	143	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	anulada	2025-11
118	FACT-202602-0007	1	184	10	2.00	0.00	0.00	4.00	0.48	4.48	2026-01-11	0	8	pendiente	2026-02
128	FACT-202603-0001	19	195	10	2.00	0.00	0.00	15.50	1.86	17.36	2026-01-12	0	8	anulada	2026-03
129	FACT-2026-03-0001	19	195	10	2.00	0.00	0.00	15.50	1.86	17.36	2026-01-12	0	8	anulada	2026-03
130	FACT-2026-03-0002	19	195	10	2.00	0.00	0.00	15.50	1.86	17.36	2026-01-12	0	8	anulada	2026-03
71	FACT-202511-0004	6	137	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
70	FACT-202511-0003	9	146	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
131	FACT-202603-0002	1	196	15	2.00	0.00	0.00	15.50	0.00	15.50	2026-01-14	0	8	pendiente	2026-03
68	FACT-202511-0001	10	142	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-11
82	FACT-202512-0001	10	156	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
126	FACT-2025-11-0001	12	143	10	2.00	0.00	0.00	2.00	0.00	2.00	2025-11-11	0	8	pagada	2025-11
86	FACT-202512-0005	12	157	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
93	FACT-202512-0012	14	158	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
107	FACT-202601-0012	14	172	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
94	FACT-202512-0013	17	163	10	2.00	0.00	0.00	2.00	0.00	2.00	2025-12-08	0	8	pagada	2025-12
108	FACT-202601-0013	17	177	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
92	FACT-202512-0011	16	160	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
106	FACT-202601-0011	16	173	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
91	FACT-202512-0010	4	155	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
105	FACT-202601-0010	4	169	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
89	FACT-202512-0008	5	154	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
103	FACT-202601-0008	5	168	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
88	FACT-202512-0007	1	153	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
102	FACT-202601-0007	1	166	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
87	FACT-202512-0006	7	159	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
101	FACT-202601-0006	7	176	20	2.00	5.00	0.00	7.00	0.00	7.00	2026-01-10	5	8	pagada	2026-01
84	FACT-202512-0003	9	162	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
98	FACT-202601-0003	9	175	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
83	FACT-202512-0002	11	151	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-08	0	8	pagada	2025-12
97	FACT-202601-0002	11	167	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-10	0	8	pagada	2026-01
124	FACT-202602-0013	17	183	10	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-11	0	8	pagada	2026-02
132	FACT-202603-0003	17	197	13	2.00	0.00	0.00	15.50	0.00	15.50	2026-01-25	0	8	pagada	2026-03
133	FACT-202603-0004	18	198	5	2.00	0.00	0.00	4.00	0.00	4.00	2026-01-31	0	8	pendiente	2026-03
134	FACT-202601-0016	26	199	12	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-31	0	8	pendiente	2026-01
135	FACT-202601-0017	27	200	14	2.00	0.00	0.00	2.00	0.00	2.00	2026-01-31	0	8	pendiente	2026-01
\.


--
-- Data for Name: t_mora_factura; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_mora_factura (id_mora, id_factura, id_configuracion_mora, monto_base, dias_mora, tipo_calculo, tasa_aplicada, monto_mora, fecha_calculo, aplicada, fecha_aplicacion, observaciones) FROM stdin;
11	126	1	2.00	14	fijo	\N	1.00	2026-01-15 14:15:58.295703	t	2026-01-15 14:15:58.295703	Mora fija de $1.00 (14 días)
\.


--
-- Data for Name: t_pagos; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_pagos (id_pago, id_factura, monto_pago, fecha_pago, metodo_pago, id_usuario_afi, id_cajero, observaciones, motivo_anulacion, fecha_anulacion, activo, estado_pago, comprobante_pdf, nombre_archivo, tipo_mime) FROM stdin;
73	81	2.00	2026-01-08 17:20:03.888972	EFECTIVO	20	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313733310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb558cd4edb5814defb29ee6216ad0497fbff136916260da81510046ec5a21b631c6a9460148246ead3cc3bf48966396f31dfb59dc409764b078254ab4287fb9dfff39dc3a83696b57e38f92b62e4383a4ca2832341b823c924128c1abff12349721231ca8520f81a8eafe086cc6f236e1d55b625eabc23d669cabd65ce18aeb895423b43929be8dda7cf67494c3e8c487cfc3926e7e3243e3c19bd27c95d344a563aa8a00337946da8607dad8390015d878f373aa8201454d810856ad6682ab5d2c678e1b9944e0b5ba970199f7d8acfe3d3c3780b17ef039651b9f19687e2015605cb95b2019b890a568880d092e49258cd2977159e13c65aeebda861d3fbbbf4219d5da77b64f8ad985d97f3f47bb94746d9537a53ce5fab8b74548a76141427567aea94b05a7ba635e78e395ee992e4d37f27e57d39205fdf692fbfbe2772ffeaea2afcbb5a2ac2a80b284e858f2117c711a755288593ca547e55c81d25100a6f9c66d24b649643f42c1c0321e7b873de1a692d5e99455a0b6a0d935c79c38c0889a2bb65a7d1e50b93a12321057314cab49c260d81b214204a2c95d5b6ce86e1f8f4fc627c189f25a39096e7f1f1783b1d59a501a7bad7f99653e35a888a7982d803b1f63be74c4881d202e0594949283c2bb771101be0086a36621e0aa74a7b5887afd6f84a942970bb7c6f94a4088f5bb9d93495f7214ec69730f1840c4f3e8e60ee063cff45c675f8b9135d486a5017cb1471a629bae1b4c8ef17f980bc1655784b4d3bbacefc0c36bf799aa603c22c534c32e5f54eac661e09d1d45888356b6a7e58de14b7258927c5b440910fd05e77637f9f0221d94ef39b020d064e606c27e66baf299a4cddee8c965aeb26e58a799e6545793f20ebeeb71307f4aa7099678b60fb10d9372f775271da702a0c0ada59c5b8b628bbdaf9cb8a232731398a87c9e78bcd89f356ee5755635e3779cf30ad817f94668ba7794a9004834a817dc1d0fff83ea6beda4d18fa5439cfe745190a2068b0cff94efc202c154a498962af78873475c73dcab36f2919cd8ac72a15dd013f801a66371ee8536258de3f3ecd420b6064b6d9fadfca7e2e29b3d5a8412f640a03baae81a45ca453d264c380fc21f618db4925800652041e9ca8b11fba3443f66c383a47356cc15664d383296efc345c137f0f38783840fb5e4ceda1de9a9308136c593b9cdce424be7d4a075b2eff297487c741eb968eb50830675212a574601a1599f150426b56079b9025fae13f8f4586a80fd33906c1a4b82b09dbe79acc7e903f1109ca182858b6ce8df08bd98fafef5fabad14d48b16d532c6f4abbb9111cf795fa7dbc187e08f25c945dae0973d14af537645f17e95fdcfe996d2926ad5347a05d6eb30ed25081eba2f786f4df1948127aa09f074bd0805b09d00bf8baa65f845cb340517f5a23e2fb2b7b21335d6e6f4d837ea16fbf14bbc1b13fb00ff60bfdd47ba3a59a791da426a3546d046f027552bc3c278b21ca69be6fe1f702d74e0e86b83b9e8c7de5ddf043e1e58237a1dd6f0c0204630f76454d3f667abc91bcd0d811c860f56f5899d19efaee626fae7797a8be6e4c27ff3fb7c5ef5d43041f708d303c1c803fd7b4677a29a0b03a0225555949c175807a1da69be009d58eb363a1a0d938f5f76e31f632846cbf28ae0d0c96aff5ce459710d6a4d1e02c33c3b58b13b3c2af126364c40dbbee92194a12008d81555bdfe3285b91069a590316111f620135a3b87f5b553760a594721e52d02a7f1918cf5c876366601731d06b541f549cff190e811c47501c4a2d23d3c6bb1aa93acbbdbc344ecea2b516725382054ed92c53ca332541d5c6ef02a36387048acef301f092671c3f1123909414d511f2b8a1db214921d9eea9484aa1d01e8149d46709f1496099c3ad0f6d00e44cfab9dc9c2904bb0d961be2a5492e0d0be5bb0c34d59770276791f7a76897644548191722cc4b8ae08a998e182f7e4c84b93348bbe4593550b04c5439149dabe01862b6028324e09921f4facab07e1b4c8128133197681e5e4b4b8cdd4953d3e4bc6a1d7c51fc6cf1afccf8e931594f292c2a9ebbb23e3b61f6b8bf7e00a0acab374671d6b8313970d44a879af229ae0525c8743644339619af032f01fa170946c3c555db3c0b3ba6503ffc1c0a352ae0e44888c747d2f6b8103166f9128b8b1ffe597d0c6e7f39f0b8359bcbe5819ed5025c83ed8b2ca7ccf9a1e7c54cc67613c4c416eef30157e87b276901d9c30a46cb98e39d8f702ecfab0b4058eebcf24421fd99ccacdcd107e5e2d16e13a569d72b1b96cdf0c3d1a816ddd2545733d1d3d2e729295b38779799d029b64f97c514c8a2c2550e8010389ccf3745a7cc7c9e7b57a850b6efbb2a871f8c46dbd93c61f87e10c4c68b1de72f74818d10388b4a7f47f5b6f316a0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383137323030382d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303031393536203030303030206e200a30303030303033373733203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303133203030303030206e200a30303030303032313338203030303030206e200a30303030303032323638203030303030206e200a30303030303032343031203030303030206e200a30303030303032353338203030303030206e200a30303030303032363631203030303030206e200a30303030303032373930203030303030206e200a30303030303032393232203030303030206e200a30303030303033303538203030303030206e200a30303030303033313836203030303030206e200a30303030303033333133203030303030206e200a30303030303033343432203030303030206e200a30303030303033353735203030303030206e200a30303030303033363737203030303030206e200a30303030303034303231203030303030206e200a30303030303034313037203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c31313937463741343633333839413032333631434338314437463732394130393e203c31313937463741343633333839413032333631434338314437463732394130393e205d0a3e3e0a7374617274787265660a343231310a2525454f46	Comprobante_000073.pdf	application/pdf
74	95	2.00	2026-01-08 19:18:54.537154	EFECTIVO	20	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313733320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb558cd4edb5814defb29ee6216ad0497fbff136916260da81510046ec5a21b631c6a9460148246ead3cc3bf48966396f31dfb59dc409764b078254ab4287fb9dfff39dc3a83696b57e38f92b62e4383a4ca2832341b823c924128c1abff12349721231ca8520f81a8eafe086cc6f236e1d55b625eabc23d669cabd65ce18aeb895423b43929be8dda7cf67494c3e8c487cfc3926e7e3243e3c19bd27c95d344a563aa8a00337946da8607dad8390015d878f373aa8201454d810856ad6682ab5d2c678e1b9944e0b5ba970199f7d8acfe3d3c3780b17ef039651b9f19687e2015605cb95b2019b890a568880d092e49258cd2977159e13c65aeebda861d3fbbbf4219d5da77b64f8ad985d97f3f47bb94746d9537a53ce5fab8b74548a76141427567aea94b05a7ba635e78e395ee992e4d37f27e57d39205fdf692fbfbe2772ffeaea2afcbb5a2ac2a80b284e858f2117c711a755288593ca547e55c81d25100a6f9c66d24b649643f42c1c0321e7b873de1a692d5e99455a0b6a0d935c79c38c0889a2bb65a7d1e50b93a12321057314cab49c260d81b214204a2c95d5b6ce86e1f8f4fc627c189f25a39096e7f1f1783b1d59a501a7bad7f99653e35a888a7982d803b1f63be74c4881d202e0594949283cabb671101be0086a36621e0aa74a7b5887afd6f84a942970bb7c6f94a4088f5bb9d93495f7214ec69730f1840c4f3e8e60ee063cff45c675f8b9135d486a5017cb1471a629bae1b4c8ef17f980bc1655784b4d3bbacefc0c36bf799aa603c22c534c32e5f54eac661e09d1d45888356b6a7e58de14b7258927c5b440910fd05e77637f9f0221d94ef39b020d064e606c27e66baf299a4cddee8c965aeb26e58a799e6545793f20ebeeb71307f4aa7099678b60fb10d9372f775271da702a0c0ada59c5b8b628bbdaf9cb8a232731398a87c9e78bcd89f356ee5755635e3779cf30ad817f94668ba7794a9004834a817dc1d0ffc43ea6fe66f379b330f4a9729ecf8b321440d0609f8b9df841582a949212c55ef10e69ea8e7b9467df52329a158f552aba037e0035cc6e3cd0a7c4b0bc7f7c9a8516c0c84ceec47e2e29b3d5a8412f640a03baae81a45ca453d264c380fc21f618db4925800652041e9ca8b11fba3443f66c383a47356cc15664d383296efc345c137f0f38783840fb5e4ceda1de9a9308136c593b9cdce424be7d4a075b2eff297487c741eb968eb50830675212a574601a1599f150426b56079b9025fae13f8f4586a80fd33906c1a4b82b09dbe79acc7e903f1109ca182858b6ce8df08bd98fafef5fabad14d48b16d532c6f4abbb9111cf795fa7dbc187e08f25c945dae0973d14af537645f17e95fdcfe996d2926ad5347a05d6eb30ed25081eba2f786f4df1948127aa09f074bd0805b09d00bf8baa65f845cb340517f5a23e2fb2b7b21335d6e6f4d837ea16fbf14bbc1b13fb00ff60bfdd47ba3a59a791da426a3546d046f027552bc3c278b21ca69be6fe1f702d74e0e86b83b9e8c7de5ddf043e1e58237a1dd6f0c0204630f76454d3f667abc91bcd0d811c860f56f5899d19efaee626fae7797a8be6e4c27ff3fb7c5ef5d43041f7c0ab0750f581fe3da33b51cd85015091aa2a4ace0bac8350ed345f804eac751b1d8d86c9c72fbbf18f3114a365794570e864b57f2ef2acb806b5260f81619e1dacd81d1e9578131b26a06ddff410ca501004ec8aaa5e7f99c25c88b452c898b0087b9009ad9dc3fada293b85aca390f21681d3f848c67a643b1bb380b90e83daa0faa4e77848f408e2ba006251e91e9eb558d549d6dded612276f595a8b3121c10aa76c9629e5119aa0e2e3778151b1c3824d677988f0493b8e178899c84a0a6a88f15c50e590ac90e4f754a42d58e00748a4e23b84f0acb044e1d687b6807a2e7d5ce6461c825d8ec305f152a497068df2dd8e1a6ac3b01bbbc0f3dbb443b22aac0483916625c578454cc70c17b72e4a5499a45dfa2c9aa0582e2a1c8246ddf00c315301419a704c98f27d6d583705a6489c0990cbbc072725adc66eaca1e9f25e3d0ebe20fe3670dfe67c7c90a4a7949e1d4f5dd9171db8fb5c57b700505e559bab38eb5c189cb0622d4bc57114d7029aec321b2a19c304d7819f88f50384a369eaaae59e059ddb281ff60e051295707224446babe97b5c0018bb74814dcd8fff24b68e3f3f9cf85c12c5e5fac8c76a812641f6c5965be674d0f3e2ae6b3301ea620b777980abf43593bc80e4e1852b65cc71cec7b01767d58da02c7f56712a18f6c4ee5e666083faf168b701dab4eb9d85cb66f861e8dc0b6ee92a2b99e8e1e1739c9cad9c3bcbc4e814db27cbe282645961228f4808144e6793a2dbee3e4f35abdc205b77d59d4387ce2b6de49e38fc3700626b4586fb97b0423da0fb056b4a7f47fd50831780a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383139313930302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303031393537203030303030206e200a30303030303033373734203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303134203030303030206e200a30303030303032313339203030303030206e200a30303030303032323639203030303030206e200a30303030303032343032203030303030206e200a30303030303032353339203030303030206e200a30303030303032363632203030303030206e200a30303030303032373931203030303030206e200a30303030303032393233203030303030206e200a30303030303033303539203030303030206e200a30303030303033313837203030303030206e200a30303030303033333134203030303030206e200a30303030303033343433203030303030206e200a30303030303033353736203030303030206e200a30303030303033363738203030303030206e200a30303030303034303232203030303030206e200a30303030303034313038203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c41443931303633443045463435344446413435433630343145383441413739423e203c41443931303633443045463435344446413435433630343145383441413739423e205d0a3e3e0a7374617274787265660a343231320a2525454f46	Comprobante_000074.pdf	application/pdf
75	80	2.00	2026-01-08 19:35:04.201647	EFECTIVO	17	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313734320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb558cd4edb5814defb29ee6216ad0497fbff136916260da8552011a4158b6e8c31d4288951081aa94f33efd0279ae5bcc57cd7761227d82d1d086da32a3adceffc9fef1c46b5b1acf1c3c95f1123a7d1f1243a3a11843b32b98d04a3c66ffd483219468c7221083e0dc7a7e0862cee226e1d55b621eabc23d669cabd65ce18aeb895423b432637d1bb4f9fcf2731f93020f1e9e7988c4793f87838784f26f7d160b2d641051db8a16c4b05eb2b1d840ce83a7c78a3830a4241852d51a8668da6522b6d8c179e4be9b4b0a50a97f1f9a7781c9f1dc73bb8781fb08ccaadb73c140fb02a58ae940dd84c94b0420484862497c46a4eb92bf19c30d672ef45059bccef938764769d1c90feb77c765d2c92efc50119a44fc94db178ad2ed251299a51509c58e9a953c26aed99d69c3be678a9cb249bfe7b5bcc8b1ef9fa4e7bf9f53d9187575757e1dfd54a11465d40712a7c1872711a715a865238a94ce95785dc5102a1f0c66926bd44663944cfc23110728e3be7ad91d6e29559a4b5a0d630c99537cc889028ba5d761a5dbe30195a12523047a14cc369d210284b01a2c44a596dab6ce88fcec617a3e3f87c320869398e4f47bbe9c84a0d38d59dceb79c1ad74054cc13c41e8895df3967420a941600cf0b4a42e159bd8b83d8004750b315f3503865dac33a7c6a8d4f8932056e9bef8d9214e1716b379bbaf23ec493d1254c1c92fef0e300e66ec1f35f645c8b9f5bd185a40675b14a1167eaa2eb4ff36cbecc7ae4b5a8c25b6a9ad175e667b0d9cdd334e9116618fee28fdf8bd5cc2321ea1a0bb16675cdf78b9bfcae20f16d3ecd51e43dc2b783fe66f677291092ed2cbbc9d160e004e6f661bdf69aa2c754ddce68a9b5ae332e5f64699a17f31e41f323f1fc66913deec5fe4e152eb374194c1f168f649ccf8b6df8b7aa396d3815c830ebac625c5b145ee5fe55cd91614c4ee2fee4f3c5f6cc79ab08a8b2356fdabc6798d7c03f49d2e5d3222148835ea9c0a160e880fc10735fee27125daa8cb3455e8412081a1c72be173f084b855252b29a794853f5dc932cfd9690c12c7f2cb3d11df123a861f6e3812e25fac5fcf169169a0023b3577bbfd57e2e29b3e5b04137640a23ba2a8349b14ca6a4ce861ef9431c30b6974a0011a4083c58516d3f74a9c7ec797f304635ecc09674d3832b6efdd46c13bf0f38783840fb4e4ceda1de869508136cd9389cdc6424be7b4a7a3b2eff29748bc741ec568eb50830675212a574e01a259df150426b56059b9015faf13f8f798aa8f7930546c16d7e5f1076c83599fd207f2212943190b074931be18bd98fafef5fabad14d48b06d932c674abbb9511cf995fabdbc188e08f15cd45dae0cb0e92d72abb2679bfcafee7844b6949b5aa7bbd02ef7598f712140fdd17ccb72279cac013e51078ba5e8602d84d80df45d5327cd1304dc1459da8cf8becadec448d35593d368eaac57efc12efc7c42ec03fd86ff791b64ed66aa4b6905a8f11b411fc4ad9cab0320e57c374dbdcff03ae850e2c7d633017ddd8fbeb9bc0c7031b44afc3221e18c400e60e0715717fb69cbcd1dc10c861f8605d9fd89af1ee7a6ea27f8e933b342717fe9bcdb345d953c3043d20ccf6a4260ff4ef19dd8b6a2e0c8092549551725e6021846a67d9127462a3dbe064d09f7cfcb21fff1843315a567704874e56f9e7224bf36b906bf21048e6f9d19adde1518937b16302da764d0fa10c0541c0b6a8aa059829cc85482b858c09abb00799d0da392cb0adb253c83a0a296f11388d0f893da75db6b5310b98eb30a80daa4f7a8e87448720ee0b2016a5eee1598b659da4eddd1e26625b5f8b3a2bc101a16a9b2ce61995a1eae0728357b1c38143628187f94830892b8e97c849086a8afa5853ec90a5906cf154ab24546d0940abe83482fba4b04ce0d881b68776203a5e6d4d16865c82cd0ef355a1920487f6ed822d6e4adb13b0cdfbd0b34db425a20a8c946325c67d4548c50c17bc23475e9aa469f42dba5db740503c1499a4cd2b60b8038622e39420f9f1c4a67a104e8b2c1138946117584d4e8beb4c55d9a3f3c928f4baf8c3e85983ffd979b284525e523875737964dc7663edf01edc41417956eeac626d70e4b28108d5ef9544135c8aeb708aac29274c135e06fe2314ce92b5a7ca7b167856bb6ce03f187854caf589089191aeeb652d70c2e20d12053776bffc12daf87cfe7361308b37372ba31daa04d9075bd699ef59dd834ff2c52c8c8729c8ed3da6c2ef50d616b2832386940dd73107fb5e805d9d9676c071ffb98dd047b6a7727d35849fd78b45b88f95c75c6c2ebb57438f46601b974951df4f078fcb8ca4c5ec61515c27c02669b658e6b7799a1028f4808144165932cdbfe3e8f35abdc20db7795bd4387de2bade4ae34fc3700626b4d86cb907248ce81edb9ed2ff01f65d31e60a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383139333530352d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303031393637203030303030206e200a30303030303033373834203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303234203030303030206e200a30303030303032313439203030303030206e200a30303030303032323739203030303030206e200a30303030303032343132203030303030206e200a30303030303032353439203030303030206e200a30303030303032363732203030303030206e200a30303030303032383031203030303030206e200a30303030303032393333203030303030206e200a30303030303033303639203030303030206e200a30303030303033313937203030303030206e200a30303030303033333234203030303030206e200a30303030303033343533203030303030206e200a30303030303033353836203030303030206e200a30303030303033363838203030303030206e200a30303030303034303332203030303030206e200a30303030303034313138203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c45464342434237363642354334394230364531354144443530314230363334323e203c45464342434237363642354334394230364531354144443530314230363334323e205d0a3e3e0a7374617274787265660a343232320a2525454f46	Comprobante_000075.pdf	application/pdf
76	78	2.00	2026-01-08 20:06:00.103861	EFECTIVO	16	1		\N	\N	t	REGISTRADO	\N	\N	application/pdf
77	77	2.00	2026-01-08 20:09:19.259975	EFECTIVO	4	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313736380a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a9191820445bd1f9166d1188312198cc08958b031a6218e6c1c19d08ce66be61ff245b39cbfc8a9eeb6dd36550462b7a3b450abd4e7becfbdb718d5c6b2da8f93bf5a8c1cb70efaadfd2341b823fddb9660d4f8959f24fd6e8b512e04c1d3703c05376476d7e2d651656b479d77c43a4db9b7cc19c315b752686748ffa6f5fed3e7d37e460e3b243bfe9c91b35e3f3be8767648ff5babd35fc8a0820cdc50b62282f5a50c4206741d1edee82082501061e52844b34653a99536c60bcfa5745ad842848becf45376969d1c646bb8f83e6019952bdff2103cc0aaa0b95236603351c00a11106a27b9245673ca5d81e784b1967b2f4ad8c1fdb7c1f7c1e47ab04bda5f4793ebe96cf0cf749774864f839be96c5359a4a352d4bda038b1d253a784d5da33ad3977ccf142967e3efeff767a3ffd40aede6b2faf7688dcbbbcbc0cff2fe78230ea028a53e161c8f9718bd3c295c249650abb2ac48e127085374e33e92522cbc17b1686c121e7b873de1a692dbe3269692da8354c72e50d3322048a8e9f1db72e5e190c918014cc510853339a3404c2528028311756db321adabd93b3f3de4176daef84b03ccb8e7bebe1c80a0938d549e35b4e8dab212ae6097c0fc4d2ee9c332105520b80a7534a42e259bb8e03df004750b3e2f3903845d8433b3cb5c653224d811bb3bd5192c23d6e61665365de61d6ef5d40c52e69773f76a0ee0a3cff45c445ec1c4517921ae4c53c449ca992ae3d1ee5f78ff98737857904d47bfc2534c2bbf2a483a553a0d938ff9b9c0c9e66a3e1688aa41bcc86d34db516de52538f2e675e523bbf791a0f36d61a55864aa477adaca431391240e19f608d789879047f554f425cb3aabeb5a737a3bb29c96e47e3110adac63a7361e9a2700520cd451a5d35e3d7145c48e293fc6684c2bdb9738d4321a97832b853289d4646e5d858d7985fb5d7144c510697d1526b5dd58dd12c1f227fee5715fd0dd858ee26619774d988b60e2c8d909acb62410d7366cc0b666c44d914ea92db1a09e324ee453e7c5c8fe0df00950a2f74cdc4e09d34681b44305badc3db223fad2c45cfb978670574a9711fe966e4286bf73f9faff67edb8a2a942ca19494acea7c91da05fed160f8f8341b10948dcdeb229774c10265c6f01790a1ed9e08c593efa1d9df9812e2f195423fcb67a3e916b820c67f49d0a0ed1ee78d3818b667b6e8e640bd4ca1072eabd5513efc3a209dc9e8611b85324a7d496ce6f619df87d6a619e7a6703b0f8f6fe679780a70c008a03e5d3b529868cfb3c34672577947318038ab18d71603ad5ef435f70f4f93660821098a9963221b716712b23f7d1c8c4955a99a696a92d8efc42e5b2d4ddb6204f4c6d4b9a5e131a59555a2dd3b6d77ce400b6bb0c5fec36379b1f2abd61fcfc3378aa97418408b19d70768cd2acc3294c84d4eb2bba7f5c6e645e48889b16898e7874521e44c4aa26418d6c314ed511fb5768a55a45b411ffcf7301a62ee6f0f6668d66f47dfa684ed714d263fc89fe49da08c612530ac421ea36f7831f971b5b3a9ac52502f6aa3bf31262d6c2c1cde8aa8b0fb90562d170b02b1a6505790788bf6c07156ed849eae1f8bf88f66fbdbd1e3faa6d057f47dbe7789c59874d8f784ba5891a20503a6562cd1b38b15cbaf0acbf37547d4b4123b107c7cb9c691283675d3bead803e47d58816a56aaa61c64da33e0fa16de9a92d5cbd6467d06eb953fbf82543eab03fae769ad13485fb8ebdb976be365da45c5b9a21f64aaec0deb63befa4d773e5ede05ae8b02a5b2a8c762789dd1c57203db0519eb3936381b6caf1a10375bb9d727bf66c43b8a506445881a38b72ce9cb558382e7a4b70c6d9e06ef33624da5b26b15dc0cdeff359415aa1c7dc25cc7dc07af33bfd77421bb103021d7c503267206d513ae1247fc42811b7c3ef8c518ad3956536e68b2476e7a8d3ee7ffcd28cdfb1b0050316d52bf020842903fd3c1f8eaeb16122dfb730a273c1d1072d5134ee77d2d0a7fb8b1e1bdf91f80cb6e540b3a9be436019098d42ecf8a28860bd1de84829a45d8de11d56f1d1b3639c7585ed2dc63b8d07123e71364a7210077a7bcf70cbe1d14a848d68e22447b591cbb9119b354f8671ea448a844b8fe5050ac3b00d59a367ada1167b3a6ce0a5e0ca6a19a63668c56000a48ec48d9497985d7112dd015f98102d3a0a7fd456d1939035e282e8d1714b19dc0b592610ebb809028b88c45763b1c9718761502338a4c6130b49812e3e763066a7613cde63e6879cb1a3319f62c5037944085b81e1d120b21361f2da381db6beb66e1754828904a985c458c92c0c6b482d4e09e2dfe072b4be8b40ade4986c40558b6d046217cd61a85abdd37e2f704676d87b46942fddb51650ca435c55bb46651cd193c28a32e3dae5d5eb26188ea90916aa5e423c65ca455a45f9a542190997675d90e349ed3ee927032b7ce30a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6edb400c85f73a05972d508cf937438e972d926cba6a7501d59e040aecd8500d14e8697ad4526d0239410224e1e22d2482dfe3e35052326176d1a2b994aaf0abc3e40c213a4b816f57f10566f18c52c510cd4d914af4dadc526899520a98e744d5f0e107a956d877ac98aaaa3bb9572b6295e9f9de5df7bd93ac4924133911b21462f1972667d6d8433c3b17332a6a662f4ffedc77ab4b0287febaabd1f2a804faafb1a9ce01a85a684686e9a6232e296b5e0c6517309308e52c966219fa6df7e1729cf6036cdb0ebe0cb76d3a7c84feb6bbe8dfc956ac91c55974e8b1df2bd8bbb1dd9dda13b8cd704fa8e76cafffe19173708bd459e3f84167ae29204b15891b0b85a5e5965625ec07fde2e7a9c1e6b03f4e871f43c061d3a6d3783d6e060847c7e1e600531b76e3ef61fb3495371b939a02bf54b60ac69810e70331a35a3c3ae67fc6aeda5d9b021a36d6e02b5a3172f904be265cabc231fdd9a77b437f019c7bb0bd0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383230313034342d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032353633203030303030206e200a30303030303034333838203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303031393933203030303030206e200a30303030303032313330203030303030206e200a30303030303032363236203030303030206e200a30303030303032373531203030303030206e200a30303030303032383831203030303030206e200a30303030303033303134203030303030206e200a30303030303033313532203030303030206e200a30303030303033323736203030303030206e200a30303030303033343035203030303030206e200a30303030303033353337203030303030206e200a30303030303033363733203030303030206e200a30303030303033383031203030303030206e200a30303030303033393238203030303030206e200a30303030303034303537203030303030206e200a30303030303034313930203030303030206e200a30303030303034323932203030303030206e200a30303030303034363338203030303030206e200a30303030303034373234203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c32354132343145323833363032384332324343304446383736424133304530423e203c32354132343145323833363032384332324343304446383736424133304530423e205d0a3e3e0a7374617274787265660a343832380a2525454f46	Comprobante_000077.pdf	application/pdf
78	76	2.00	2026-01-08 21:04:13.656777	EFECTIVO	18	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313736380a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a919112098a7a3f22cda231062532188113b160634c431cf911199847be66fe215f34cbf98b39d5ddb6dba68a404c5ba20556d1e7becfbdb718d5c6b2da87933f5b8c1cb5f6fbadbd4341b823fd9b9660d4f8b58f24fd6e8b512e04c1d3703c0537647edbe2d651656b479d77c43a4db9b7cc19c315b752686748ffbaf5f6e3a7937e460e3a243bfa9491d35e3fdbef76de91fed756a7bf94410519b8a16c4d04eb4b19840ce83a3cbcd14104a120c2da5188668da6522b6d8c179e4be9b4b08508e7d9c9c7ec343bdecf3670f17ec0322ad7dee5217880554173a56cc066a280152220d44e7249ace694bb02cf09632df75e94b083e9d7c1b7c1e46ab043da5f4693abd97cf07db6433ac387c1f56cbead2cd25129ea5e509c58e9a953c26aed99d69c3be678214b3f1fff77339bcede93cbb7dacbcb7744ee5e5c5c849f8b85208cba80e25478187276d4e2b470a5705299c2ae0ab1a3045ce18dd34c7a89c872f09e856170c839ee9cb7465a8bb74c5a5a0b6a0d935c79c38c0881a2e367c7adf36706432420057314c2d48c260d81b014204a2c84d5b68c8676eff8f4acb79f9df43b212c4fb3a3de6638b242024e75d2f89653e36a888a7902df03b1b43be74c4881d402e0c98c929078d66de2c037c011d4acf93c244e11f6d00e4fadf1944853e0c66c6f94a4708f5b9ad954997790f57be750b14bdadd0f1da8bb06cf7f1271113b47d185a40679b1081167aaa46b8f47f9f43e7fffa2308f807a8fdf844678579e74b0740af4633efd9b64e3fcafc1f47a3e2047833f46e3c134ffbeade6c25b6aea11e6cc53aae7d70fe3c1d69aa3d2508914af95963426334ce32fe34d235e661e0950d59410dbacaa71edd9f5e87646b29bd17884a2b6b5ce5c58ba2c5e0148739146e75b2b1b776c0a2f64f2717e3d42f5dedebbc6a19a546419fc29944e23a37cc8261cabbda6a08b32ba8c965aebaa788ce6f970389a4dd715fd05d858022761579cd988b60e548d985ac862c10f0b7acc0b7a6c44d914ea8ae01a09e324ee793ebcdf8ce05f00950a5fe89a89413e69d036d8603e6b8401b5b2148de7f23b2ba04b8d004937238759bbffe96cbd017cada842cd124a49c9aaf617a95de01f0e86f70fa021948ded0b239774490365c6f02790a1edae08d593efa27434145f29f4d37c3e9abd0219c40830091ab4dde5bc1107c3f6cc162d1db897a9c0b2a599f3e19701e94c4677af5128a3dc97c4666e8ff13d68dd0c0726713b77f72f267a780a70c008a03e5d3b5298e8d1b3834672577947318538ab18d71653ad5e3636d3bb874933849004c5e031d99ae6a3ee4c42f667f78331a92a55334d4d12fb8dd861ac114640734c9d5b191ea35a5925dabd9376e714b4b0015b2c413c36186b9f6a07f2387ca3984a8729b418747d80d6acc22c43895ce724bb7dd86c6c9e448e9818db86457e581442cea4244a86893d8cd21ef5516ba75845ba15f4febf77a32186fff6608e6efd66f47546d82ed764f283fc4ede08ca18f602c32ae431ff862f263f2edf6d2bab14d48bdafc6f8c490b1b0b8797222a2c40a455abed8240ac29d41524deb23d709c558ba187abfb22fea3d9fe72f4b8be29f4357d1f2f5f6231261d963ea12e56a468c180a93d4bf4ec72cff2b3c2f278e71135adc422042f5fed72248a4dddb42f2ba08f5135a245a99a6a0a264aa23e0ea1d7d2535bb87ac5cea0dd72b1f6e17386d461bf5dbe6b46d314ee1bf6e2daf9dc749172637386d82bb902cbdbeea293decc9597836ba1c3be6ca530da9d2476735c81f4c05a79c14e8e05da2ac7870ed4ed76ca15daa335e12b3520c20a1c5d9673e6acc5d671d95b82334e07b7dbb721d1de3289ed026e3ecde70569851e738730ff1e75fa1bfd67421bb103021d7c503267206d513ae138bfc72811b7c3af8c518ad3b58d36e68b2476e7b0d3ee7ff8dc8cdfb1b5050316d52bf020842903fd2c1f8eaeb06122df5e6144e782a30f5aa1685cf2a4a14ff6963d36de23f11aaccc8166537d87c036121a85d8f1451161f807d0915248bb1ac33bece3a367c738eb0adb5b8c771a0f247ce26c94e4200ef4f69ee1aac3a395082bd1c4498e6a23577323366b9e0ce3d4891409371fab5b1486611bb246cf5a432df67458c34bc195d5324c6dd08ac100481d896b292f31bbe224ba03be34215a7414fea8ada227216bc405d1a3e39632b81cb24c20d6711d04161189b7c66293e322c3a04670488d271692025d7cec60cc4ec378bcc7cc0f396347633ec58a07f28810b602c3a3416427c2e4b9713a6c7d69dd2ca9041309520b89b1965918d6905a9c12c4bfc10d697d17815ac931d980aa96db08c42e9ac350b57a27fd5ee08ceca0f788289fba702da09487b8aa7697ca38a227851565c68d1bace74d301c53132c547d09f19429176915e5970a6524dca075418ec7b54ba5ff01c0427edd0a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6edb400c85f73a05972d508cf937438e972d926cba6a7501d59e040aecd8500d14e8697ad4526d0239410224e1e22d2482dfe3e35052326176d1a2b994aaf0abc3e40c213a4b816f57f10566f18c52c510cd4d914af4dadc526899520a98e744d5f0e107a956d877ac98aaaa3bb9572b6295e9f9de5df7bd93ac4924133911b21462f1972667d6d8433c3b17332a6a662f4ffedc77ab4b0287febaabd1f2a804faafb1a9ce01a85a684686e9a6232e296b5e0c6517309308e52c966219fa6df7e1729cf6036cdb0ebe0cb76d3a7c84feb6bbe8dfc956ac91c55974e8b1df2bd8bbb1dd9dda13b8cd704fa8e76cafffe19173708bd459e3f84167ae29204b15891b0b85a5e5965625ec07fde2e7a9c1e6b03f4e871f43c061d3a6d3783d6e060847c7e1e600531b76e3ef61fb3495371b939a02bf54b60ac69810e70331a35a3c3ae67fc6aeda5d9b021a36d6e02b5a3172f904758dba8ea77c4c7ff6e9ded05f9cb0b0c00a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383231303431362d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032353633203030303030206e200a30303030303034333838203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303031393933203030303030206e200a30303030303032313330203030303030206e200a30303030303032363236203030303030206e200a30303030303032373531203030303030206e200a30303030303032383831203030303030206e200a30303030303033303134203030303030206e200a30303030303033313532203030303030206e200a30303030303033323736203030303030206e200a30303030303033343035203030303030206e200a30303030303033353337203030303030206e200a30303030303033363733203030303030206e200a30303030303033383031203030303030206e200a30303030303033393238203030303030206e200a30303030303034303537203030303030206e200a30303030303034313930203030303030206e200a30303030303034323932203030303030206e200a30303030303034363338203030303030206e200a30303030303034373234203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c45333635414541394432444134384342463434343243343045363132313837323e203c45333635414541394432444134384342463434343243343045363132313837323e205d0a3e3e0a7374617274787265660a343832380a2525454f46	Comprobante_000078.pdf	application/pdf
79	79	2.00	2026-01-08 21:14:30.272401	EFECTIVO	14	1	\n[PAGO PARCIAL SIN MULTAS] 1 multa(s) liberada(s) ($13.5000). Pendientes para próxima facturación.	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323230330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb4e234916ddfb2b62c148c508a2e2fd286916c698122d635be06a9534cc22310995253f906d6646f335f30ffd45bdec75ff409fc8b4d369134941d9b6446292709e7b6f9cfb0c33aa8d65951727ff6930f2b97136687cbc10843b32786808468ddf784932e83418e542105c0dc7557043668f0d6e1d55b6b2d47947acd3947bcb9c315c712b8576860cee1b1f7ef9d21d34c9799b343f7f69927e6fd03cebb48fc9e07ba33d28655041066e28db10c1fa42062103ba0e176f7410412888b0b114a259a3a9d44a1be385e7523a2d6c2ec24db3fb4bb3dfbc3a6b6ee1e2f98065546e3ccb43f000ab82e64ad980cd440e2b4440a8ace49258cd2977399e13c65aeebd286093c9f7e42919df2527a4f52d1bdf4d67c9ffa627a43d7c4eeea7b35d65918e4a51dd05c589959e3a25acd69e69cdb9638ee7b20cd2d11f0fd3c9f413b9fda0bdbc3d26f2f4ebd7afe1e7eb4a10465d40712a5c0cb9fedce034df4ae1a432b95d15b8a304b6c21ba799f412cc72d83d0bc3609173dc396f8db4164f1937b416d41a26b9f286191188a2e36b478d9b3792214248c11c853015a34943202c0588122b61b52dd8d0ea5df5af7b67cdeea01d68d96f7eee6dd391e51270aa6b8d6f3935ae82a89827d87b201676e79c0929e05a00ec4e29098e67fd360ef60638829a8d3d0f8e93d31edae1aa35ae126e0adc98ed8d9214dbe34a339ba5e79d3707bd1ba8d821adce651bea6ec0f31f302e62e728ba90d4c02f56147166e974ad51964e16e9a777d13c02ea3dde090d7a2f77d2c1d275a057c96c9190e6e373364a66abdfbbaa2dbca5a64a2f675ed33bbd7f1e253bab8d304325fcbb1257ea319961da6825853ac816330ff62f034a20365b06b8d6f43e7b9c92e64336ca10d176d6990b4bcbc815803417f5e85c1e6663ebf0821b5fa5f71942f7eebb6b1c42c9325386fd144abfa26978d82176567b4d912c0a7a192db5d6cbd091cdd2e1309b4e3635fd09d898fbd6c2ae33e641b47548d420d54a168becb04a8e699e1c0fa26c1dea3abd1d84c7b5b837e970b14de19f00950a3774c5c4483df5a09de99cf4b3c9747e9014a895a5a83ccb7b56409d4a06249d26b968b6065fae372bc07d110b714b2825255bd6bf70ef1cff22192e9e670941e8d83d387249cb5450380d7f0519da9e8a1041f9294a7e71188ad5a1f7d35936dd43428825c15ad0a0ed29e707d960d89ed9bca643fe650a957011b02ed2e1b784b4c7d97c1fb1329aff6ab199fbc8f847686d0eb3b975b8edf9621fc93e1e3fea40fbedeef9c16a58e51d452be2ac625c5bb4b6ba2c7026f3e7f161f2422d28ba8ff1614a9b5ac8c174918cc8325a1da6b8a9c53ee2fa44b383a40554c9d4b9b5e5d1b015a1a2d5ebb6da7de4862dd87c14e231c7d8782d2721883680835103b4afc5543af4a279bbeb03b4664bcc824be43e0d7dc97681f32a72c4c69839ac7cc4221a7226255132f4eda1a1f608925a3bc58ae4bb823efb7d9e0d310268253394ed0fd9f72961a75c93f16fe41fe44850c6301d182e398f2e38dc18ff767bbcabac52502f2a5300634cbdb047e2846dd3e1bd880a631069d57ac620403685d802cf2b6b04c7d9723cf47cb7c81d20eaeeef478feb5b87fe6e7df1f9806556d71a228283002c6908d72b264157cfa345b25986ed877ed2c15dedd2bf318d407e2e62f75536794ce6e494dc641332bd9ba7b37f27a1b74877964220d0540ded30a0aa15e388cb9781662fcc92183c2253e53c0ed99b8569d006b30aa3ef4caca8be75e09bfabe1cee45499327e56581897902c27ced1c2fbab69ce3fd2867bd9ca9c54d8b910750578913f8f0a5aa69df979b5fa26aa13149aea8c6c0e43ad048aeda979e1861e2fd3a6972ccbc03e4e5af4d0465f6b7dbe39d3545c455aaa2a902196a718fd8cbb0f483acfc567711ce2081faf2ae96e1c1a10cc1e14067d5a86d3bcbfbc1b179146966adb0b6ba1efc807588c08416792e9f750747c5ecaea809cedb50b8d32e86b42f06d17baa6e05d88c3f10a659a1b651d5e605f5483f79dcbdc68d362fb5d82ee0a69374961744a1893921cc7f82b84ff4ff637a103b60bc664d9917b8f4b6a838aed2059ad5b8217ea651579c6e1c9aa083ad076f5fb45b83cb5f0fb2f31c7336ecc8bae8863be6a0d7e930bbc320933ced6110c4054795bd66b7c641623d74f7633982c173241e836319a0e5754cacace05653d8ac1c7b601410329252f0bb4af9e870e4135b3ac25284388d8608f7352e12ad66746934cb719cf484d31d8114c70d9c1c6f6a569acdc104b20827c378eec440838221e5340752d9206a746dc8fa927b075515f7ca225863e285232f7c089e2371eee9259e83958ac26e05eb303511602056c62c155b095963f68f2d1d3594c1e9a365024cc779230ed744cd53a3c41488cca84a918dbc1086e348d0c617c6ec348c933d667ec8195b1adb538c10416811c234e446fb2a789c256fe4e8b0f1adf150e611f4baf02aa4810da7c218005ec52901f50d0ee0ab932ee42aaec3d977694e244fb98c58bdeea0171246f3bcf7224fbe769e9f43298fa0ac2a47f58c833b7558b1fe64fb80f48d2d09c7a12eec5622c3cecbb1ff08b1a89f4eee8b2343b259ba426840841c6b8b14eb70de5e0938e114cce39f6c7d131b22f22881b9b02fa749962b04aed8d2e07a101d8b1c4ccf70768ce53aba34eaa30e22e163f89cc21721bc82a7d62cdc9c0e602b7c5d8c30f8ae8159674eeb3074a809111af325e41490c607f262ea8e7bcae3b0101c0fd9d83b81061bc3d3c0b2f2b3b08cb3c5f07cdb48b185f0bb88e5632be176d053dbc0231009ef94c149486465fc540abd4a080f163a4018281b5d1733503c36c4ac1e0f0db18d842e4633f8377487ab307cd924ca8cb7f2b21219e4eb3d2036237814264898c5e87ce6148b13167185553610cd7eee57bd6aaffd89e4fe34f83bf9f0cf506a227c5cb72e516fdf5c76c9d597cea079f32fc2c93874aab71fe6f886c828bb4b67c9fdf2afdbd050a29760ecf698ae9d754e9e129c703ccdfefc6f364ec84331431c667f4e5645dc5fefabd5270a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d4e23410c85f7750a2f67a451a5fc53655796330236b39ae90b3449811a25246a2221711a8e8a9b1f754020015ebc45b7e5eff9b9300a2a13194b915c4a15b80d291a818b4c52e0df997f81492c27aeac29a9a9242cdeab534bc1794a29a09623564d2f3f50a4c23690a45845ccd0ac6a61ad84eff76ec2ffc05922734634c4445c90d83e9a9c497c0fb66c5454b188aa7e3cf9771716a70806dd45a8def2aa18babfbea94c0188a86b4e04e365402a314b9e0d656350650fe52896a219ba75f8713a8cdb1ed66d037ffaab36ee7e4277154eba6fb22555cfe228ba64bedf27d89ba15d1fda1bb84e708b498ed9569fe09eb3730bd749fdf84e27aad1217315f61b33baa5f9965ad9ed3bfde4e6d060b5dbeec7dd79ef7058b5f1305c0cab1edcd1bebfdcc1d8facd70d7afdfa6f265635ca3e3e7ca5a4129c594a6031125517f74448fc6ceda751b1dea3696600b5c50a2f20bea1265e9def7f17e1b9f0d3d009cb6b0c00a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383231313433332d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032393938203030303030206e200a30303030303034383233203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032343238203030303030206e200a30303030303032353635203030303030206e200a30303030303033303631203030303030206e200a30303030303033313836203030303030206e200a30303030303033333136203030303030206e200a30303030303033343439203030303030206e200a30303030303033353837203030303030206e200a30303030303033373131203030303030206e200a30303030303033383430203030303030206e200a30303030303033393732203030303030206e200a30303030303034313038203030303030206e200a30303030303034323336203030303030206e200a30303030303034333633203030303030206e200a30303030303034343932203030303030206e200a30303030303034363235203030303030206e200a30303030303034373237203030303030206e200a30303030303035303733203030303030206e200a30303030303035313539203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c44333142383833434334414135424344423943433730364533324141344334393e203c44333142383833434334414135424344423943433730364533324141344334393e205d0a3e3e0a7374617274787265660a353236330a2525454f46	Comprobante_000079.pdf	application/pdf
80	79	13.50	2026-01-08 21:20:57.560135	EFECTIVO	14	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313931320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb5594b6edb4a169d6b153570032f805da9ff27400f68590e12d896102b0f196442cbb4a340120349ee6ef46a7a0f6f453dec5df42992a228b9e8c49168208c2c9479eebd75ee9f516d2c6bfc70f2cf1e23ef7be7e3dedb4b41b823e3879e60d4f89d1f49c6573d46b910044fc3f114dc90e5638f5b47956d1c75de11eb34e5de32670c57dc4aa19d21e3fbde1f1f3fdf8c13723120c9fbcf09190dc7c9f9d5e00d197fef0dc6b50c2ac8c00d653b22585fca206440d7e1e18d0e22080511768e42346b34955a6963bcf05c4aa7852d44b84d6e3e26a3e4fa3cd9c3c5fb01cba8dc799787e0015605cd95b2019b8902568880d038c925b19a53ee0a3c278cb5dc7b51c2a68befe98f747e979e92feb7e9fc2e5fa6ffce4fc960f294dee7cb4365918e4ad1bc05c589959e3a25acd69e69cdb9638e17b28cb3d9ff1ef245fe8e7cfd437bf9f50d91675fbe7c09ffbe6c0461d40514a7c2c3904fef7b9c1657299c54a6b0ab027794c05578e334935e82590eb76761181c728e3be7ad91d6e22df39ed6825ac32457de3023025174fcecac77fb8b648810523047214cc368d210084b01a2c446586d4b36f487d7a34fc3f3e4663c08b41c25ef87fb746485049cea56e35b4e8d6b202ae609ee1e88a5dd3967420ab816006f724a82e339b68f83bb018ea066e7ce83e314b48776786a8da7849b0237667ba324c5f5b8dacca6f2bc8b643cbc858a57a47ff561007577e0f94f1817b173145d486ae0171b8a3853395d7f36cd16ebecddab681e01f51e9f8406bdab9b74b0741be875ba5ca724797c9aced2e5e6ff43d516de52d3a497332fe99ddd3fcdd283d54698a112fedd882bed98cc306db492427572c5cc83fd554009c4665580ebe7f7d3c79c240fd3d91411ed609db9b0b48e5c014873d18ece653717db8617dcf83abb9f22741f7ebbc62194549932dca750fa054dc3cbbab859ed3545b228e965b4d45a57a163bacc269369bed8d5f4376063eedb0abbcd989d68eb90a841aa8d2c16d961931cb3223976a26c1bea36bd75c2e356dcdb6cb2dea7f06f804a852f74c3c4483deda057f98a8ca68b7cd5490ad4ca52549ef57756409d4606245709b94cfae3cf9f762bc063110b714b282525abea5fb877817f994ed64fcb9420741c1e1cb9a4752a289d86bf800c6dcf4488a0fc0c25bfe886626de8a36c39cd8f90106249b01534687bc67927170cdb335bd474c8bf4ca1122e03d66536f99692c17cba3a46ac8ce6bf566ce6de32fe165a9b6e2eb70d77b05a1f23d9c7e3471be8687073d1590dabbca368459c558c6b8bd656d705ce62f534ef262fb482a2fb987753dab4428ef3753a2355b4eaa6b869c53ee1fa5477d319a14aa6ce6d2d8f86ad0c15fde14d7f30426ed8832d46211e738c9d9f6a1282680338183540fb564ca5432f5ab4bb3e406b5661965c22f759e84bf60b9c17912336c6cc61e32316d19033298992a16f0f0db54790d4da295626df0df4f97f57d3094600fd7489b2fd61fa3d27ec8c6b32ff8bfc9d9c08ca18a603938af3e882c317f3bfbebe39545629a8178d298031a65dd81371caf6e9f05a44853188b46a3b6310209b426c81e7d53582e3ac1a0f3dddad0b0788bafbebd1e3fab6a1bf5a5ffc7dc0329b670b11c14100d63484eb9593a0eba7d93add2dc38e433fe9e0aeb6f26f4c23909fcbd87d3d5d3ca62b72466ea70b92dfadb2e53fd2d05b64074b2110689a86761850b58a71c2e5f340731466490c1e91a90a1e87eccdc234688759a5d10f265654df36f05d7d9f0ff7a2a42992725560629e8030df3ac78b9eade7783fcb59cf676a71d362e401d44de2043e7ca969dad7e5e6e7a85a684c921baa3130b90d3492ab8ea5274698f8bc4d9a1c33ef00f9e1cf044199fdedeb9b833545c455aaa1a902195a714fd8f3b0f493acfcabee229c4102f5f5b75a8617873204cb81ab4da3b6ef2caf07c7e551a499adc2daea76f00eeb1081092df25c31eb0e8e8ad95d59135c0ca0f0d5a01cd23e1b441fa9ba1560337e419866a5da46359b17d423a3f4f1f01a37dabcb462bb809b2db26551108526e69430ff4e30f283fe674e3bb103c66bd6d479814b6fcb8ae33a5ba3598d1be2771a75c5e9ced2041d6c3bf8e072d01f7ff8b3939be798b3e146b64537dcb100fd944da6771864921f47180471c151656fd9adb1486c87fe983d64cb55be20c92cfb57bab8cf96d88da5cb494ec6a0c32a9dd49531602450b0b58130459913ab3ab8d51426ada72298148484a514dcb2515d3a6c84624767388a08a8d12fe17b8d8744271a3d1a4d821c8ba0b0fc11c880dc2006e043cb49b33bb74092e164124fad98775010a81ef6402a1b448d9e0d4581e4de4155c5bdb288e518886123863f826349ac45bdc47b705251d8ad2425862a0204c5c998a56227216bccfeb1a3b39e32584e5a26e008584762f7265ade1ae5ad40e046d18a64e585301c1b431b3f18b3d324ee0b31f343ced8d1d89d62c208be8b10c52137ba5bc1e32cf9458e4e7adf7a0f759a412b0ca74396d8f1394c09e0749c1250df603fdf1c842195711d56e3b539915b6515d08637e361c827c9c5f0591a7d69dd5f40a12ca010bedee4c372b8bb36ac6855bdbf40fdc5968563e90bc3d5d03074b5169821568db2c57db95244afba2d4efe0f520e0f3b0a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6edb400c85f73a05972d508cf937438e972d926cba6a7501d59e040aecd8500d14e8697ad4526d0239410224e1e22d2482dfe3e35052326176d1a2b994aaf0abc3e40c213a4b816f57f10566f18c52c510cd4d914af4dadc526899520a98e744d5f0e107a956d877ac98aaaa3bb9572b6295e9f9de5df7bd93ac4924133911b21462f1972667d6d8433c3b17332a6a662f4ffedc77ab4b0287febaabd1f2a804faafb1a9ce01a85a684686e9a6232e296b5e0c6517309308e52c966219fa6df7e1729cf6036cdb0ebe0cb76d3a7c84feb6bbe8dfc956ac91c55974e8b1df2bd8bbb1dd9dda13b8cd704fa8e76cafffe19173708bd459e3f84167ae29204b15891b0b85a5e5965625ec07fde2e7a9c1e6b03f4e871f43c061d3a6d3783d6e060847c7e1e600531b76e3ef61fb3495371b939a02bf54b60ac69810e70331a35a3c3ae67fc6aeda5d9b021a36d6e02b5a3172f90475cdb4468463fab34ff786fe029c3eb0b80a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383231323130302d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373037203030303030206e200a30303030303034353332203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313337203030303030206e200a30303030303032323734203030303030206e200a30303030303032373730203030303030206e200a30303030303032383935203030303030206e200a30303030303033303235203030303030206e200a30303030303033313538203030303030206e200a30303030303033323936203030303030206e200a30303030303033343230203030303030206e200a30303030303033353439203030303030206e200a30303030303033363831203030303030206e200a30303030303033383137203030303030206e200a30303030303033393435203030303030206e200a30303030303034303732203030303030206e200a30303030303034323031203030303030206e200a30303030303034333334203030303030206e200a30303030303034343336203030303030206e200a30303030303034373832203030303030206e200a30303030303034383638203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c45444535423631333231443141334433453439463730413638423645354144413e203c45444535423631333231443141334433453439463730413638423645354144413e205d0a3e3e0a7374617274787265660a343937320a2525454f46	Comprobante_000080.pdf	application/pdf
81	75	2.00	2026-01-08 21:39:47.669304	EFECTIVO	5	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313736360a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a9191820445bd1f9166d1188312198cc08958b031a6218e6c1c19d048f335f30ff9a259ce5fcca9eeb6dd365504b0db525a51abe873dfe7de5b8c6a6359edc7c95f2d468e5b07fdd6fe9120dc91fe6d4b306afcca4f927eb7c5281782e069389e821b32bb6b71eba8b2b5a3ce3b629da6dc5be68ce18a5b29b433a47fd3faf8e5eb693f23871d921d7fcdc859af9f1d743b3ba4ffa3d5e92f645041066e285b11c1fa52062103ba0e0f6f7410412888b07214a259a3a9d44a1be385e7523a2d6c21c24576fa253bcb4e0eb2355c7c1fb08cca956f79081e6055d05c291bb0992860850808b5935c12ab39e5aec073c258cbbd1725ece0fec7e0e760723dd825edefa3c9f57436f87bba4b3ac3a7c1cd74b6a92cd25129ea5e509c58e9a953c26aed99d69c3be678214b3f1fff773bbd9f7e22571fb597573b44ee5d5e5e867f977341187501c5a9f030e4fcb8c569e14ae1a432855d15624709b8c21ba799f41291e5e03d0bc3e09073dc396f8db4165f99b4b416d41a26b9f28619110245c7cf8e5b17af0c8648400ae62884a9194d1a0261294094980bab6d190deddec9d979ef203bed7742589e65c7bdf5706485049ceaa4f12da7c6d51015f304be07626977ce999002a905c0d3292521f11c5fc7816f8023a859f179489c22eca11d9e5ae32991a6c08dd9de2849e11eb730b3a932ef30ebf72ea06297b4bb9f3b5077059eff26e222768ea20b490df2621e22ce5449d71e8ff2fbc7fcd39bc23c02ea3dfe2734c2bbf2a483a553a027a3bba77c8c6c1bcc86d34dd515de52530f2b675ed237bf791a0f365617e5854ae475ad9ea431b94039c747a468c4b5cc23eaab4212029a5585ad3dbd19dd4d49763b1a8f50c936d6990b4b17152b00692ed2e8ba19bfa6e042f69ee4372354eccd9d6b1c2a484590c19d42e934b2c4af09bf6aaf2928a20c2ea3a5d6ba2a18a3593e1c8ea6f7ab8abe033696b449d8254f36a2ad033d23a4e6b25870c29c12f382121b5136850ae74a27dd1652361ac649dc8b7cf8b81ec1ef00950a2f74cdc4209c34681b0c305badc3db623dad2c45b3b978670574a9911ee966e4286bf7bf9eaf367ddb8a2a942ca19494ac6a7991da05fed160f8f8341b10948dcdeb229774c10265c6f01790a1ed9e08c593ef856ea399f84aa19fe5b3d1740b5c10e3bf2468d0768fafb655db72306ccf6cd1c6817a9942f35b56aba37cf87d403a93d1c3360a6594fa92d8cced33be0fad4d33ce4de1761e1edfccf3f014e08011407dba76a430d19767878de4aef28e62f2705631ae2d2659bde86bee1f9e26cd10421214c3c664639a8fba3309d99f3e0ec6a4aa54cd343549ec0f6297b1461801bd31756e69788c67659568f74edb9d33d0c21a6cb1f8f0d85aacfcaabdc7f3f08d622a1d26cf62b8f5015ab30ab30c25729393ecee69bdb179113962626c18e6f96151083993922819a6f4303e7bd447ad9d6215e956d007ff3e8c8618f8db83199af5dbd18f29617b5c93c92ff227f9202863d8050cab90c7cc1b5e4c7e5ded6c2aab14d48bdacc6f8c490b1b0b87b7222a2c3da455cb8d8240ac29d41524dea23d709c55cba0a7ebc722fea3d9fe76f4b8be29f4157d9f2f5c6231261d163da12e56a468c180a9dd4af4ec62b7f2bbc2f27ccf1135adc4f2031f5fee6f248a4dddb46f2ba0cf5135a245a99a6a0a264aa23e0fa16de9a92d5cbd6467d06eb94cfbfc2d43eab03fae769ad13485fb81bdb976be365da45cdb9621f64aaec0c2b63befa4d773e5ede05ae8b0235b2a8c762789dd1c57203db04a9eb3936381b6caf1a10375bb9d726df66c35b8a506445881a38b72ce9cb5d8342e7a4b70c6d9e06ef33624da5b26b15dc0cdeff359415aa1c7dc25cc7f0201fea4ff4c68237640a0830f4ae60ca42d4a279ce48f1825e27678cf18a5385dd96263be4862778e3aedfee76fcdf81d9b5a306051bd020f429832d0cff3e1e81a1b26f2730b233a171c7dd01245e362270d7dbabfe8b1f11d89cf604d0e349bea3bb06da4d028c48e2f8a08c31f808e9442dad518de61071f3d3bc65957d8de62bcd37820e11367a3240771a0b7f70cd71b1ead44d888264e72541b6cd1e67323962f9e0ce3d4891409b71dcb9b1386611bb246cf5a432df67458bd4bc195d5324c6dd08ac100481d89ab282f31bbe224ba03be30215a7414fea8ada227216bc405d1a3e39632b810b24c20d6710504161189afc66293e3f2c2a04670488d271692025d7cec60cc4ec378bcc7cc0f396347633ec58a07f28810b602c3a3416427c2e4b5713a6c7d6fdd2ea8041309520b89b1925918d6905a9c12c4bfc1ad687d17815ac931d980aa16db08c42e9ac350b57aa7fd5ee08cecb0f78c285fba642da09487b8aa767fca38a227851565c6b55babd74d301c53132c54bd8478ca948bb48af24b8532126ecdba20c793da45d2ff47057a320a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d4e23410c85f7750a2f67a451a5fc53655796330236b39ae90b3449811a25246a2221711a8e8a9b1f754020015ebc45b7e5eff9b9300a2a13194b915c4a15b80d291a818b4c52e0df997f81492c27aeac29a9a9242cdeab534bc1794a29a09623564d2f3f50a4c23690a45845ccd0ac6a61ad84eff76ec2ffc05922734634c4445c90d83e9a9c497c0fb66c5454b188aa7e3cf9771716a70806dd45a8def2aa18babfbea94c0188a86b4e04e365402a314b9e0d656350650fe52896a219ba75f8713a8cdb1ed66d037ffaab36ee7e4277154eba6fb22555cfe228ba64bedf27d89ba15d1fda1bb84e708b498ed9569fe09eb3730bd749fdf84e27aad1217315f61b33baa5f9965ad9ed3bfde4e6d060b5dbeec7dd79ef7058b5f1305c0cab1edcd1bebfdcc1d8facd70d7afdfa6f265635ca3e3e7ca5a4129c594a6031125517f74448fc6ceda751b1dea3696600b5c50a2f20bea92ebd25fc63ede6fe3b3a1079d92b0ce0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383231333934392d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032353631203030303030206e200a30303030303034333836203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303031393931203030303030206e200a30303030303032313238203030303030206e200a30303030303032363234203030303030206e200a30303030303032373439203030303030206e200a30303030303032383739203030303030206e200a30303030303033303132203030303030206e200a30303030303033313530203030303030206e200a30303030303033323734203030303030206e200a30303030303033343033203030303030206e200a30303030303033353335203030303030206e200a30303030303033363731203030303030206e200a30303030303033373939203030303030206e200a30303030303033393236203030303030206e200a30303030303034303535203030303030206e200a30303030303034313838203030303030206e200a30303030303034323930203030303030206e200a30303030303034363336203030303030206e200a30303030303034373232203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c33423337463835334135463241334534424243354130313432363935333645303e203c33423337463835334135463241334534424243354130313432363935333645303e205d0a3e3e0a7374617274787265660a343832360a2525454f46	Comprobante_000081.pdf	application/pdf
82	73	2.00	2026-01-08 22:28:23.846806	EFECTIVO	7	1	\n[PAGO PARCIAL SIN MULTAS] 1 multa(s) liberada(s) ($20.0000). Pendientes para próxima facturación.	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323231320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55adb4e1b4d12bef753f4052b8555e8f4f910692f06632222c01638bf222d7b31982199c807649b3d3dcdbec3ff447bb9d7ff0becd733e3f1d8f41088b1052333b4e7abaaaeaaafaada8c6a6359e3c5c93f3a8c7cea1c0f3b1f4e05e18e0cef3b8251e3375e920ccf3b8c722108ae86e32ab821f36f1d6e1d55b6b1d47947acd3947bcb9c315c712b8576860cef3aef3e7fb91c26e4a447924f5f1232e80f93e3f3de2119fee8f486b50c2ac8c00d651b22585fca206440d7e1e28d0e22080511369642346b34955a6963bcf05c4aa7852d44b84e2e3f2783e4e238d9c2c5f301cba8dc789687e0015605cd95b2019b8902568880d058c925b19a53ee0a3c278cb5dc7b51c2a6d31fe9433ab94ddf93eef77c723b9ba7ff9ebd27bdd1637a379bef2a8b74548ae62e284eacf4d42961b5f64c6bce1d73bc9065988dff773f9bce3e929b77dacb9b43228fbe7efd1a7ebfae0461d40514a7c2c590ab4f1d4e8bad144e2a53d855c17794c05678e334935ec2b31c76cfc23058e41c77ce5b23adc553261dad05b58649aebc61460447d1f1b5e3cef50b9d21e29082390a611a46938640580a102556c26a5b7a43b77f31b8ea1f2797c35e70cb41f2a9bfed8eac908053dd6a7ccba9710d44c53cc1de03b1b43be74c4881d002e0e58c9210784e6ce3606f8023a8d9d8f3103885db433b5cb5c655224c811bb3bd5192627b5c6d665345de4932ec5f43c573d23d3feb41dd0d78fe138f8bd8398a2e2435888b958b3853055d779c67d365f6f1556e1e01f51eef84867b573be960e936d0647af72ff2990cd2515a5c76d558784b4dd3b39c794ee5ecee719ceeac31320c9508ed464a69c764dae0c723dbee65779987e357b924f834ab725b7776977f9b91e43e1fe748663bebcc85a575d20a409a8b7674bb9f7d6d830b017c91dde548dabb6fae714822154786ed144ab723236b6c268d37da57ed35054b94ce65b4d45a5739239f67a3513e9b6e2afa0bb0b1b86d855d5325b9de24e9b752d881a4e1552b712c9861458c59418c7bd1b70d754d6d7bf1e456dceb6cb4dc76e25f00950a3774c3c4a09d76d02e78603edb0bf76965294acefa9e15d0a5417de43c21a74977f8e56a3f5e85ac2594929255852fa2bbc03f4d47cbc7794a9039764f8d5cd29a08caa0e1cf2043db2311f2273f42f6d89915e2fed5863ec8e6f9ec0de8204681ada041db23cef7b2c1b03db3453107f6650a257099b04eb3d1f794f426f9e22d726594fd5ab199fbc0f80768bda7cd6dc3ed2d966f41f5f1e4d1063ae85d9eecad7855de51f420ce2ac6b5454fabebf266ba789cec87145a41d1764ce45eb6b41572385ba6635265abfdd436add80742bc676c2fb4801a993ab7b63c3ab5325574fb97ddde00dcb0055bcc403c06181baf6a04826c0338183540fb564ca543135af4b93e406b566196be44ee32927c7bdc6e499e458ed818c386558c586443cea4244a86863d74d21e49526ba758c5bc15f4f17f17f908bd7f379da368bfcf7fcc083be29a4c7e277f2107823286b1c0a8f279b4bfe1c6e4f79bc35d6595827ad168ff8d31edc21e44dce1b5880af30f69d57ab820e06c0ab9059157d7088eb36a2ef478bb2c02201aeeaf478febdb86fe6a7df1f9806556d71647840f02b07643845e3902ba781c2fd3c51edc4f3a84abade21b6308f07399bbcfa6e9285f2cb3e9284f494aaeb2c729d8325b9023729d4fc9ec7691cdff8e25e1deae7209a49ea6e91d6655ad821d08b6275f93984182bb0acf0e7ccec26068c3d7ca6dd8d9d5a2fab6816feafb74ce1775a382a6ab925385492388a465a4175d5b8ff47ec6624fc76b71d3620402d41595021fd1d534edebd8fa29aa161a43e5866a0cbedd061a61afb7d213d34cbc5fd328c7f8bb08a7df12a469f6a79bc39d35450e56aaa1a98233b4e21e4482e5273cfdd27011ce80527d7d57cbf0e05098e09ce07cd5ba6d07cbebc1b17914c4b356585bdd0ebec7ca4460580be62bc6de215031cb2bab84931e143eef95f3da2733e937aa7705bc197f2071b3526da39aed0c2a9441fa6df7aa37daceb462bb809b4db379512285b6e63d4a908f189e3fd0ff4ce85eec80799b35352f70e96d59835c644bb4af7143fc4aebae38dd383f414fdb0ede3bed758767bfed65e739266fd89175198e702c40afb2517e8bc926797883b910171c75f7dabb3198f6edd0971feaa10c9e23f1189cd000ada86c628506b79ac266f52004c381c0484a21ee1a05a5c3e94f6ce9184b91e2345a24dcd7b848349fd1a55196e338f409073d0214c70d821c6f5a569acd5105588493519c3b31e2a0f0907abe03a96c1035ba36b0bee4de4155c5bdb248d69881e1f40b1f42e4481c817a89e760a5a2b05be97598a308782056c62c155b095963f68f2d1d7794c141a465029e8ea3479cb38996a7461d532033a34e051b79210cc7e9a08d2f8cd9691477f698f921676c696c4f315484438b90a621371a5ac1e35ef2421f1d75be77ee6b1e41f78ba8020d6c04150603882a4e095cdfe02cbe39fb0257711d8ec16b73823c6595b1fa97c37e208ce4a4ff84279f3bda2fa0944752568d537bc6e13b6d58b18e65fbacf4854d0ac7f92eec5623c3ced541c018b968904defcad34374a7cdea0342032270ac2d29d6e1e8bd9170c2a998c73fd9fa26364414590293625fcf972c57485cb1a521f4203a1639989ee11819cb75746934461d44c2c7f03985ef447885486d59b8392fc056f8b61c61f0b503b3664eeb30866849111a1327700a9cc607e7c5101ef794c7e1217c3cb0b177022d37c6a9c1cbeacfc232ce96e3f46d23c51622ee22968fad44d8414f6d831fc191f04e191c8c4456c6cfa9d0ab84f460a1038481b2d1753103c57343cceaf1d410db48e86234437c4377840ac3f74ea29ef152bf6c6406f97c0f88cd0811859912a633ba9842c5f284455e618d0d44fb5fc455bfd96b7f24453c0dff4cdefd35949a481f57dd33d4dbd76797e4e2cbf930b9fe1be164123ad59b770b7c59649cdf66f3f4aefaeb263494981131767348d7c1ba200f29ce3c1ee67ffc339fa4e4be9c2a8ef23fa6ab22eeffbd4dd86d0a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a7c852b2aa4ef00cb9a7c4d06c7fc639fff38fa09482cb0e30a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383232323832372d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303033303038203030303030206e200a30303030303034383333203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032343337203030303030206e200a30303030303032353734203030303030206e200a30303030303033303731203030303030206e200a30303030303033313936203030303030206e200a30303030303033333236203030303030206e200a30303030303033343539203030303030206e200a30303030303033353937203030303030206e200a30303030303033373231203030303030206e200a30303030303033383530203030303030206e200a30303030303033393832203030303030206e200a30303030303034313138203030303030206e200a30303030303034323436203030303030206e200a30303030303034333733203030303030206e200a30303030303034353032203030303030206e200a30303030303034363335203030303030206e200a30303030303034373337203030303030206e200a30303030303035303833203030303030206e200a30303030303035313639203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c38384442364244383433423136414131443134343733393137314338323345433e203c38384442364244383433423136414131443134343733393137314338323345433e205d0a3e3e0a7374617274787265660a353237330a2525454f46	Comprobante_000082.pdf	application/pdf
83	73	20.00	2026-01-08 22:38:50.300563	EFECTIVO	7	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313932340a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb6e134914ddfb2b6a9191068914f57e20cda2e3380894c45662100b361dbb03467e20db99d7d7cc3ff045b39cbf9853dd6dbb9d5401c1e9085a8e55e973dfe7de5b8c6a6359e387933f3a8cbcea9c0c3b2fce04e18e0c6f3b8251e3f77e24199e7718e542103c0dc7537043961f3bdc3aaa6ce3a8f38e58a729f7963963b8e2560aed0c198e3bbfbe797b39ccc8698f64afde6664d01f6627e7bd6764f8b9d31b6e655041066e28db13c1fa4a062103ba0e0f6f7410412888b07714a259a3a9d44a1be385e7523a2d6c29c27576f9261b641727d93d5cbc1fb08ccabd7779081e6055d05c291bb09928618508088d935c12ab39e5aec473c258cbbd17156c3eff9c7fc96737f973d2fd3499dd2c96f9df8be7a437bacbc78be5a1b24847a5687a417162a5a74e09abb5675a73ee98e3a52cc362fadfed62be78493efcaabdfcf08cc8e3f7efdf87ffef378230ea028a53e161c8d5ab0ea7a52b8593ca947655881d25e00a6f9c66d24b449683f72c0c8343ce71e7bc35d25abc65d6d15a506b98e4ca1b664408141d3f3bed5cff60304402523047214cc368d210084b01a2c446586dab68e8f62f0657fd93ec72d80b6139c85ef5ef87232b25e054278d6f3935ae81a89827f03d102bbb73ce8414482d005e2e280989e7e47d1cf80638829a3d9f87c429c31edae1a9359e12690adc98ed8d9214ee715b339b3af34eb361ff1a2a9e93eef9eb1ed4dd83e7df89b8889da3e8425283bcd884883375d275a79362be2e5e3e2acc23a0dee393d008efda930e964e8166f3f15fe40d19e4a3bc7c1caab1f0969a666439f32d958bf1dd343f586354182a91da8d9292c664dae09f47b56dc5bbcc23f0eb5a12629ad5b5adbb184f3e2e48763b994e50cc0ed6990b4bb7452b00692ed2e8b61dbfa6e042025f14e3098af6e1ce350e45a4e6c8e04ea1741a195543b4e157ed35054b54c165b4d45ad73563b22c46a3c962beafe84fc0c6f23609bba34a72bd4fd24fa5b0034923aa36e25830c386188b92185bd13785baa3b6562239897b5d8cd6f783f82740a5c217ba6162d04e1ab40b1e582e5ae13ead2c45cbb9fdce0ae8d2a03e729e91b3ac3b7c7bd54e54a16a09a5a46475e38bec2ef1cff2d1fa6e9913548ec34b2397744b0455d2f06f2043db6311ea273f46f5389815e2f195421f14cbc9e209e820468149d0a0ed31e7ad3818b667b66ce6c0be4ca105ae0ad65931fa9493de6cb27a8a5a1965bf2436732f187f01ad5b726e0ab7b75a3f05d5c78b470a74d0bb3c6dad7955de51cc20ce2ac6b5c54cabb7edcd7c75376b871492a0183b66fb23c253b93409395cacf329a9ab553bbd4d12fb4888e78cb5420be891a9733bcb6352ab4a45b77fd9ed0dc00df760cb1d88c70263efa75e81a0da000e460dd03e89a9741842cb39d70768cd6acc2a96c8b820d9c7bbfb23c937912336c6b261932316d5903329899261600f93b44791d4da2956336f0d7df2ef6a32c2ecdfcd9768da6f279f17841d734d665fc96fe44850c6b01618d5318ff1377c31fbfae1d9a1b24a41bd688cffc698b4b0479170782ca2c2fe435ab55b2e08049b426d41e66d7b04c759bd17babb599709104df7c7a3c7f54da13f5a5ffc7dc0329b672210118300dc862152af5a015ddc4dd7f9aa85f0930ee96aebfcc61a02fc5cd5eed7f37c3459ad8bf96892939c5c157773b065b122c7e47a32278b9b55b1fc1d47c27787ca25507a9aa677d85525053b12aca55893d84182bbcac80e7ccec262682fd62a371c1c6a517d53e0fbfa3edcf345c3a8a4e9bae55461d3082249acf4a267b72bbdefb1d8c3f55adcb45881007543a5c04776354dfb38b67e88aa85c652b9a11a436ca74023ecf5547a629b89cf3b1ae5587f97e9f42e439966bf7c7876b0a6a8c14a353455088624ee512459bec3d3b1e62024a3ab3311c05a29438433a054bfb58096e1c5a131c13dc1f96674bb9f2c8f0787f3288867a7b0b63a0dde626722b0ac05f3956bef90a8d8e5555dc2690f0a9ff7aa7ded839df413f5bb02d18c5f50b859a5b6810f76e30c3a9441fef1f0ae373ace24b15dc02de6c5b26c91c258f31c2dc84be9c817facf8cb66207ecdbacd9f20297de563dc845b1c6f81a37c4cf8cee8ad3bdfb13ccb469f0de59af3b7cfdae15cf736cdee0915d1b8ed253825e15a3c90d369be4cb13ec85b8e0e8bb77d18dc5b44f43bf296e8be56a3127d9b4f8339f8f8b25aec9f2e5684186088755637d0f1809145ce04098b2f189f521dc6a0a936ef724d81d04c2520a69d9e8371d2e876247a7388a0aa83141e17b8d87c46c1a3d1a25418e3ba1700f24c080dca006e043e2a4d9df6480643819c5a9151b108a00daae7f20950da246cf86a64072efa0aae25e59d472acc87039863f426249dc907a89f7e0a4a2b05b159458b30804284ec62c153b095963f68f1d9d7694c13da5650289809b495cc389c45ba3712b50b8d1c682acbc1086e3f2d0c60fc6ec348ae742ccfc90337634e653ec1c11ef225471c88d7957f07894fc608c8e3a9f3ab75b9ac1708ca4034bece51cf606483a4e0942dfe0aabeb91a0395711d6ec9b7e6441f21eb82d6bf1cf6039f64a7fd0734faad9bff120a6d0185f0db4b7d580ebe4b6145bbeafb77a93f38c470dcffc2705b6818babe2898a2560d8af9b8ba5dc4f4bac3fc1fb68e12840a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a7c852b2aa4ef00cb9a7d5d058ef9c73eff71f4134841b0e40a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383232333835342d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373230203030303030206e200a30303030303034353435203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313439203030303030206e200a30303030303032323836203030303030206e200a30303030303032373833203030303030206e200a30303030303032393038203030303030206e200a30303030303033303338203030303030206e200a30303030303033313731203030303030206e200a30303030303033333039203030303030206e200a30303030303033343333203030303030206e200a30303030303033353632203030303030206e200a30303030303033363934203030303030206e200a30303030303033383330203030303030206e200a30303030303033393538203030303030206e200a30303030303034303835203030303030206e200a30303030303034323134203030303030206e200a30303030303034333437203030303030206e200a30303030303034343439203030303030206e200a30303030303034373935203030303030206e200a30303030303034383831203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c36323838433439303732433738323736424545383430304635424530443133393e203c36323838433439303732433738323736424545383430304635424530443133393e205d0a3e3e0a7374617274787265660a343938350a2525454f46	Comprobante_000083.pdf	application/pdf
97	82	2.00	2026-01-14 21:45:39.357711	EFECTIVO	10	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
84	69	2.00	2026-01-08 23:38:58.620497	EFECTIVO	11	1	\n[PAGO PARCIAL SIN MULTAS] 1 multa(s) liberada(s) ($20.0000). Pendientes para próxima facturación.	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323235340a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55adb4e1bc9167df757d403470a47a152f74ba4f3d038262232d8026714e9701e1ad3241df9826c3873f99af987f9a2799ce7f98159d5dd6eb7a19a84d8464a0b9cb2d7debbd6be9b516d2c6bfc70f2738791f79de351e7cd8920dc91d16d47306afcc68f24a37e87512e04c1d3703c053764f1b9c3ada3ca368e3aef88759a726f9933862b6ea5d0ce90d14de7d5878fe7a384bceb91e4fdc7840c07a3e4b8df3b24a3af9ddea896410519b8a16c4304eb4b19840ce83a3cbcd14104a120c2c65188668da6522b6d8c179e4be9b4b0850897c9f98764989c1d278f70f1f98065546e7c9687e0015605cd95b2019b8902568880d038c925b19a53ee0a3c278cb5dc7b51c2a6b3afe95d3abd4e5f93ee977c7a3d5fa4bfcd5f93def821bd992fb695453a2a45f3161427567aea94b05a7ba635e78e395ec832ca267fddce67f3b7e4ea95f6f2ea90c8a34f9f3e857f9f568230ea028a53e161c8c5fb0ea7c5550a279529ecaac01d257015de38cda4976096c3ed591806879ce3ce796ba4b5f89469476b41ad61922b6f981181283a7e76d2b9fc4e3244082998a310a66134690884a500516225acb6251bba83b3e1c5e038391ff5022d87c9fbc1633ab242024e75abf12da7c6351015f304770fc4d2ee9c3321055c0b80e7734a82e339f5180777031c41cdc69d07c729680fedf0d41a4f0937056eccf646498aeb71b5994de579ef92d1e0122af649b77fda83ba1bf0fc1b8c8bd8398a2e2435f08b15459ca99cae3bc9b3d97df6f645348f807a8fdf8406bdab9b74b0742b68ba9866937c96926efa2b3c2f23dd6d9516de52d3249733cf699ddd3c4cd2ad954690a112dedd882aed98cc302da5d1c2ede5829907f7ab701268cdaaf0d69ddfe49fe724b9cd2739e2d9d63a7361691db70290e6a21d9db3fd5c6c1b5e70e2b3ec2647e0defe768d4320a9f264b84fa1743bb20411f671b1da6b8a4c51b2cb68a9b5aee246bec8c6e37c3edb54f4076063bedb0abb4e977bd1d6214b83532b592c52c32a33664566dc8bb26da8ebdcb6171ab7e25e66e3fbc70cfe0150a9f0826e981879a71db43f5f92613e9b2ff792ffb4b2146567fd9a1550a791fe483f21274977f4f162b3fcdb15b110b6845252b2aaf8857717f827e9f8fe619112448eed632397b4ce04a5d3f06790a1ed910801941fa1eed83a7ac429d6863ecc16f97c07f92096035b4183b6479cefe582617b668b820ee9972994c165c03ac9c65f52d29be6cb5dc4ca68fa6bc566ee0de36fa0b5d9cfe5b6e1f696f7bbc8f5f1f8d1063a4c2ebaa7497f1f97abbca3e8429c558c6b8bae56d7d5cd6cf930dd4f56680545e331957bb9d056c8d1fc3e9d902a56eda7b269c53e10e235dbace3769514502253e7d69647af56068aeee0bcdb1b22333c822da6201e238c8d9f6a0882580338183540fb564ca5431b5a74ba3e406b5661965c223719493e3f3c2e6f9e458ed818e386958758c442cea4244a86963df4d21e21526ba758997a57d0c77f2ef331ba7f3448a8d96ff3af73c28eb826d33fc87fc881a08c613030ae388f0638bc30fde3ea705b59a5a05e340600c69876610f22747829a2c204445ab51e2f08904d21b2c0f3ea0ac171564d861eaeef0b0788bafbcbd1e3fab6a1bf585fbc3f6099d5b38588e020006b1ac2f5ca21d0d9c3e43edd2cc276433fe9e0aeb6f26f0c22909dcbc87d3a4bc7f9f23e9b8df394a4e4227b982157664b72442ef319995f2fb3c5ff7124bcb6ad5c02a1a7697a876955ab600782ed896b68c4293257c1ec90cd59180d6d70adbc86ada916d5b70d7c53dfa793be288d8a245d159c2acc1a91485a867ad1b3f550ef5b59ece9802d6e5a4c4080ba4aa5c08777354dfbb26cfd14550b8db1724335066eb78146b2d7aef4c43c13bfafd328c700bc70a79f128469f6afabc3ad35450c56aaa1a902195a710f22cef28d3c1d2b0e8233baca1301ac953244388394ea6b0b68193e381426d814f4578ddb63677939382e8f22f1ac15d656b783efb1321118d722f31583efe0a818e59555c2bb1e14eef7ca89ed93a9f48eea5d0136e30f046e56aa6d7007eb660615ca30fdbc7dd51b6d665ab15dc0cd66d9a228914253f31ac67e2b1db9a3bf4fe95eec80699b35755ee0d2dbb20639cbeed1bcc60df1238dbbe2746383828eb61dbc77d2eb8e4e7fdacbcd73ccdd7023eb321ca1a700bdc8c6f935e69ae46e0783212e38eaee35bb35b68aedd01fb2db6cb19ccf4832c97e496737d9028bb274319e9311e8b04cc775ad0c180914ac70204c51f8c4ea106e358549eb2909260721612905b76cd49b0eeba1d8d1098e22026a7450785de321d199468f469320c756286c82043220378801f8a5e5a4d99c6320c970328ea756cc3f2808540f7f20950da246cf86a24072efa0aae25e59c4720cc8b01ec39be058123b522ff13938a928ec56921243160182e264cc52b193903566ffd8d14947196c2a2d137004ec26b188132d9f1ae5ad40e046198b64e585301ceb431b3f18b3d338ee0b31f343ced8d1d89d62e208be8b10c52137fa5dc1e32cf94e8e8e3b5f3ab7759a41730ca74396d8f039cc0de0749c1250df6059df1c8c2195711df6e4b5395147c82aa00dce4783904f9277832769f4b9dd7f01a53c62b66aacf5190777dab0620dcde365ea77f6301c0b60d8ad46869dab2dc104a16a98cd6ecaf5229ad7667102a1011152b02d33b0c36ebe118fc2cecce33fd9fa455c8828a204c6c8be1e3e59ae10d7624783eb41741c72303dc39e19c775f468d4471d44c2dbf03e852f4df85007b51cdc1c27e02a7c5b8c30f85e82592756eb30a56809111a0329a41c90c607f262488fd794c76a111c0fc9da3b818e1cb3d6c0b2fabdb08cb3e5acfdb1916207e17711cbc74ec2eda0a7b6814720127e53068b93c8c9f8120bad4c080f163a4018281b3d1733503c36c4ac1e0f0db18b842e4633f8377487ab307c3125ca8cefe5652332c8e75b445c46f0288c9c30bcd1c5902a16272ce20a6b5c20a603855f0d9aadf85b52f8d3e8dfe4d57f43258af0514c60c9e5e93939fbd81f2597ff239c4c43237bf56a896f934cf2eb6c91de547f5d857e132324c6ae0ee9da5997e42ec542e46ef1f72ff93425b7e5d0719cff3d5bd578ff00c4e1e5a20a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a7c852b2aa4ef0071cd6d5d2a1cf38f7dfee3e8274829b0e20a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383233333930352d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303033303530203030303030206e200a30303030303034383735203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032343739203030303030206e200a30303030303032363136203030303030206e200a30303030303033313133203030303030206e200a30303030303033323338203030303030206e200a30303030303033333638203030303030206e200a30303030303033353031203030303030206e200a30303030303033363339203030303030206e200a30303030303033373633203030303030206e200a30303030303033383932203030303030206e200a30303030303034303234203030303030206e200a30303030303034313630203030303030206e200a30303030303034323838203030303030206e200a30303030303034343135203030303030206e200a30303030303034353434203030303030206e200a30303030303034363737203030303030206e200a30303030303034373739203030303030206e200a30303030303035313235203030303030206e200a30303030303035323131203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c36423233463430393236393032394337363230323534463130324232333435363e203c36423233463430393236393032394337363230323534463130324232333435363e205d0a3e3e0a7374617274787265660a353331350a2525454f46	Comprobante_000084.pdf	application/pdf
85	69	20.00	2026-01-08 23:39:25.276329	EFECTIVO	11	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313933390a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb5594b6edbc8169d6b1535f0033a405ca9ff27c01bd0b21c24902dc3561a196442cb74c2401203497eafbb57d37be815f5b077d1a7488aa2ec621247a680108a50e6b99f73bfc5a83696b53e9cfc7fc0c89bc1c974f0ea4c10eec8f46e2018357eef23c9743c60940b41f0341c4fc10d597d1a70eba8b2ada3ce3b629da6dc5be68ce18a5b29b433647a3bf8e5ddfb8b69424e472479f33e2197936972321ebd20d32f83d1b491410519b8a16c4f04eb2b19840ce83a3cbcd14104a120c2de5188668da6522b6d8c179e4be9b4b0a508d7c9c5bbe432393f491ee0e2fd806554eebdcb43f000ab82e64ad980cd44092b4440689de49258cd2977259e13c65aeebda860d3e597f46bbab8495f92e1e77c7153acd23f8a976434bb4f6f8bd5a1b24847a5687b417162a5a74e09abb5675a73ee98e3a52cd36cfecf5db12c5e938fbf682f3fbe20f2f8c3870fe1df87ad208cba80e254781872f566c069e94ae1a432a55d15b8a3045ce18dd34c7a09663978cfc23038e41c77ce5b23adc55b1603ad05b58649aebc614604a2e8f8d9f9e0fa07c91021a4608e429896d1a4211096024489adb0da566c184ece2faf2627c9c57414687999bc993ca4232b25e054771adf726a5c0b51314fe07b205676e79c0929105a00bc28280981e7f4431cf80638829a3d9f87c029690fedf0d41a4f8930056eccf646490af7b8c6cca68ebcd3643ab9868a63321cbf1d41dd3d78fe1dc645ec1c4517921ac4c59622ced441379ce7d97293bd7e12cd23a0dee39bd0a077ed49074b7782a6ab4536cf972919a6bf23f232323c5469e12d356d7239f32dadb3dbfb797ab0d248325422ba5b59a51b9319a6a5345ab85e1ccc3cb85fa793406b56a7b761719b7f2a487297cf73e4b38375e6c2d2266f0520cd45373a67fd38b60b2f04f179769b23711fee5de39048ea3a19fc2994ee469620421f8ed55e53548a8a5d464bad759d37f255369be5c5725fd19f808dc56e27ecae5cf6a2ad439506a7b6b25894866d65cccacad88bb25da8bbdad60b8d3b71afb3d9e621837f02542afca05b2646dde9061d176b72992f8b752ff54f2b4bd17636bf5901755ae58f8c1372960ca7efaff6dbbfe72216d296504a4a5637bf88ee12ff2c9d6dee572941e6383c3772499b4a50050dff0632b43d162181f263f41d07678f38c5bad02fb3555e3c433d88d5c04ed0a0ed31e7bd3818b667b66ce8507e99421b5c25acb36cf63925a345be7e8e5c192d7f9dd8ccbd62fc15b436fd38b70b77b4de3cb9d6c35380034600f5dde9a30b131d7a72da4bec2aef2866106715e3da62a6d54d6fb35cdf2ffaa9099da0183b16b2177776424e8b4d3a2775a6eaa7afe9c43e12e225dbefe29eab24a041a6ceed2c8f49ad4a13c3c9c5707489baf000b6dc81782c30f63ef50ae4317fa3984a8721b49c737d80d6acc6acb8446e33927cba7fd8dc7c133962632c1bb601629109399392281906f630497b2448ad9d6255e1dd429ffcbdce6798fd311ea163bfcbbf14841d734d167f91ff92234119c35a6056731ee36ff861f1d7c71787ca2a05f5a235fe1b63ba853d8ad0e1a9880afb0f69d56eb920403685c482c86bfa03c759bd17babfd99401100df7a7a3c7f5ed427fb2bef8fb8065b6cf0e228283006c6888d0ab5640e7f7f34dbadf823d0ffda443b8da3abeb186406dae12f7db653acbd79b6c39cb539292abec7e894a99adc931b9ce97a4b85967abffe148f8ed50b904524fdbf40ebbaa4ec18e04eb896b18c3290a57c9ec50cb59580ced71ad72c3c1548beadb05beafefe33d5f9446658daedb4d15368d28241d2bbde8d966a5f7bd2af678bd16372df61f40dd9652e023badaa67d5ab57e8caa85c652b9a51a03b7bb4023d5ebb9f4c43613df77659463fd5d86d3af09d234fbcfc717076b8a1cac544b53053274e21e4582e53b753ad61c846074752402582b6588700625d53716d032bc383426b827186fc7b687c1f27470388fa2f0ec14d6567783f7d899082c6b51f9cab57708542cf2aa2ee1740485c7a36a5ffb6827fd4cfdae009bf11f246e56a96de083dd28830ee532fd7478d71b1d653ab15dc0cd96d9aa6c91c248f312c67e8d76eb2bfd73417bb103766dd63475814b6fab1ee43cdb60748d1be267c676c5e9defd09e6d96ef0d1d968387dfb6b2f9ee7d8bac123bb361ca9a704bdca66f90db69ae4eb33ac85b8e0e8bb77ecd6b853ec867e97dd65ab75b124c93cfb2d5dde662b5c93a5ab5941a6a0c33a9d35bd3260245070810361cac627d68770ab294cdaec48b03708054b298465abdf74b81c8a1d9de32832a0c60485df351e128369f468b40872dc09857b20810ac80d7200be749c34fb5b0c14194e66f1d28aed0705819ad50fa4b241d4e8d9d01448ee1d5455dc2b8b5c8ef5182ec7f047082c891b522ff11e9c541476ab4889158b0041713266a9d849c81ab37fece87ca00cee292d130804dc4ce21a4e74bc35ca5b81c48d3616c5ca0b61382e0f6dfc60cc4eb3782cc4cc0f396347633ec5be117c17218b436eccbb82c759f2831c9d0d3e0fee9a3283e11841872ab11773d81b20e83825a0bec1557d7b2d8652c675b8256fcc893e42d6096d72319d847a929c4e1e95d16fddfc9750680b28846f2ef56139f8ae0b2bda553fbc4bfdb1619ae3fa17766b9061e766b38986a0522821e12a778cc279debaddfc17505413fc0a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a7c852b2aa4ef0071cd6dcd08c7fc639fff38fa09481eb0e10a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303130383233333933312d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373335203030303030206e200a30303030303034353630203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313634203030303030206e200a30303030303032333031203030303030206e200a30303030303032373938203030303030206e200a30303030303032393233203030303030206e200a30303030303033303533203030303030206e200a30303030303033313836203030303030206e200a30303030303033333234203030303030206e200a30303030303033343438203030303030206e200a30303030303033353737203030303030206e200a30303030303033373039203030303030206e200a30303030303033383435203030303030206e200a30303030303033393733203030303030206e200a30303030303034313030203030303030206e200a30303030303034323239203030303030206e200a30303030303034333632203030303030206e200a30303030303034343634203030303030206e200a30303030303034383130203030303030206e200a30303030303034383936203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c42393434324341424335443130424238393836324541323944303343343845433e203c42393434324341424335443130424238393836324541323944303343343845433e205d0a3e3e0a7374617274787265660a353030300a2525454f46	Comprobante_000085.pdf	application/pdf
86	111	53.50	2026-01-10 12:03:33.259978	EFECTIVO	18	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313936320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789ccd5ac96e134918befb29ea90910629296a5f90e6d031260225b1959811072e1da7138cbc20db9985a79977e089e6386f315f75b7edb6530504dba309a205ad8abf7ff9feb5cca83696357e38f9bdc5c859ebb4df7afe4a10ee48ffae2518357ee34792fe798b512e04c1d3703c05376476dfe2d651651b479d77c43a4db9b7cc19c315b752686748ffb6f5f39bb797fd8cbcec90ecec6d467add7e767ade7946fa1f5b9dfe4a061564e086b20d11acaf641032a0ebf0f04607118482081b47219a359a4aadb4315e782ea5d3c296225c67976fb25e76719a6de1e2f301cba8dcf82c0fc103ac0a9a2b6503361325ac1001a171924b6235a7dc95784e186bb9f7a282cd271ff34ff9f8263f26ed0fc3f1cd74967f9e1e93cee021bf9dce7695453a2a45d30b8a132b3d754a58ad3dd39a73c71c2f65e917a37feea693e90bf2fe67ede5fb67449ebc7bf72efc7db714845117509c0a0f43aece5a9c96ae144e2a53da55813b4ac015de38cda497609683f72c0c8343ce71e7bc35d25a7ccab8a5b5a0d630c99537cc8840141d3f3b6a5d7f2719228414cc5108d3309a3404c2528028b11456db8a0dedee45efaa7b9a5df63b8196bdecacbb4d47564ac0a94e1adf726a5c0351314fe07b205676e79c0929105a00bc9c521202cf996d1cf80638829a0d9f87c029690fedf0d41a4f8930056eccf646490af7b895994d1d792fb37ef71a2a9e93f6f9eb0ed4dd80e7df605cc4ce517421a9415c2c29e24c1d74edd1b0982c8a174fa27904d47bfc4b68d0bbf6a483a553a06f8ac99f241b157fe493db594ecef2df86a37c527cde5573e12d354d8639f335d58bdb8751beb3e6c8345422c41ba9258dc90cd3f89ff19b24db9797994700d43925709bd539ae3dbd1dde4f4976371c0d91d476d6990b4b57c92b00692ed2e87c6765e38e4de18548be286e87c8debb7bd7386493ba58067f0aa5d3c8481ff2108ed55e53948b8a5d464bad759d3c86b36230184e279b8afe006c2c8093b0eb9a79106d1d4a3538b594c5a23e2ccb635196c783289b425d17b883d038897b5d0c16db0cfe0150a9f042374c8ce293066da31acca607a9805a598aeaba7a670574691440729e915759bbfff66ab301dc17ab90b3845252b2bafd456897f8aff2c1e20165086963f7c4c8255d95812a62f85790a1ed8960c2307e828e5f1f865f29f45e311b4ef7500c620530091ab43d61fc200e86ed992d5b3ad45ea64295adcc5c0c3ee4a4331ecef79128a3b52f89cdd973c69f07ad0fe3dc146e67bed847a18f278f14682fbb6abfcece0fe15ce51dc51ce2ac429c58ccb57ad5da4ce60fe3c394842428468ff1ce853eead024647fbac847a4ce5587696b92d8475a1f6b7690a280fe983ab7b63ca6b52a51b4bb97ed4e0f95610bb6dc83782c31367eea3508720de060d400ed93984a8741b49c757d80d6acc6acb8446e0b92dd3f6cf7365f458ed8180b87658458e442cea4244a86a13d4cd31e29526ba7585d776be8d3bfe7c301e6ff763e43c37e37fc3825ec846b32fe427e2147823286d5c0a0e63c46e0f062fce5fdb35d6595827ad158011863d2c21e8963b64d87a7222aec40a455eb058300d914320b226fd52138ceeaddd0c3cda20c8068b83f1d3dae6f0afdc9fae2f70396593e1344040701b8a22142af5a035d3c8c16f9fc00f4930ee16aebf8c62a02d5b9cadc17c3c97d3e2727e47a3821d39b7931fb2d0f6345b1b3140289a6696887ed54528c232eb713cd9e14c72608edc97a9925916b03e2eb09f49c2f8ac96098939c5c150f9352edffcc1429c18e04db26dd9e4c6142d268bc66f8bdff85295282454cb1a77c83ba47117b2b4469059689cd7c5385e2cee926aa6f0afc4837a3e0f1be379a4af8e65613ab4f9e5aed46cfae56bbdfea641eaf59e3a66538655773900236ecd330edd33ab6c7a85a685c2e345463e0760a34d2c1ec494fe10c5a0dbf7aab65688c4238fd9aa154b39fde3fdb5953d461a51a9a2a9021897b1409966ff46ab10631a46857e767006ba50c1126b1d6ece3bee87c39bc6f07cbd3c1c16e8ae663adb0b63a0d7ec0ee5488c49ae465070a9f77aabdfda3bb893dcd3c8271740fa111a94a257c5225886aa04597dacbef779f7ca2036d121ba30f808b49312bfbe430d91e132e5e20fa3ed1bfc6f41086e02ebe39ba28165860c40df123cb1bc5e9c63d1ab61a49ecceab4ebbfffad783389e5b5406be2e0cb8c0ac0694ab6230bcc15e9b7cdac3629083dccbaea36cf071b59c867e53dc15b3f974b2bcb72966b82dcd678329e9830cf37cb01a97002381827b3c0853f6beb13684ebad258202eb50b094425836660e874bc2e8d911ce3a8a533e247c8d07b27fe26cb40ce23fa0b8c47b86b68be157906e132755b89eaf6a0a765ae8d43d19c48b2b3e06d1b41eac35966241d6e859a6d1ff2b279061c2f4cf3406aca0158358882cc8865b6054339cc4e8a796c9189748d00e2763b68a9d84ac3117c48e8e5acae0c6da32010570478d0b5991f8d4287599a12891cce2a5f5b24c9ef183313b0de2e110333fe48c1e8df8147b67505e58505d60a16540fc044dbe97a783d687d6ddaad4a04b45e449dafcb245f8ba45883c4e09f86ff0b58de68214e5accebaebb7757ebde85ef6bba1a4642fbb8f2ae9d7be045222a133087e5a7dbf831b0be725a036fbccc4adfa778eb25e52f8a6744f40d7f853df148d90ae7ac5e4b6ba67c60e63dd9efc0b097788c50a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8fc934879d922c9a6ab762e30b59560023b36a6060af4343d6a39fd819da0019a68f11612c1eff15194954c985db46aa9b5297c4b989d214417a9f0e9266e60112f284d0cd1dc14a946ad2d2595ce5d6a05f392a919fe7d20d506fbc48ab9a9ba937bb32ad698fe5dbb4b9f9314cd2285c88990a5128b3fd7b9b0c61ce2c5b99a5155337bbef3fb21adae091c86dbd4a2e4d111183ec6a4ba04a06aa10519e6bb445c73d17236545cc04c22948b58aa1518b6e9cdf534ef47d8f61d7c18effb7c780bc37dba1a5ec9566c91c54574e831df7fb077537f38f527705be09e512fd9de7ec323e7e056698bc6f283cedc7240cea74aec58282c9d77694dc27ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb74f5379b131a98f8d496130c68cb82c8819d5e2d331ff3276d31ffa1cd0b0b106c215ad18b9be03e235ca3afa1ef38f7dfe63e927f275b0fc0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131303132303333392d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373536203030303030206e200a30303030303034353831203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313837203030303030206e200a30303030303032333234203030303030206e200a30303030303032383139203030303030206e200a30303030303032393434203030303030206e200a30303030303033303734203030303030206e200a30303030303033323037203030303030206e200a30303030303033333435203030303030206e200a30303030303033343639203030303030206e200a30303030303033353938203030303030206e200a30303030303033373330203030303030206e200a30303030303033383636203030303030206e200a30303030303033393934203030303030206e200a30303030303034313231203030303030206e200a30303030303034323530203030303030206e200a30303030303034333833203030303030206e200a30303030303034343835203030303030206e200a30303030303034383331203030303030206e200a30303030303034393137203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c37313043454544383543384136394236443132413835423843343342314344323e203c37313043454544383543384136394236443132413835423843343342314344323e205d0a3e3e0a7374617274787265660a353032310a2525454f46	Comprobante_000086.pdf	application/pdf
87	111	2.00	2026-01-10 12:04:18.496759	EFECTIVO	18	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313936320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789ccd5a496e1b4916ddf314b1500365400ac73c18e8458aa2051b92284874c10b6f52544aa6c1c120a9eaee3a4ddfa14ed4cbbe45bdc84c92492ac2b64c66a164386127427c7f787f0c32aa8d658d1f4efed561e4bc733ae8bc7e2b087764f0d0118c1abff523c9e0a2c3281782e069389e821b327fec70eba8b28da3ce3b629da6dc5be68ce18a5b29b4336470dff9e5fd87ab4146ce7a243bff9091ebfe203bbde8bd22832f9dde602d830a327043d99608d657320819d0757878a38308424184ada310cd1a4da556da182f3c97d269614b116eb3abf7d97576799aede0e2f301cba8dcfa2c0fc103ac0a9a2b6503361325ac1001a171924b6235a7dc95784e186bb9f7a282cda75ff2aff9e42e3f26ddcfa3c9dd6c9eff3e3b26bde1537e3f9bef2b8b74548aa6171427567aea94b05a7ba635e78e395eca3228c6ff7f984d676fc8a75fb4979f5e1179f2f1e3c7f0f7e34a10465d40712a3c0cb939ef705aba5238a94c695705ee28015778e334935e82590edeb3300c0e39c79df3d6486bf129938ed6825ac32457de3023025174fcecb873fb83648810523047214cc368d210084b01a2c44a586d2b3674fb97d737fdd3ec6ad00bb4bccecefbbb7464a5049ceaa4f12da7c6351015f304be07626577ce999002a105c0ab192521f09cddc5816f8023a8d9f279089c92f6d00e4fadf1940853e0c66c6f94a4708f5b9bd9d49177960dfab750f182742fdef5a0ee163cff0ee322768ea20b490de262451167eaa0eb8e47c57459bc7911cd23a0dee35f4283deb5271d2c9d027d5f4cff43b271f1ef7c7a3fcfc979fedb689c4f8bdff7d55c784b4d9361ce7c4bf5e2fe699cefad39320d9508f1466a496332c334fe67bc69c5cbcc2300ea9c12b8cdea1cd79ddd8f1e67247b188d47486a7bebcc85a5ebe4158034176974beb7b271c7a6f042245f16f72364effdbd6b1cb2495d2c833f85d26964a40fd98663b5d714e5a26297d1526b5d278fd1bc180e47b3e9b6a23f011b0be024eca666b6a2ad43a906a756b258d48755792ccaf2d88ab229d44d816b85c649dcdb62b8dc65f04f804a8517ba6162149f346817d5603e6ba5026a65291acff53b2ba04ba300928b8cbccdba830f37db0de0a158859c25949292d5ed2f42bbc47f9b0f974f2843481bfb27462ee9ba0c5411c3bf810c6d4f041386f11374fcba1d7ea5d0af8bf968768062102b8049d0a0ed09e3ad3818b667b66ce9507b990a55b6327331fc9c93de64b43844a28cd6be243667af197f1db46ec7b929dcde62f9e2420f4f010e1801d4a773470a133d7a76d64aec2aef28a6106715a2c462aad5ebc666ba789ab4531092a0183c267b97f9a83b939083d9321f933a53b5d3d424b18fb43ed6ac959280ee983ab7b13c66b52a4d74fb57ddde35eac20e6cb905f158616cfdd44b90e7fc8d622a1dc6d072d2f5015ab31ab3e212b92f48f6f8b4dbd97c13396263ac1b5601629109399392281946f6304b7b2448ad9d6275d5ada14fffb7180d31fd77f339daf587d1971961275c93c91fe49fe44850c6b01818d69cc7001c5e4cfef8f46a5f59a5a05e341600c698b4b047e298edd2e1a5880a1b1069d566bd20403685c482c85bf7078eb37a33f474b72c03201aee2f478feb9b427fb1bef8fd806556cf0411c14100ae6988d0ab9640974fe365be68817ed2215c6d1ddf5844a0365789fb72347dcc17e484dc8ea66476b728e6bfe561a828f6964220d1340dedb09b4a8a71c4e56ea23990e2d803a139d9acb224726d407c37859e8b65311d8e7292939be2695aaafd97992225d89160bba43b90294c481a8dd70cbff7b730454ab088290e946f50f728626f8d28adc02ab1996faa50dc3bdd44f54d811fe966143cdff6465309dfde6962f1c9538bdde8d9f562f77b9dccf3256bdcb40ca7ec7a0a52c0867d1aa67d59c7f61c550b8dab85866a0cdc4e81463a9803e9299c41abe1d76fb50c8d5108a75f33946af68f4faff6d6147558a986a60a6448e21e4582e53bbd5aac410c29dad5f919c05a294384492c3507b82dba588deebbc1f27270b09ba2f9d828acad4e83b7d89d0a9158929cf5a0f045afdada3fbb9938d0cc231847f7101a91aa54c2275582a8c65974a9d7f9e3fe934f749c4d6263f40170312de6659f1ce6da63c2c51bb4865fe97f27b40d437017df1b5d164bac2fe286f899d58de274eb160d3b8d2476ef6daf3b78f76b2b8ee71695816f0a03ae2fab01e5a6188eeeb0d5265f0fb016e420f7aaeb281b7c5c2ca7a1df170fc57c319bae6e6d8a39ee4af3f970460620c3221faec725c048a0e0160fc294bd6fac0de17a6787a0c03a142ca510968d99c3e18a307a768cb38ee2940f095fe381ec9f381b2d83f80f282ef19ea1ed62f815a4dbc449152ee7ab9a828d163a754f86f1e28a8f41346d066b8d955890357a9669f4ffca09649830fd338d280a5a318885c8826cb8034635c3498c7e6a958c718504ed703266abd849c81a7341ece8b8a30ceeab2d13500037d4b88e15894f8d5297198a12c92c5e5a2fcbe4193f18b3d3301e0e31f343cee8d1884fb17506e58505d505f65906c44fd0e447793aec7cee3cac4b0dba54449ea4cdaf5a842f5b84c8e39480ff065fda68ae4751ceeaacbb795be7d7cbfed5a01f4a4a76d67f5649bff5159012497949bd6a7cbb8371902701151b6b77afd47f6ca3025478a6744ec0d6f8b35e6fa323a8d4c948b8d1bf40e5bc6c5c72ff09562b88a30a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8fc934879d922c9a6ab762e30b59560023b36a6060af4343d6a39fd819da0019a68c185f4c0eff15194954c985db46aa9b5297c4b989d218a2ea5c2a79bb881a57841696288e6a64835b4b6482a9dbbd40ae6255333fcfb40aa0df6891573537527f76655ac31fd5bbb4b9f9314cd2285c88990a5128b3fd7b9b0c61ce2c5b99a5155337bbef3fb21adae091c86dbd442f2e8080c1f63525d0250b5a80519e6bb445c73d17236545cc04c22948b58aa1518b6e9cdf534ef47d8f61d7c18effb7c780bc37dba1a5ec9566c91c54574e831df7fb077537f38f527705be09e512fd9de7ec323e7e056694b8de5079db9e5809c4f95d8b150583aefd29a84fda05f7d3d75d81cf6c7f9f0650c386cfa7c9a6ea7cd08e1e838de1d60eee36efa3e6e9fa6f26263521f1b93c2608c1971591033aac5a763fe65eca63ff439a061630d842b5a31727d07c46bd475888ef9c73effb1f413f215b0f50a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131303132303432322d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373536203030303030206e200a30303030303034353831203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313837203030303030206e200a30303030303032333234203030303030206e200a30303030303032383139203030303030206e200a30303030303032393434203030303030206e200a30303030303033303734203030303030206e200a30303030303033323037203030303030206e200a30303030303033333435203030303030206e200a30303030303033343639203030303030206e200a30303030303033353938203030303030206e200a30303030303033373330203030303030206e200a30303030303033383636203030303030206e200a30303030303033393934203030303030206e200a30303030303034313231203030303030206e200a30303030303034323530203030303030206e200a30303030303034333833203030303030206e200a30303030303034343835203030303030206e200a30303030303034383331203030303030206e200a30303030303034393137203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c45423343323035383234343843373742434445394238443338413542454637383e203c45423343323035383234343843373742434445394238443338413542454637383e205d0a3e3e0a7374617274787265660a353032310a2525454f46	Comprobante_000087.pdf	application/pdf
88	74	2.00	2026-01-11 12:11:46.54374	EFECTIVO	1	1		\N	\N	t	REGISTRADO	\N	\N	application/pdf
96	68	2.00	2026-01-14 21:45:39.319931	EFECTIVO	10	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323332300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55a4b6e1b4912ddf31409b41733032b9dff8f76658912dc9044c1a207de9629ca2e8314058a9e01fa347387b94ddfc0ebdef5aa5f56b1c82215298b6653e82624325c2f32fef192825be745e747b2fff6043befbd1df6de9c2926031bdef594e02e6efc6836bce8092e9562787512af4a3a36ffdc933e70e33ba22106e683e5327a119c93467aad6c706c78dbfbc7af1fae86053bedb3e2fc43c1ae07c3e2ed45ff9f6cf8b5d71fae74304907e9b8d850c1c74607a513ba4d2fd1d9a4823250614314aa7967b9b6c63a1755945a07ab7cadc24d71f56b715d5cbe2db670f17cc00aae379e15a1788235e9e4c6f8842d540dab5442e8484acdbc955c861a2f28e7bd8c5135b0e5fdd7f2a19c7e2a5fb3932fd5f4d36c5efe367bcdfaa36fe5ed6cbeaf2e4672d595c4c999d79107a3bcb551582b651041d6ba0cc793ef77b3fbd931b3f0ac3efaf8f163faff63ab84e0212104935e1c7b7fde93bc76a30adab8daa606716314dc105db042478da80af09c87512014820c217aa7bdc753a63d6b15f74e6869a2134ea520817e94eca477b30a041c1756085c6f182185522e18ade6d2760d868340590e10a35a65ad6f22e1647079fd7ef0b6b81af653485e17e70376f9fbc5f0ddf5564c4a2645ad8ae436eb012f398ed5f180d20c0100e8c6f8520aa515f20bc85733ce52f645b793dfa9d0b7dcfa8eb046063be738d2aef58c4bffd5b08a9d1527c30fef8b9b74d8e2b4b8d94e3dc407f015771bf8adc59395f16a2d5e131014a062c06905e738a584f1ca1811bc87d9807f5a0c073730f5052bcede5dbc2b4e075b667efef884c34978e88f40c55f3e7823a40d16e52bf97b528def17e3e39d6c4e80c688df948dab900af119d0723e29d9fb6af6b8ef5955f4dc755321b8e70efbfdf6dba4dcfbac28705ceb65056d2a5a1e13212ef10c44e121fc0a8373203431158d41d968cad9c91fb7d5e7192beeaa49855abaf799a5f27c553353da5aa9f2e8f1207ecdc2a5d27139beadd033f677ae0b285fcb169d6a3bca491e19fd4e1dc4af4173fcd1c205e94c332c9c56f3f16854fd71bf79d09f80a532360b5ba0472f6607a98c981678546d13c46fc236d3c1697f585c5cd46d2857a253f95f57ff1a018e6a3b27da8d7798702c0601b873ddf2a3d0a9ff1a8f712a75a0a62c4b03f390b213f46a40412a20d9059a27e41115942cd9d5ad0e3cf8a8351e6065503abaaca4e5de3445c5e10f941836a24705abd0c3d12e57d6c447b5aaa42c66211f9c92210aafb4c0a96bcb4300ee4746c7a002ea16c31f5060f944d432a89c242953519223da0394e8a487462dac471d457dd4f8cda02793a264dce048019a58174c34da68b4f88c206127e8498912d6879aa424e1519cc7598107c000427a81a19b0e921747e9a8f7a577d7e65bbd87442c111b3ff51a2239fbdcc398bdf21052580a0dcf69c161c615147698a62ffdb295cc3f7ab84f636fa72c266b671f7e568e16dfe6e58e107838df18a8d164f318d7e37935bbddae493fc240c9e39d9a278cc2349c3f0767fd69f58872bb2b0c0ae9f210cd9ce052c2e7604e66f78fdfa6bb1e451b5474244d68731d65300b7189d56ac7e71b0cea42d5c34c0d22a24e719f0118ce16e5645d97b1f0ae5f72959f4a4c8b1ea6ccb215a03d79e7353b9250a59dac6a6510daf3719b1af2b9b390cd8f4c15a971b47a25a93f80ef9ae627b75aedae6064eae4c052ab3b5269be9247898bd8139bcea91c78c23d92fb62d23996c314fe8d906f80bcb9f7fd042c9973595836fdff9e806402e6f08ef604ab9345b60dc362bfc04895457ba55e0bb12f229123382617d86557f18419bd899c03e448166c9d23ea6039923f699d23fb9e97cc912ce66173240f7b981cc9e21d2447b2681b39f294dea33a96f19ac366ebee24417765983c5276c5e4fd68617b4aa661c2e4c1ae0d89891da6c45e024a79dd8f0dfcd9502cf78beab6bc65b76376d74c638fbbad8c4f35485b404019581d1314475681cd04f9e1b248850e79601538de58a7ab4a0f4ef30778f38b663f1c6c9300bb635b651349b93e2ad88e2cf42bb35d6cffaedd18fc12de6c3943ace4c63564e972376e88c344d21e8284d0b82e40a1a853292d25022a34f5773cfa52a6c8ba2e3f6f514b3f014d524b596c6932a5f0ef39329a1e5cdea66cd018399bf9f9fb02cb067de69fa1d3a8969305ef9ff54f86effebd723246f0143e188c6bee23d3abb502f16f563d064f464f4db48741e0758a64d08e96059780451552d16323b678016f9091254ba09611265136b10dc6c3beca62cfa5250d3265150422a6ca9de13d54c0559c6e1701694254e98a8496f5168496b658b0add70624814c9b361219064010695c89e12a00971fca13043d692b5212ba122e2045412838ae95c76ea515aea270f7a2324fa542146c017a950a129f803390881a34264a90b213cd7b90e6a7890fd2a7680c086ce5d105f02e4ab592993079699c6e101fa80729bf34efdea9a65bd535f5e1703bdb65e461bc8643ee147105adea5c1e5c0d07acdb30b68bf77337becd6e1c41949ace652ee89e3ce04683c0bfc7529c0abf6fea3ec10521d3c0ccadcb0388bb7acea068385236c35892b274e238780a84203e042da7a5742127697d5d2396450bf39757d9d405bf863c5a116c8880984ddd746386f9c3e1b0a9eea0f561e1a1284bb0873c4d96b897011fe78547c0d3942529495396a4284d5992a26446e2485e7b58c906e925a214b71ab42061273a7549f3d3a94bfa94e22cc93079719c7652573f3fc2c32ba9258a4413091beb46462532ea25d2acbd9340116e46ccc1a7c7f1fc3fe5a89add8f1f8fd9927464bf6c5328c7ec95027d5427e0f05fac6527bb82cd1ed915acdb2cbe048275a0b561c33f39dcf253db2aa8db27dcf11497d148f6a5dab5ede02752346d06cdc5e2ea621c65141fd0cf6d569dd5fda30359e7b3cf7dc93af574dc4737e2f8cac45a1ddc0ee1fb075dce0ef53125403d1356f3699a0927eca4fc3a9e6f92993b63030296e8d80dfdf045d8cd75f61638beda70d743cfdf1cc597df9d8195818bad30bd623eaf9773ac8cddef2dc0c16842b86fe8bc19fcf2cb33fdc7c5988d66d387f9ec13b62efc3e9e2faabb6a543268f48071914dff9c2caa87c9189c6539a97ec385ecbe1ae2fa0161d5b124d62e780983f43a2a6d5cde419f8fefc77380267d303f37e3f36b168f8d3d36863df0ff4df952a1bf0007f9d5780a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131343231343534342d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353435203030303030206e200a30303030303034333632203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032363032203030303030206e200a30303030303032373237203030303030206e200a30303030303032383537203030303030206e200a30303030303032393930203030303030206e200a30303030303033313237203030303030206e200a30303030303033323530203030303030206e200a30303030303033333739203030303030206e200a30303030303033353131203030303030206e200a30303030303033363437203030303030206e200a30303030303033373735203030303030206e200a30303030303033393032203030303030206e200a30303030303034303331203030303030206e200a30303030303034313634203030303030206e200a30303030303034323636203030303030206e200a30303030303034363130203030303030206e200a30303030303034363936203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c41354437424342354434363133323842443634374235373632414435323136313e203c41354437424342354434363133323842443634374235373632414435323136313e205d0a3e3e0a7374617274787265660a343830300a2525454f46	Comprobante_Multiple_000096.pdf	application/pdf
89	72	2.00	2026-01-11 12:26:36.129834	EFECTIVO	12	1		Anulación solicitada por cliente	2026-01-11 12:28:23.207333-05	f	ANULADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313831330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a919112092af57e449a45630c4a6430022762c1a6310d71e447c660cd4cbe66fe215f34cbf98b39d5ed47db549110d396d28a5a459ffb3ef7de62541bcb6a3f4efe6c3172dc3ae8b7de1e09c21de9dfb604a3c66ffc24e9775b8c7221089e86e329b821b3bb16b78e2a5b3beabc23d669cabd65ce18aeb895423b43fa37add71f3e9ef63372d821d9f1c78c9cf5fad941b7f386f4bfb43afd950c2ac8c00d651b22585fc9206440d7e1e18d0e22080511368e42346b34955a6963bcf05c4aa7852d45b8c84e3f6467d9c941b6858bef039651b9f12d0fc103ac0a9a2b6503361325ac1001a176924b6235a7dc95784e186bb9f7a282cd275ff2aff9f83adf23edcfc3f1f574967f9bee91ce609edf4c67bbca221d95a2ee05c589959e3a25acd69e69cdb9638e97b2f48bd17fb7d3c9f41db97aadbdbc7a43e4fee5e565f877b914845117509c0a0f43ce8f5b9c96ae144e2a53da55217694802bbc719a492f11590edeb3300c0e39c79df3d6486bf195714b6b41ad61922b6f9811215074fceca875f193c1100948c11c853035a34943202c0588124b61b5ada2a1dd3b393bef1d64a7fd4e08cbb3ecb8b71d8eac9480539d34bee5d4b81aa2629ec0f740acecce39135220b500783aa524249ef3db38f00d7004351b3e0f8953863db4c3536b3c25d214b831db1b2529dce35666368bcc3bccfabd0ba8d825edeefb0ed4dd80e73f88b8889da3e8425283bc588688338ba46b8f86c5e4a178f7ac308f807a8fff098df05e78d2c1d229d0c36171372527f9ec613829beedaaaff0969a7a5c39f394c2c5cd7c94efac2fea0b9548ec5a41496322cca4544a6bd3886f9947d82f2a498868b6a86cede9cd1076ce6e87a3214ad9ce3a7361e9aa640520cd451a9df3661c9bc20bf97b52dc0c51b377f7ae71a8210b8a0cfe144aa791e15bd18463b5d71424514597d152238016f9332b0683e174b2a9e82fc0c6d236097b3ccfffceff980f478d28ebc0cf08a9a52816a4b0e4c4a2e4c446744da182d59cb3d618dd481427712f8ac1c37600ff02a85478a16b2606e3a441bbd37b72369c4cef1b613ead2c45c3b97a6705d4a9111fe966e4286bf73f9e6f367e2f1558a85a422929d9a2ed457297f847f9e0613ecb090ac7eea5914bba22822a67f813c8d0765f84fac9f7d17134146229f4b362369cbe001dc42830091ab4dddf9d12a20e86ed992d5b39b02f536880ab7a75540c3ee7a4331edebf44a98cb25f129bb9b78cbf85d63b537edcb929dccefdc3b3a91e9e021c3002a84f978f14267af3ecb091dc55de514c1fce2ac6b5c534ab57adcde47e3e6e861392a01838c6b211772621fbd3877c441695aa99b62689fd4aec31d60823a03da6cead0d8f11adaa12edde69bb73065ad8822d971f1e9b8b8ddf62f7f1387ca3984a87e9b31c707d80d66c81598512b929487637cfb7fcfb2472c4c4d8322cf3c3a21086c69f281926f530427bd447ad9d6215ef2ea10ffebd1f0e30f4b7f319faf5dbe1972961fb5c93f177f23b79252863d8070c16218fb937bc187fbf7ab3abac52502f6a73bf31262d6c2c1c9e8ba8b0f89056adb70a02b1a650579078abf6c071b65808cdaf1fcaf88f66fbf3d1e3faa6d037f47dbc7489c5987458f684bab82045b48f3cb55f899e5ded577e54581eef3aa2a6955880e0e3eb1d8e44b1a99bf67905f431aa46b42855534dc14449d4c721f4527a6a0b57afd919b45b2dd4de7fca903aecb7ab37cd689ac27dc59e5d3b63f5dae1b00b55b95a1b69a50cc1b4b9b93143ec555c81a56d77d9496fe7caf3c1b5d0614fb65618ed4e12bb39ae407a609dbc6427c7026d55e34307ea763bd5eaecd17af0851a1061058eaeca39c348886de3aab704679ce577bbb721d1de32890dc302b89814b392b54293b947b878270cf94aff19d3460c8148072154d419585b545e38291e304bc40df12b7394e27463958d012389dd39eab4fbef3f35e378ac6b418165f90a440861aa483f2f06c36b2c99c8d71718d3b9e06884d6281ab73b69e80fc56d31bb9f4e48362afeca2737c50c1716f96c30257d04c37d3e58352f809140c12a1dc2d8545f22b0af84c221b67c595019fe0074a514d2b2d60138ece9a3674738eb4ad7588c7f1a0f1484c4d92809421c98c57b862b108f56232c4d132739aa915ccf95d8bd793288532b5228dc88ac6f57188671c81a3d6b0db5d8e4613d2f055756cb30d5412b060320b324aeabbcc46c8b93e81ef8ca8468e1410c515b454f42d6880ba247472d6570696499402ae09a082c83d48e1e8d852ec70587410de1901a4fac2c05bafcd8c1989d06f17488991f72c68ec67c8a1510e41121aa05864b83c04f84c9cfc6e9a0f5b975bba21a4c2cc83ce4cd46e2619843e6714a10ff0637a7f55d056a29c7e4032a5b6d2b10bb681e4351eb9df67b8153b2c3de23227dea22b684521ee2aada1d2be3889e14569439b76eb67e6ec2e198aa60a1c54b88a74cb5685bb40495421909376b5d90e749edb2e97fd53287b30a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec040dd0448bb790087e8f8fc22c684ce42c2a55b5097c4b253b41882ca2f0e9266e6011af851b5b29e62605356a6d29513c775105f39ab159f9fb80220df689a4e426e28eeecd94ad11febb76973e27ae92992ba223166245627fae73258939d8ab939aa18a993ddff9fd9056d7080ec36d6a51f2e8300c1f6352590210b1d05a08e6bb84a4b94a3d1baace60c611ca452c6a15866d7a733dcdfb11b67d071fc6fb3e1fdec2709fae8657b2a5b4c8e222bae231df7fb077537f38f527705be09e8b5cb2bdfd8647cec1556e8bc6f2834ed47240ce473976cc1896cebbb4c6613fe8575f4f1d3687fd713e7c19030e9b3e9fa6db693342383a8e770798fbb89bbe8fdba7a9bcd818eb63635c098c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a1057b8a242fa0e90d6a46b4138e61ffbfcc7d24ff28ab0fb0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131313132323634312d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032363037203030303030206e200a30303030303034343332203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303338203030303030206e200a30303030303032313735203030303030206e200a30303030303032363730203030303030206e200a30303030303032373935203030303030206e200a30303030303032393235203030303030206e200a30303030303033303538203030303030206e200a30303030303033313936203030303030206e200a30303030303033333230203030303030206e200a30303030303033343439203030303030206e200a30303030303033353831203030303030206e200a30303030303033373137203030303030206e200a30303030303033383435203030303030206e200a30303030303033393732203030303030206e200a30303030303034313031203030303030206e200a30303030303034323334203030303030206e200a30303030303034333336203030303030206e200a30303030303034363832203030303030206e200a30303030303034373638203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c36433246304237394545423931333734453941464545463245304439373741363e203c36433246304237394545423931333734453941464545463245304439373741363e205d0a3e3e0a7374617274787265660a343837320a2525454f46	Comprobante_000089.pdf	application/pdf
90	128	17.36	2026-01-12 14:13:12.547134	EFECTIVO	19	1		Anulación solicitada por cliente	2026-01-12 14:25:49.838034-05	f	ANULADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313937370a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb6edb4816ddeb2b6ae1013a805da9f723c02c68590e62d896112b8d2cb261243a61a04720d93383fe9af987fea259ce5ff42992a229b92a1d47a681308a52e0b9ef73ef2d33aa8d659d1f4efe3d60e4ede07432787d2e0877647237108c1abff323c9e472c0281782e069389e821bb2fe32e0d651653b479d77c43a4db9b7cc19c315b7526867c86436f8ede2c3f52423672392bdfd90919bf1243bbd1cbd22936f83d1a495410519b8a16c4704eb6b19840ce83a3cbcd14104a120c2ce5188668da6522b6d8c179e4be9b4b09508b7d9f54576935d9d667bb8783f6019953beff2103cc0aaa0b95236603351c10a11103a27b9245673ca5d85e784b1967b2f6ad87cf92dff9e2f3ee7c764f8b55c7c5eadf33f56c764347dc867abf5a1b24847a5e87a417162a5a74e09abb5675a73ee98e3952c9362feffbbd572f5867cfa4d7bf9e91591271f3f7e0c7f3e6e0561d40514a7c2c390f76f079c56ae144e2a53d955217694802bbc719a492f11590edeb3300c0e39c79df3d6486bf196c5406b41ad61922b6f9811215074fcec7c70fb93c1100948c11c85301da34943202c0588125b61b5ada36138beba793f3ecdae27a3109637d9dbf17e38b24a024e75d2f89653e33a888a7902df03b1b63be74c4881d402e0f58a9290789eede3c037c011d4ecf83c244e15f6d00e4fadf1944853e0c66c6f94a4708f6bcd6c9acc3bcb26e35ba878498697ef465077079eff4dc445ec1c4517921ae4c536449c69926e382f8be57df1e659611e01f51e9f844678379e74b0740af4e2215f928bd5a6201f365fa739b9cda7f9a15a0b6fa9e94697333f52bb983dccf383b54695a112e9dd292b694c16ac82c2e7742f1e661ec1dfd49310d7aca96fc3d5acfcb222d95d392f51d00ed6990b4bdbc21580341769746efb716c0a2f64f155312b51b90ff7ae71a8240d51067f0aa5d3c870431f7ed55e5330451d5c464bad755337ca75319d96abe5ae9ebf001bcbdd24ec235df6a2ad034b23a4b6b25850c396198b8a197b513685ca209804f7895d4e78a9284ee2de16d3fbfd00fe0550a9f085ee9818bc93061d8208d6ab5ec84f2b4bd173b6df59015d3adc472e33729e0d271fdeeff67e2f1555285942292959d3f922b32bfcf37c7affb0ce09aac6e175914bdab2409d31fc07c8d0f6443081b6eb2474fbfdc4570afda65897ab17e08218ff254183b6274cf6e260d89ed9aa9b03f532851eb8ae56e7c5f46b4e468b72f31285324a7d496c2e5e33fe3a68dd8f7353b8a3cdfdb3791e9e021c3002a84fd78e1426daf3ecac97dc55de510c20ce2ac6b5c540abdbbe66b97958f443084950cc1c8b832338eace24e464759fcf4953a9fae96992d847dc1ecbddf07d294a40734c9d7bb43cc6b4ba4c0cc7d7c3d10d78610fb65a80786c2f767e9afdc7d3f88d622a1d26d06ac8f5015ab306b38e25322b48f6e561bfb3f92172c4c6d8346c13c4a21272262551324ceb618cf628905a3bc51ad66da04fffb729a718fc87f91addfa5df96d45d809d764f127f92739129431ec04a64dcc63f60d5f2cfefcf4ea5059a5a05e74667f634c5ad82371ccf6c7e3e7222a2c3fa4558f9b05816053282c613adaf6078eb36629f4f0f9be4a8068ba3f1f3dae6f0afdd9fa3edd81c5e2102108bc360a9179f5fae7b658ffab444bbf21d92cfcbdcce7c5a68760940ec96b9b6cc746024c5d97f121fafab24a83bc1917f1794e16f540454edad10a9b12877f56f48a686c990edf35ef5817f9bcfca37ec326e4d5cd3bf21defc8678b7279a84e0245aceb4487955752a9232e8f752f512bb1ca0405563912ba0216f64b3b51db7af4e0b88daa9cc2df55f9e9c6301a9415e137bdab0a3b4bb0526239183ddb2e07ff8e129f2eeae2d6c52205a85b5e063e52b56bdde751ff53542d34d6d31dd5185223057ac4f57e14bd949ed88be2f3232773149100f9eef70c351f44cbfef1e9d5c1caa2a62bd55156211e92d047fcd83d93f763cd464849d7e42380b55286086740d1be358296e1c5a1d1c1a5c3e5760cdccf97e783c37f1444f6a8b0b63a0dde63a723b0f90593563bf490ab580ad65dc7d9080a5f8eeae5ef9305f70bf5cf02018d7fa0f4b35a6d031f3c8e46a8cc37f997c3bbe8e86894c4c6ff01b85816eb8a6c02731c1326dee09ee63bfdef82f662082ceeac69e9814b6feba6e6aab8c72c1cb7c4afec0114a73bb7311890d3e0a3f3d170f2eef75e5ccfb1c3834b1efb7a949f0af47d312d3f83c70321bf80e7391af9c7f0d6b8a14c435f1477c57ab35a926c5efc275fce8a352eddf2f574452608874de72200301228b80e823036d5ca70ab294cda2e5db08808a4a514f2b2d3c03a5c35c58ece711425506324c3f71a0f8949377a344a841c374ce156498005b94111c087c449b3bb1601d170328dd32bd6291401d4ee9220950da246cf86c64072efa0aae25e591473ecdb70d556ed2d85c47dab97780f4e2a0abbd541899d8d4080e264cc52b193903566ffd8d1f94019dc7a5a269008b8e7c4a51e5ac3e8d168dc0a546e34c6602b2f84e1b88ab4f183313b4de3b910333fe48c1d8df9140b4cc4bb08651c726380163c1e253f19a3d3c1d7c15dcb3398b69174a0899d9cc3220249c72941e81b5cfc77f76ce032aec3bcd19a13bd846c0adaf87a320e84929d8d9ff0e88f7e8fa082425f40217cfb2b02b01c7c97c28af3e6decdeccf4de71c97c9b05b8b0c3bb7ab527404b542190917c39760ceabce5de95f32fb2b3e0a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d923d6e1b410c85fb3905cb040846c39f21392a13d86e52257b818d3436d6902c612320404e93a3869b1f483162c0f6142c761ff83d3e12b3a03191b3a854d526f02d95ec045164290a9f6ee20b2cc56be1c6568ab949410dad2d12c573175530af199b95bf3f50a4c13e9194dc44dcd1bd99b235c2ff6b77e973e22a99b9223a62215624f6a73a57929883bd3aa919aa98d9d39ddf0f69758de030dca616927f1ec3f03126952500118b5a0bc17c97903457a96743d519cc3842b98845adc2b04d6faea7793fc2b6efe0c378dfe7c35b18eed3d5f04ab69416595c44573ce67b067b37f587537f04b705eeb9c825dbdb6f78e41c5ce5b6d4587ed0895a0ec8f929c78e19c3d27997d638ec07fdeaeba9c3e6b03fce872f63c061d3e7d3743b6d460847c7f1ee00731f77d3f771fb3895171b63cb4d2fd4717d60547229cb82888a581c1dd12f6337fda1cf010d1b6b405ae18a0ae93ba035f23a6ef9987fecf31f473f014729b0d70a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131323134313331362d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373734203030303030206e200a30303030303034353939203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032323032203030303030206e200a30303030303032333339203030303030206e200a30303030303032383337203030303030206e200a30303030303032393632203030303030206e200a30303030303033303932203030303030206e200a30303030303033323235203030303030206e200a30303030303033333633203030303030206e200a30303030303033343837203030303030206e200a30303030303033363136203030303030206e200a30303030303033373438203030303030206e200a30303030303033383834203030303030206e200a30303030303034303132203030303030206e200a30303030303034313339203030303030206e200a30303030303034323638203030303030206e200a30303030303034343031203030303030206e200a30303030303034353033203030303030206e200a30303030303034383439203030303030206e200a30303030303034393335203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c45353834453431413742394639413738373846444330343535423133334638333e203c45353834453431413742394639413738373846444330343535423133334638333e205d0a3e3e0a7374617274787265660a353033390a2525454f46	Comprobante_000090.pdf	application/pdf
99	86	2.00	2026-01-15 14:15:58.381992	EFECTIVO	12	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
91	129	17.36	2026-01-12 14:26:08.713671	EFECTIVO	19	1		Anulación solicitada por cliente	2026-01-12 14:42:28.954755-05	f	ANULADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313937330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb4e1b4914ddfb2b6ac14813092af57e449a45634c1404180527ca229bc66ea0233f221b6646f99af9877cd12ce72fe65477bb699b6a12621a291dc729f5b9ef73ef2d18d5c6b2c60f277ff51879db3b1cf55e1f0bc21d195df704a3c66ffc48323aed31ca8520781a8ea7e0862c6f7adc3aaa6ce3a8f38e58a729f7963963b8e2560aed0c194d7abf9f7c381f25e4684092b71f1272311c2587a7835764f4a53718d532a8200337946d88607d298390015d8787373a88201444d8380ad1acd1546aa58df1c273299d16b610e132393f492e92b3c3640b17ef072ca372e35d1e820758153457ca066c260a58210242e32497c46a4eb92bf09c30d672ef45099bcebfa45fd3d955ba4ffab7f9ec6ab14cbf2df6c9607c9f4e16cb5d65918e4ad1f482e2c44a4f9d12566bcfb4e6dc31c70b5946d9f4bfebc57cf1867cfe5d7bf9f91591079f3e7d0a7f3ead0561d40514a7c2c390f76f7b9c16ae144e2a53d855217694802bbc719a492f11590edeb3300c0e39c79df3d6486bf196594f6b41ad61922b6f9811215074fcecb477f993c1100948c11c85300da34943202c0588126b61b52da3a13f3cbb783f3c4cce4783109617c9dbe17638b242024e75abf12da7c6351015f304be07626977ce999002a905c0f3052521f13cdfc6816f8023a8d9f079489c22eca11d9e5ae32991a6c08dd9de2849e11e579bd9549977948c869750f194f44fdf0da0ee063cff41c445ec1c4517921ae4c53a449ca992ae3fcdb3f95df6e659611e01f51e9f844678579e74b0741be8c97d3a27278b55463eac6ec729b94cc7e9ae5a0b6fa9694697334fa99d4deea7e9ce5aa3ca5089f46e9495764c16ac82c2e774271e661ec15fd59310d7acaa6ffdc524bf5990e43a9fe628683bebcc85a575e10a409a8b76746ebb716c1b5ec8e2b36c92a372efee5de350492aa20cfe144ab723c30d5df8557b4dc1146570192db5d655ddc897d9789c2fe69b7afe026c2c775b611fe8b2136d1d581a21b596c5821ad6cc9815ccd889b26da80c8249709f609d44712bee6536bedb0ee05f00950a5fe88689c13beda07d10c172d109f96965297acefa3b2ba04b83fbc869428e93fee8c3fbcddeefa5a20a254b282525ab3a5f6476817f9c8eefee972941d5d8bd2e72496b162833863f810c6d0f0413e680c983d0ee7713606df017d9325fbc0019c408b015b452b7130fc3f8cc16ed1cb8972934c165b93acec6b72919ccf2d54b54ca28f7b56273f19af1d741eb6e9cdb863b58dd3d9be8e129c0012380faf6e2d18689fe3c39ea24799577141388b38a716d31d1eabab199afee67dd30422b28868ed9ce111c75672be46871974e4955aaba696a5ab1f7b8dd979be1fb529c80ee983af76079cc696599e80fcffb830b10c3166cb101f1585f6cfc540b90c7f11bc5543a8ca0c594eb03b4661566194b649291e4e67ebbb57912396263ac1ad6096251093993922819c6f530477b1448ad9d6215ed56d087ffaef23126ff7eba44bb7e9d7f591076c035997d277f903d4119c352605cc53c86dff0c5ecfbe757bbca2a05f5a231fc1b63da85dd13fb6cb317fa815f62498eed87b4ea61b520106c0a85258c47eb06c171566d85eeafee8a0488a6fbf3d1e3fab6a13f5bdfc74bb0581c22048157472132afdcff5c66cb3f73f4f42b924cc2dff3749aad3a0846e990bcb6ca76ac24c0d46519efa3b1cf8b3448ab79119fa764564e54e4a09eadb02a71f86741af88c69ae9f05df58e65964ef36fe51b5621af2ede91af78473a99e5f35d751228624d273aecbc5a95dae3725f7712b512bb4c50609123a12b6061c1b411b5b547778edba8ca6df89b2a3f5e194683b220fcaa7955616909566ad90e46cfd6dbc11f51e2e34d5ddcbad8a40075cdcbc047aa36adfb3cea7f8caa85c67ebaa11a436ab481ee71bd1d452fa52716a3f8fcc0c91c452440befb98a0e68368d96f9f5fedac2c6aba520d6515e2a1157a8fefbb67f27eacd90829e9aa7c04b056ca10e10c28dad746d032bc38343ab875385dcf81dbf9f27c70f88f82c81e14d656b78377d8e908ac7ec1a4c5123de42ab68265d7713480c2a78372fbfb68c3fd42fdb34040e31f28fdac54dbc0070fa3112af3457ab37b171d1d8d5ab1f17f00cee6d9b2209bc01cfb8489372090aff49f19edc410d8dc5953d30397de964dcd59768759386e895f5904284e37ae633020b7830f8e07fdd1bb8f9db89e638907973cf4f5283f05e8fb6c9c5f81c70321bf80e7391af987f0d6b8a26c873ec9aeb3e56a3127c934fb3b9d4fb2256eddd2e5784146088755e32600301228b80f8230b6ad95e1565398b4deba601111484b29e465a38175b86b8a1d9de2284aa0c64886ef351e12936ef468940839ae98c2b592000b728322800f2d27cde65a0444c3c9384eaf58a7500450bd4c825436881a3d1b1a03c9bd83aa8a7b6551ccb170c35d5bb1b8141217ae5ee23d38a928ec560625763602018a93314bc54e42d698fd6347a73d6570ed69994022e0a213b77ac8ece8d168dc0a546e34c6602b2f84e1b88bb4f183313b8de3b910333fe48c1d8df9141b4cc4bb08651c726380163c1e253f19a3e3de6defbae6194cdb483ad0c446ce611181a4e39420f40d6efe9b7b367019d761dea8cd895e4256056d783e1a0642498e868f78f4a95f2428a0d01750085fff8e002c07dfb561c57973eb6af6e7a6738edb64d8ad46869deb5d293a8252a184849be15330e759e3b2f47fbc2d2b700a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a9056b8a242fa0e684dba8ee6c7fc639fff38fa094736b0d70a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131323134323631322d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373639203030303030206e200a30303030303034353934203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032313938203030303030206e200a30303030303032333335203030303030206e200a30303030303032383332203030303030206e200a30303030303032393537203030303030206e200a30303030303033303837203030303030206e200a30303030303033323230203030303030206e200a30303030303033333538203030303030206e200a30303030303033343832203030303030206e200a30303030303033363131203030303030206e200a30303030303033373433203030303030206e200a30303030303033383739203030303030206e200a30303030303034303037203030303030206e200a30303030303034313334203030303030206e200a30303030303034323633203030303030206e200a30303030303034333936203030303030206e200a30303030303034343938203030303030206e200a30303030303034383434203030303030206e200a30303030303034393330203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c45434431373632443244443643304432423546444243334542393832323039443e203c45434431373632443244443643304432423546444243334542393832323039443e205d0a3e3e0a7374617274787265660a353033340a2525454f46	Comprobante_000091.pdf	application/pdf
98	126	3.00	2026-01-15 14:15:58.352427	EFECTIVO	12	1	[PAGO MÚLTIPLE 1/2] Mora: $1.00. Mora fija de $1.00 (14 días) | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323339390a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acd72dbc811bef329a66a7d4852d678fe67a01b2c512a6f49a2ca8253bec22464c3458a0a2525153f4dde216f9337f0796f39ed37004182548f2c9a966a9725da6d7cdd3dfdfb0d04b7ce8bde8f64ff1a08763a785b0cde9c2826032bae074a70976dfc68569c0d04974a317c3a894f251d5b7c1e481fb8f13dd19005e683e532f32238278df45ad9e0583119fce5f70f1745ce8e872c3ffd90b3cb5191bf3d1bfe95155f07c362a583893a48c7c5860a3e6b75503aa2dbf891391b5550062a6c884235ef2cd7d658e7329549ad8355be51e12abff83dbfcccfdfe65bb8783e6005d71bcfcaa0788435d172637cc416aa81552a22f424a566de4a2e43831794f35e66996a61cb9bafe56d39fb54be66475fead9a7f9a2fc367fcd86e38772325fecab8b915cf5256139f33ae3c1286f6d26ac953288201b5d8a6afafd7a7e333f641627ab0f3e7efc18ffffd82921788808c1c40fc7de9f0e246f8e51056d5ce35383b8310ac790b96085ce34a22ae0e43c9c02a11064089977da7b3c6536b05671ef84962673c2a91824d08f929d0eae56810073e185c0f586136228a582d16a2e6ddf613004ca728018d5296b7d1b0947a3f3cbf7a3b7f945318c2179999f8ed8f9ffce8a77975b312999148d2a92dbe40978c96156ef049466080040b7ce975228ad905f40be987316b32f0b3b9d3b15fa965bdf13d6c860e71c47da7527e3e27f0dac6227f951f1e17d7e158dcd8ff3abedd4437c005f71b781df793c7a199fd6e2330241012a069c56381ca794305e192382f7701bf08ff3627405579fb1fce4ddd9bbfc78b4e5e6a7cd270e9c8487fe08547cf3c11b216db0285ff1bca77575735f1deee4730234cbf09bb2d92aa44296063daeabcf73765e2eeeeb9beadbbef6aacc73d74f87e09e32f8fbe4615aee6d2f8a1cd77a5945dbaa96c644986b6d8cb5ee25ce164ee74068e32a3306a5a32d69477f4c6af839bfaea735eae9de364be5f9aa6ec6d4b552a5d1a57c91834de2c5fa715e4d6a348efd4fd705d4b0659f8e051e35258d8cb3552f72b041737ce9e08274a69d188eeb45351ed77fdc6c1afa13b054da26614f1fca7f97ff78a8a72f52213135f04c75cd10bf09db4e09c7c3223f3b6bda51aa54c736b0ee020d02ceaaeba0683bde61d2b1180870a2ebd69f091dfbb0f118ab62276acbb334f010293b45cf0614a402125ea089421e8141c992ddddeac083cfb4c603ac0c4a672e2969b9376d6171f88232c3c6f4c860157ab9e879137fd5a84aca6226f2c1291932e19516b0baf13c041001c8ea2ca880dac5f0050a2c9f887a0695a324e52a4a724c9f00253a1da0610beb514b95ca347e33e8cda428193730294013eb82c98c361aad3e2148f8097a52a284f7a12629499c28ec7156e0017080905e60f8a683e4d9513a1e7c195c77f9d6ec231996898d9f661d919c7d1e60dc5e9d10b238361fe82938dcb882c22ed3f6a6dfb692f9470ff771fced55c6e8ede4c34fcaf1fdc3a2dc11020fe71b83351a6d1ae3b25ad4f3c97c470c543dde2b7bc2284cc5693b381bceea3b54dc5d61504b9746b4b3828b099f82399adfdc3dcc7635451b1475244de8721d653009718e156bc7e71b0cec4235034d0322321de33e0150ccefcb558340350eb1242f3f52959f4a4c8b36a6ccb215a04379e7353b9050a59bae1a6510da8baa4b0df9942d64ff2353456a98d6ac26cd5fe0ecdafeb73dd0ec0a46a64e0a2cb6ba038519eb40ca83484aec094e27550a7d09bc27269d6449f78a3752be89c8fbc292499782156cf6df3d01c90c4ce1bd92af85d813b0c918d9750d8b450373551a51fd02442251602a17586c57318559bd8d9e17489424d82a51a48a79b26ff0907992b6b4c9937ded25f3248929fc1bd1e4c9f636f94bf224090bbae74512250978f012499244db4892c7641fd5b78cd71c4e5bf72809f22bc1eb91b22b5eef479bdb636a0d73260f76ed48cced7025b61310ccebae6c70a0cd6051dedcd79372c22615bb6e67b2bbdd76c7c71ac45d20a00eaccc04d9915460b7fdf8b9e66ac7319cafd96c6ddbb36c661016471d56de4eeb7139d9227c7ec25acc3b5888d7d61a04475281c735fe875b32952da4d1a8f258d3bb38f4388296b92d707170d62ec6a36d0264776cab6c6469d7f682ea4942bf323b9bfb4c524083418663d76cb80605d423055ae634b2d42f41c068743dd8dfa56cd0183cdb9e538dbf9431992ecbcf5bbcda4f4093bc5a125bda44f9ff35266bcf357881ee9e0a1b70bb377cbfc792459bfc335422d56553d8c393e151f1eeefab23c6e6118307fb4043f924a6136ce41c31b31a2394452d8a6c8f41d8f5ba42d08e96058582fd1c5299071160f101ba24214bd67c5019b03ac32d48008ac21ea53017d292a82e11a5a51b4037e22812748fc24d065cd6951ca4864ab13dcac1cbf84370cf12551994150a48340a1dd02382342e04711102372beb1b4b97c1167d8f499d72152909558913204541a3389cb2c7460997e0233a9616a5e2135728b1a2e0ee141518377acea02492728fbd44733da4ef69b2873c50b44104b5f2880985f9069700321123cf0dd20db207a520e696e6fdfbe478a3bca67b1c6ea6fb3711b8595a8e76eb02ee9697cde7a38b62c4fabd62bb6e3f75dbddf20119f861d3bbc806c595067c657bbd01ff1e4440acf9be2df904ffa5c0461ab3ae86325e1a26585a5236c1d292b274da204281045f662a488f8b9b487dd292389778f24bfd0d6ed493790b9e32d6f66ecef749925681e500658860844740ce7af45c9aa455125d1a1c48573205e280266949499aa425456992961425d3116cae75065f15ac725224385ac24974d6929ea7b3963c4e8aa22523e4d921dacb5afdf4ae8223899d5044564c60628c0d8cca615c19a34c2c6fc941d97bbc6110536af4e9ae5afcb31cd7f39beaee902d4956f6db23cae890bd0225d0665ff137d6d1b13dc9e5ce0c41d509360d166fbf60f3594f7a91707378bd81daccd1d871dfbe9675d6215fc1dda14af45e6440692745e312d4dea6aede08400d05e14e3fb7ddea5697ae0e45d8279ffb9ccdf1f1ac8f7b7a8e7745d6eac48091b1a660faeca67d24c17216ac17b3380b4ed951f9b55a6cb2b73b632385e0899edff0a6c0b3b0db7bfc2d70cc4fd703b4fbcd117cf9d210bc0c5c2cc0f113d5ba2122b01df75fd8c001e33d0fcfe1e8ae3f6a25b3f6de7378775fb1f17c76bb987fc28289df2bdce85f63df62d0e81673229bfd7f7a5fdf4e2b90b4e5b4fe865be87d35c47d0bc2aae749344cec491adbc8ea8d19a4797b6159dd540b6046753036b753f36ba60ea53b1482ddf2ffccf8529f3f0101640c660a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353134313630302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032363234203030303030206e200a30303030303034343431203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032363831203030303030206e200a30303030303032383036203030303030206e200a30303030303032393336203030303030206e200a30303030303033303639203030303030206e200a30303030303033323036203030303030206e200a30303030303033333239203030303030206e200a30303030303033343538203030303030206e200a30303030303033353930203030303030206e200a30303030303033373236203030303030206e200a30303030303033383534203030303030206e200a30303030303033393831203030303030206e200a30303030303034313130203030303030206e200a30303030303034323433203030303030206e200a30303030303034333435203030303030206e200a30303030303034363839203030303030206e200a30303030303034373735203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c42373343354537363039374538454344344139314138314144444242323336453e203c42373343354537363039374538454344344139314138314144444242323336453e205d0a3e3e0a7374617274787265660a343837390a2525454f46	Comprobante_Multiple_000098.pdf	application/pdf
92	130	17.36	2026-01-12 14:46:27.804297	EFECTIVO	19	1		Anulación solicitada por cliente	2026-01-12 14:46:44.67628-05	f	ANULADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313937360a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb6edb4614ddeb2b66e1020d604fe6fd08d0052dcb410cdb326225c8221b46a213067a0492dd16f99afe43bea8cbfe45cf90144dcac3248e4c01516479c073dfe7de3b66541bcb1a2f4efe1a30f272703c193c3f15843b32b91908468d6fbd24999c0f18e54210bc1b8e77c10d597f1c70eba8b28da3ce3b629da6dc5be68ce18a5b29b43364321bfc7ef6e67292909311495ebe49c8d578921c9f8f9e91c9e7c16852cba0820cdc50d612c1fa52062103ba0e6fdee820825010a17514a259a3a9d44a1be385e7523a2d6c21c2757279965c2517c7c90e2e9e0f584665eb591e820758153457ca066c260a58210242e32497c46a4eb92bf09c30d672ef45099b2e3fa75fd2c587f4900c3fe58b0fab75fa75754846d3bb74b65aef2b8b74548aa6171427567aea94b05a7ba635e78e395ec832c9e6ffddac96ab17e4fdefdacbf7cf883c7af7ee5df8f76e2b08a32ea03815de0c79fd72c069e14ae1a432855d15624709b8c21ba799f41291e5e03d0bc3e09073dc396f8db4164f590cb416d41a26b9f28619110245c7cfce07d73f190c918014cc5108d3309a3404c2528028b11556db321a86e38babd7e3e3e472320a617995bc1cef86232b24e054771adf726a5c0351314fe07b209676e79c0929905a00bc5c511212cf8b5d1cf80638829a96cf43e214610fedf0ae35de25d214b831db1b2529dce36a339b2af34e92c9f81a2a9e93e1f9ab11d46dc1f31f445cc4ce517421a9415e6c43c4992ae986f33c5bde662f1e15e61150eff149688477e549074b77819edda54b72b6da64e4cde6d33425d7e934dd576be12d35cde872e67b6a67b3bb79bab7d6a8325422bd1b65a51b9305aba0f039dd8b879947f057f524c43502b9547535cb3fae487293cf7314b4bd75e6c2d2ba700520cd45373ab7fd38b60b2f64f14536cb51b9f7f7ae71a8241551067f0aa5bb91e1863efcaabda6608a32b88c965aebaa6ee4eb6c3acd57cbb69ebf001bcbdd4ed87bbaec455b079646486d65b1a0862d33660533f6a26c172a836012dc27582f51dc897b9d4d6f7703f81740a5c217ba6162f04e37e81044b05ef5427e5a598a9eb3fece0ae8d2e03e729e90d3643879f3baddfb3d5554a16409a5a46455e78bcc2ef04fd3e9eddd3a25a81afbd7452e69cd0265c6f0ef2043db23c1843962f2085d47bbe978b200eb82bfcad6f9ea09c82046809da095babd7818c667b668e7c0bd4ca1092ecbd56936fd9492d122df3c45a58c725f273617cf197f1eb4eec7b95db8a3cdeda3891e9e021c3002a8ef2e1e5d98e8cf93935e92577947318138ab18d71613adae1b9be5e66ed10f23748262e858ec1dc1517776424e56b7e99c54a5aa9fa6a613fb80db43d90edfa7e20474c7d4b97bcb634e2bcbc4707c391c5d811876608b0d88c7faa2f5aa16200fe3378aa97418418b29d70768cd2acc3296c82c23c9c7bbddd6e6bbc8111b63d5b04d108b4ac8999444c930ae8739daa3406aed14ab68b7823efe77934f31f90fd335daf59bfcf38ab023aec9e21bf9831c08ca189602d32ae631fc862f16dfde3fdb575629a8178de1df18d32dec813864ed5ee8077e892539b61fd2aafbd58240b0291496301e6d1b04c759b515bafb705b244034dd1f8f1ed7b70bfdd1fa3e5c82c5e2102108bc3a0a9179e5fee73a5bff99a3a7df906416fe5fa6f36cd343304a87e4b555b6632501a62ecbf8108d7d5ea4415acd8bf83c278b72a22247f56c855589c38f05bd221a6ba6c377d533d6593acfbf964fd884bcba7a45bee019e96c912ff7d549a088359de8b0f3ea54ea80cb43dd4bd44aec324181458e84ae808505532b6a6b8fee1db75195bbf0db2a3f5c194683b220fcaa795561690956ead80e46cfd6dbc11f51e2c34d5ddcbad8a40075cbcbc047aa36adfb38ea7f88aa85c67ebaa11a436a74811e70bd1b454fa52716a3f87ccfc91c452440be7a9ba0e68368d96fef9fedad2c6aba520d6515e2a113fa801fba47f27eacd90829e9aa7c04b056ca10e10c28dad746d0323c38343ab87538dfce81bbf9f27870f88f82c8ee15d6567783f7d8e908ac7ec1a4c5123de42ab68265d7713282c2e7a372fbfb60c3fd44fdb34040e307947e56aa6de083fbd10895f92afdb87f171d1d8d3ab1f13b0067cb6c5d904d608e43c2c40bfcfa0bfd67417b31043677d6d4f4c0a5b765537391dd62168e5be25716018ad3d6750c06e46ef0d1e9683879f5b617d7732cf1e092fbbe1ee5a7007d9d4df30fe0f140c84fe0798e46fe3ebc35ae28bba1cfb29b6cbd592d4932cffe4e97b36c8d5bb7743d5d9109c261d3b809008c040aee83208ced6a65b8d51426adb72e584404d2520a79d968601dee9a6247e7388a12a83192e17b8d378949377a344a841c574ce15a498005b94111c0878e93a6bd1601d170328dd32bd6291401542f9320950da246cf86c64072efa0aae25e5914732cdc70d7562c2e85c485ab97780e4e2a0abb9541899d8d4080e264cc52b193903566ffd8d1f940195c7b5a269008b8e8c4ad1e5ac3e8d168dc0a546e34c6602b2f84e1b88bb4f183313b4de3b910333fe48c1d8df9141b4cc4bb08651c726380163c1e253f19a3d3c1a7c14dcd3398b69174a08956ce611181a4e39420f40d6efe9b7b367019d761dea8cd895e4256056d7c39190742494ec60f78f47b7f485040a12fa010befe1b01580ebeebc28af3e6ced5eccf4de71cb7c9b05b8d0c3bd7bb527404a542090937c3e760ce8bc665e9fffb902b740a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a9056b8a242fa0e682dba668463feb1cf7f1cfd04476ab0da0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131323134343633312d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032373732203030303030206e200a30303030303034353937203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032323031203030303030206e200a30303030303032333338203030303030206e200a30303030303032383335203030303030206e200a30303030303032393630203030303030206e200a30303030303033303930203030303030206e200a30303030303033323233203030303030206e200a30303030303033333631203030303030206e200a30303030303033343835203030303030206e200a30303030303033363134203030303030206e200a30303030303033373436203030303030206e200a30303030303033383832203030303030206e200a30303030303034303130203030303030206e200a30303030303034313337203030303030206e200a30303030303034323636203030303030206e200a30303030303034333939203030303030206e200a30303030303034353031203030303030206e200a30303030303034383437203030303030206e200a30303030303034393333203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c42343230423339343744353036313245333643353837433839363830323538363e203c42343230423339343744353036313245333643353837433839363830323538363e205d0a3e3e0a7374617274787265660a353033370a2525454f46	Comprobante_000092.pdf	application/pdf
93	71	2.00	2026-01-12 16:07:02.746386	EFECTIVO	6	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313739390a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a919106092af57e449a45630c0a32188113b160d3d80d71e4476440339aaf997fc817cd72fe624e75fbd1365524c4b4255ac8147deefbdc7b8b516d2cab7d38f9b3c5c849ebb0df7a7f2c0877a47fd7128c1abff191a4df6d31ca8520781a8ea7e086ccef5bdc3aaa6ceda8f38e58a729f7963963b8e2560aed0ce90f5bbf9f7e3aef67e4a843b2934f19b9e8f5b3c36e678ff4bfb63afd950c2ac8c00d651b22585fc9206440d7e1e18d0e22080511368e42346b34955a6963bcf05c4aa7852d45b8cace4fb38becec30dbc2c5fb01cba8dc789787e0015605cd95b2019b8912568880503bc925b19a53ee4a3c278cb5dc7b51c1e6d3aff9b77c729bef93f697d1e47636cfff9eed93cee0291fcee6bbca221d95a2ee05c589959e3a25acd69e69cdb9638e97b2f48bf17f77b3e9ec03b9f95d7b79b347e4c1f5f575f8b95e0ac2a80b284e85872197272d4e4b570a279529edaa103b4ac015de38cda497882c07ef591806879ce3ce796ba4b578cba4a5b5a0d630c99537cc8810283a7e76dcbafac9608804a4608e42989ad1a4211096024489a5b0da56d1d0ee9d5d5cf60eb3f37e2784e54576d2db0e47564ac0a94e1adf726a5c0d51314fe07b205676e79c0929905a003c9f511212cfcb6d1cf80638829a0d9f87c429c31edae1a9359e12690adc98ed8d9214ee712b339b45e61d65fdde1554ec9276f76307ea6ec0f31f445cc4ce517421a9415e2c43c49945d2b5c7a362fa587c7855984740bdc76f4223bc179e74b0740af4b47878180d72928d27c5302797bb6a2cbca5a61e59cebca472317c1ae73b6b8c0a432552bb5652d2980ce9a59cb4ca35e25de611f88b5a12629a2d6a5b7b361cddcf4876371a8f50cc76d6990b4b57452b00692ed2e8a619bfa6e042029f15c3118af6eece350e4564c191c19d42e934b2628a31d58467b5d7143c518597d1526bbda81aa37931188c66d34d557f013696b949d8355936a2ad034723a896b25810c392178b92171b513685ba66b6460239897b550c1eb763f81740a5c217ba6662b04e1ab40d1a98cf1aa13ead2c45c7b9face0ae852633ed2cdc871d6ee7fbadcecfcde2aaa50b4845252b245df8be42ef18ff3c1e3d33c27281cbb57462ee98a07aa8ce12f2043db0311ca273f40cbb173e988c7570afda2988f666fc00631064c82066d0f386fc4c1b03db3652f07f2650a1d7055ad8e8bc1979c7426a387b7289451f24b6233f79ef1f7d0ba19164ce2761e1e5fcdf4f014e08011407dba76a430d19c67478de4aef28e62fc705631ae2dc659bdea6ca60f4f93660821098a8963b2391dbc953b9390fdd9633e268b4ad54c5b93c47e27f6196b8411d01d53e7d686c78c56558976efbcddb9002d6cc196db0f8fd5c5c667b1fc781ebe514ca5c3f8594eb83e406bb6c0ac42890c0b92dd3f6d37362f22474c8c35c3323f2c0a2167521225c3a81e66688ffaa8b543c3b8017df82fe6214cfded7c8e76fd6ef47546d801d764f29dfc41de09ca1816028345c863f00d5f4cbedfeced2aab14d48bdae06f8c490b1b0b87d7222a6c3e3005add70a02b1a650579078abf6c071b6d8083ddd3e96f11fcdf6d7a3c7f54da16fe8fb7ceb128b31e9b0ed097571418a160c985ab044cfae162c3f2a2ccf971d51d34a6c40f0f2f51247a2d8d44dfbba02fa1c55235a94aaa9a660a224eaf3107a2b3db585abd7ec0cdaad366a1f3f67481df6dbcd5e339aa670dfb157d7ce58bd7638ec4255aef6465a2943a4dc5a9921f62aaec0d6b6bbeca4b773e5f5e05ae8b0285b2b8c762789dd1c57203db04f5eb2936381b6aaf1a10375bb9d6a77f66c3ff8460d88b0024757e59c396bb16e5cf596e08c8bfc7ef73624da5b26b1f1370017d3625eb2566832f709531f50b8bed17f26b4114320d24108157506d6169517ce8a47cc127143fcca1ca538ddd86563c04862778e3bedfec7cfcd381efb5a506059be021142982ad22f8bc1e8164b26f2ed0d66742e381aa1358ac6f54e1afab4b82be60fb32916a7c55ff97458cc716391cf0733d247303ce48355f302180914ecd2218c4df52502eb4a281c62cb970595e11f40574a212d6b1d80c3a23e7a768cb3ae748dc5f8a7f14041489c8d9220c48159bc67b803f16835c2ce347192a31ac9f55c89dd9b278338b52285c295c8fa7a85611887acd1b3d6508b4d1ef6f3527065b50c531db4623000324be2beca4bccb63889ee81af4c88161ec410b555f424648db8207a74dc5206b7469609a402ee89c03222f1d658e872dc7018d4100ea9f1c4ca52a0cb8f1d8cd969104f8798f92167ec68cca75801411e11a25a60b83408fc4498fc6c9c0e5a5f5a772baac1c482cc43de6c241e8639641ea704f16f70755adf55a096724c3ea0b2d5b602b18be63114b5de79bf1738253bea3d23d2976e624b28e521aeaa5db2328ee84961459973eb6aebe7261c8ea90a165a7c09f194a9166d8b96a0522823e16aad0bf23cabdd36fd0fdd0387930a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a9056b8a242fa0e645d6c1dcd8ff9c73eff71f413474bb0d80a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131323136303731312d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032353935203030303030206e200a30303030303034343230203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303234203030303030206e200a30303030303032313631203030303030206e200a30303030303032363538203030303030206e200a30303030303032373833203030303030206e200a30303030303032393133203030303030206e200a30303030303033303436203030303030206e200a30303030303033313834203030303030206e200a30303030303033333038203030303030206e200a30303030303033343337203030303030206e200a30303030303033353639203030303030206e200a30303030303033373035203030303030206e200a30303030303033383333203030303030206e200a30303030303033393630203030303030206e200a30303030303034303839203030303030206e200a30303030303034323232203030303030206e200a30303030303034333234203030303030206e200a30303030303034363730203030303030206e200a30303030303034373536203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c34453642393346463430393543303637463231303535384538344638353938323e203c34453642393346463430393543303637463231303535384538344638353938323e205d0a3e3e0a7374617274787265660a343836300a2525454f46	Comprobante_000093.pdf	application/pdf
94	70	2.00	2026-01-14 21:01:42.208426	EFECTIVO	9	1		\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820313739380a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb559cb4e1b4914ddfb2b6a9191261254eafd88348bc61894c860069c88059bc634c491ed460634a37ccdfc43be6896f31773aadb366d5345424c5b4a2b6a157deefbdc7b8b516d2c6bfc38f9abc3c861676fd879772008776478dd118c1abff69364d8ef30ca8520781a8ea7e086cc6f3adc3aaa6ce3a8f38e58a729f7963963b8e2560aed0c195e757efff8e9789891fd1ec90e3f65e46430ccf6fabdb764f8b5d31bae645041066e285b13c1fa5a062103ba0e0f6f7410412888b07614a259a3a9d44a1be385e7523a2d6c25c25976fc313bc98ef6b20d5c7c1fb08ccab56f79081e6055d05c291bb099a8608508088d935c12ab39e5aec273c258cbbd17356c3efb9adfe6d3cb7c8774bf8ca797e53cff56ee90dee821bf2ae7dbca221d95a2e905c589959e3a25acd69e69cdb9638e57b20c8bc97fd7e5ac7c4f2e7ed75e5ebc2572f7fcfc3cfc3b5f0ac2a80b284e858721a7871d4e2b570a2795a9ecaa103b4ac015de38cda497882c07ef591806879ce3ce796ba4b5f8cab4a3b5a0d630c99537cc8810283a7e76d239fbc9608804a4608e429886d1a4211096024489a5b0dad6d1d01d1c9d9c0ef6b2e3612f84e5497638d80c475649c0a94e1adf726a5c0351314fe07b20d676e79c0929905a003c2e290989e7d5260e7c031c41cd9acf43e254610fedf0d41a4f8934056eccf646490af7b89599cd22f3f6b3e1e00c2af649b7ffa10775d7e0f90f222e62e728ba90d4202f9621e2cc22e9ba937131bb2fdebf28cc23a0dee37f4223bc179e74b0740a349be5a45fde16dfb65555784b4d33a49c794ed7e2ea61926fad2a4a0b95c8e9462d49638608c30beb7c2b6e651e11bf2822018a2d8a5ab7bc1adf9424bb1e4fc6a8625bebcc85a5ab6a158034176974d78e5f537021738f8aab31aaf5f6ce350ed563418ec19df05e1a99e3d7865fb5d714f4500797d1526bbd2816e379311a8dcbd9baa2bf001b4bd824ec9f0fe3fbb215451d5819d1b414c3820a964c58544cd88a9e2954e61dda93d7f06a348293b867c5e87e33787f01542abcd00d138367d2a0fdf28e9c8c67e55d2b7ca795a5683357efac803a0dba23fd8c1c64dde1a7d3f576efb5020b054b2825255b34bb48ec0aff201fdd3fcc7382a2b17d55e492ae38a0ce17fe0c32b4dd15a174f25df419b29d104ba19f14f371f90a4c1063bf2468d076b7a51209db335b3570205ea6d0f6d6b5eaa0187dc9496f3abe7b8d321925be243673ef187f07ad4d3bce4de1f6eeee5fccf2f014e08011407dba7ca430d19167fbade4aef28e62e6705631ae2d6658bdea6a66770fd3763821098a3163da4eae262187e57d3e218b4ad54e4b93c47e2376186b8511d01953e71e0d8fc1acae12ddc171b777025ad880ad561e1efb8ab5df62e3f1347ca3984a8799b31a6b7d80d66c81598712b92a4876f3906ff8f759e48889b15b58e6874521e44c4aa26498cfc3e0ec511fb5768ad5bcbb84defbf76e3cc2a8dfcde768d5afc75f4bc276b926d3efe40ff24650c6b005182d421ed36e7831fd7ef1765b59a5a05e34a67d634c5ad85838bc145161dd21ad7adc2508c49a425d41e2adda03c7d9620df470795fc57f34db5f8e1ed73785bea6efd3554b2cc6a4c38a27d4c505295a30606aab123dbbdaaafca8b03cdd70444d2bb1f6c0c71f373712c5a669da9715d0a7a81ad1a2544335051325519f86d06be9a92d5cfdc8cea0dd7a8df6e17386d461bf5dbc6d47d314ee1bf6e2da19abd70e875da8caf5b2482b6588941b7b32c45ecd1558d5f6979df466aebc1c5c0b1db6638f0aa3dd4962b7c715480f2c9197ece458a0ad7a7ce841dd7eaf5e983d590abe520322acc0d1553967ce5aec1857bd2538e324bfd9be0d89f696496cc805e06256cc2bd60a4de60e61fe3d6e0a6ee93f53da8a2110e920849a3a036b8bda0b47c53d6689b8217e658e529cae2db0316024b17b07bdeef0c3e7761c8f252d28b02a5f8108214c1de9a7c5687c890513b97d85319d0b8e46e81145e34e270dfdb1b82ee677e58c6493e2ef7c7655cc714d91cf4725192218eef2d1aa79018c040a16e810c6a6fa12815525140eb1e5ab82caf007a02ba590968d0ec0613b1f3d3bc15957b9c662fcd378a02024ce464910e2c02cde335c7c78b41a615f9a38c9518de4e35c89bd9b27a338b52285c23dc8e39d0ac3300e59a367ada1165b3c2ce5a5e0ca6a19a63a68c560006496c416c84bccb63889ee81af4c88161ec410b555f424648db8207a74d2510657459609a4022e87c03222f1d558e8725c6b18d4100ea9f1c4ba52a0cb8f1d8cd969144f8798f92167ec68cca75801411e11a25a60b83408fc4498fc6c9c8e3a5f3ad72baac1c482cc43deac251e8639641ea704f16f705fdadc55a096724c3ea0b2d5b602b18be63114b5c1f170103825db1f3c21d2e7ae5f2b28e521ae6adcac328ee84961459973e33eebe7261c8ea90a165abc8478cad48bb6454b502b9491709fd607791e35ae98fe07681b83b60a656e6473747265616d0a656e646f626a0a352030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732036203020520a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f4c656e677468203336320a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789c9d924d6e1b310c85f73a05972d50c8e28f48cacb1649365db57381a9ad0413d8b1313550a0a7e951cbe90fec060d90440b2ea4077e8f8fc22c684ce42c2a55b5097c4b253b4114598ac2a79bb881a5782ddcd84a313729a8a1b545a278eea20ae63563b3f2f701451aec1349c94dc41ddd9b295b23fcbf76973e27ae92992ba223166245627faa73258939d8ab939aa18a993dddf9fd9056d7080ec36d6a21f9e7300c1f6352590210b1a8b510cc77094973957a36549dc18c23948b58d42a0cdbf4e67a9af7236cfb0e3e8cf77d3ebc85e13e5d0daf644b6991c54574c563be67b077537f38f547705be09e8b5cb2bdfd8647cec1556e4b8de5079da8e5809c8f72ec98312c9d77698dc37ed0afbe9e3a6c0efbe37cf832061c367d3e4db7d3668470741cef0e30f771377d1fb78f5379b131b6dcf4421dbf0f8c4a2e65591051118b4f47f4cbd84d7fe87340c3c61a5056b8a242fa0edabae05a048ef9c73eff71f41347ceb0de0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052203520302052205d0a2f436f756e7420320a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312037203020520a2f46322038203020520a2f46332039203020520a2f4634203130203020520a2f4635203131203020520a2f4636203132203020520a2f4637203133203020520a2f4638203134203020520a2f4639203135203020520a2f463130203136203020520a2f463131203137203020520a2f463132203138203020520a2f463133203139203020520a2f463134203230203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a32312030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131343231303134342d303527303027290a3e3e0a656e646f626a0a32322030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032330a303030303030303030302036353533352066200a30303030303032353934203030303030206e200a30303030303034343139203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032303233203030303030206e200a30303030303032313630203030303030206e200a30303030303032363537203030303030206e200a30303030303032373832203030303030206e200a30303030303032393132203030303030206e200a30303030303033303435203030303030206e200a30303030303033313833203030303030206e200a30303030303033333037203030303030206e200a30303030303033343336203030303030206e200a30303030303033353638203030303030206e200a30303030303033373034203030303030206e200a30303030303033383332203030303030206e200a30303030303033393539203030303030206e200a30303030303034303838203030303030206e200a30303030303034323231203030303030206e200a30303030303034333233203030303030206e200a30303030303034363639203030303030206e200a30303030303034373535203030303030206e200a747261696c65720a3c3c0a2f53697a652032330a2f526f6f74203232203020520a2f496e666f203231203020520a2f4944205b203c39433338434231434443443136354546363135413545354245313232303742363e203c39433338434231434443443136354546363135413545354245313232303742363e205d0a3e3e0a7374617274787265660a343835390a2525454f46	Comprobante_000094.pdf	application/pdf
100	93	2.00	2026-01-15 14:30:04.8829	EFECTIVO	14	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
101	107	2.00	2026-01-15 14:30:04.954363	EFECTIVO	14	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
102	94	2.00	2026-01-15 14:36:49.671536	EFECTIVO	17	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
103	108	2.00	2026-01-15 14:36:49.736375	EFECTIVO	17	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
104	92	2.00	2026-01-15 14:37:48.558053	EFECTIVO	16	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
105	106	2.00	2026-01-15 14:37:48.593002	EFECTIVO	16	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
107	105	2.00	2026-01-15 14:40:49.843395	EFECTIVO	4	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
106	91	2.00	2026-01-15 14:40:49.807745	EFECTIVO	4	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323331370a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb521b4916ddeb2b32627a311361d2f97eb02b8320dc018830f284b76551d87248881030d3d15fd3ffd07fd37fe075ef7ad527ab545249dc0464b5b05d81a4eb3c37effb21c1adf3a2f323d9ff7b829df6de0d7b6f4f1493810d6f7a4a7017d77e341b9ef504974a313c9dc45349c7e65f7ad2076e7c8734c4c07cb05c462f8273d248af950d8e0daf7bfffef9e3c5b060c77d569c7e2cd8e56058bc3bebff870dbff5fac3250f26f1201d176b2cf8d8f0a07442b7e9119d4d2c280316d648c19a77966b6bac735145a975b0cad72c5c15173f1797c5f9bb620317e7035670bd765604e309d6a49b1be313b65035ac5209a1432935f35672196abca09cf73246d5c096b7dfcabb72fab97cc38ebe8ea79f67f3f2d7d91bd61f3d96d7b3f9aebc18c955971237675e471e8cf2d64661ad94410459f332ac26df6f66b7b34366a1597df0e9d3a7f4ef53cb84e0212104931e8e7d38ed495eab51056d5c2d5303bb310a6a882e58a1a386550568ce4328200a418610bdd3dee39469cf5ac5bd135a9ae88453c948c01f453be95d2d0d01d7851402d76b4248a6943346abb9b45d81e122609603c4a89659eb1b4b381a9c5f7e18bc2b2e86fd649297c5e9809dff71367c7fb96193924951b322b9cd6ac04b8e6b7534a034830100ba11be94426905ff02f2c58cb3e47cc26da577caf42db7be43ace1c1ce390eb76b35e3d2df1a56b193e268f8f14371952e5b1c17579bae07fb00bee26e0dbf957892329ed6e29980c00065034e2b28c729258c57c688e03dc406fce36238b882a8cf5871f2feec7d713cd810f3f3d727144ec2837f182a5ef9e08d90365884afa4efc9b8ba7da80eb79239011a237e53362e4d2ac43c6831a97e61e7e5e37c3c1acfe0f9e57c34dbf5d62a7aeeba4e11dc73d7fe7efd382977be35421dd77a114b9bd896c7944a04833f4aec43c3103d873b35d6158d41006902dbd19fd7e32f3356dc8c276344d59def2c95e7cbe8991cd84a9547377bd16b162e0591f3ea7a8cecb1bb725d40205b24eb14e51158f2c8085d3bdf95d46bd01c2f5ab8209d69ca86e3f1bc1a8dc67fdeae5ff4076029dfcdc2ae72f65ee2246a071e559b12f19bb04dad70dc1f1667677552ca05ec940c56b9a04680b2da3c8ae4e31dea1d8bb2002a5d150051e8948d8d477195f25113a4a5818848da093237a04015e0f002a914f4b00c8a96ccf156071e7cd41a075819948e2e4b69b947c44881c5e105c20c1bd1858355c8e8a2234d7c54b34ad2a232f2c12919a2f04a0bdcba963c086002f0ea185440ec627801061627229e81e54449898aa21cd11aa048273da46d613d62a95251e337830c4d929276832b0570625d30d168a391f03384849cc027454a481f6c92948446711f67050e800084f40225386d24afb6d251ef6befa6f5b7ba2b896829d67eeaa64472f6a587a27ba921b8b1141a9ad382438c4b2874344d6efad78633bf74b84f457027342669670f3f29470f8ff3cd78f112040ee76be535126d1ee3b29a8f67d7eb55c4cb18087bbc13f78451a88df3f7e0ac3f1ddf23e46e0b8360bab844532bb8e4f03998a3d9edfde374dbab6883a80ea709adaf230c6621ced1686d79be41d92e545dd0d42022ea64f71980e1eca19cace232dadfd52317f929c7b4c863ca2c52015294775eb3030956daeaaa6606a63daf5ad790cfdd854c80a4ab488dabd50d4afd0174d72440b9916eb705235d27079652dd81aa6bac83d41bed884dfb540e3ce11e48b52326ed63394ce1df0af916c8eb5de00fc0923e978565d3df7704241d308777b02358ed2cb24d18163d064aaa2cda4fea8dd8d574281fc135b94067bbb427d4e98de5ecc147b260ad8f3821f7e623f99b02f740ec1a13481fc9628ab84f1fc9c262deb31727c902eec549b2686b4ef274da47a52ce33587d056e94962fa9519ec91b4cbc1de4b5ddbd3d91a4a4c1eec4a9028d9214a34269830af12b28142eb9aa2bc7d185f97d7ecba62374d3976bf5ddff89483d40604c481e53531e7c832b01e115eec1629d3212fac02c71b2b7f55e9e05480608c7ed6348883cd49c0f6d856d934b35c5d15238f2cf44f6633dafe53cd31864c78b31d21a22f37ae999d2e9ae3668e9866b6fb9844686c0f10296a574a5d89000b4d00ae465fcb645997e5978df9d20f4093f3a52cb6b49958f8cf5c19590f2a6f5d3668d49c4d01fdfd01dd067de71f99a95139270bde3fe91f0ddfff77a964d4e0c97c5019d7c38f4cb2d60a7b00b34c3238194935cd3d0c0caf13248376342d8609e85441153d5a628b070607195a32046a19211265d3b8c178c8575934ba34a581a72c8d40c414b933830f15b099d36d27204d882a6d4c685a6f31d5d2161db6f5da604a2053ab0d47860060441a1b326c06b00b519e98d793b22229c12ba10292141305c7b5f268aeb4c2660aab1895399532518c0b90ab5490f804430309ab4162a2082939d1830f52fcf4e483d42912030c5b796401bc8b50ad64c64c5e6ba76b930fc483e45f9a7757ac69c9ba9a7d382c6bbb637908af19247782b80257b52f0f2e8603d64d189bc1fbb90570d31c474c4b4d67b78b794f1e702d41e0ffa32b4e81df37719f1806c1d3309a5b85074ceeea3a839ac391b4999125494b3b8e83a63011c48798cb69295dc8515a5fc78845d042fde555d6753160831f2d276cb0809875ddb44043fde170d9147790fad0f150334b8c0f79aa2cb19cc140ce0b0f83a7679624253db32449e99925494a7a24aee4b587946c905ec24ab1daa0090939d1ae4b8a9f765d52a7d4d092349357db69c775f5f3253cb49252a248732261639dc8284746bc849bb58b0904e1a6c41c7cbeafe6ff2bb152bcadee0febc4cca67f4d1ec677932a656ab5ac7c578913dff24081df4aa5192939acf1a90614d3d827e3e029b6cd70df0523b53420799234d5facdbe70b9f94660c407f4b94df3b25c2b3accdf7cf6dcd734484f0b78e4178eef44acd8c1d2075f30e88ee110f19249d755de783e4d55de841d95dfaaf9e6c2764b6c4040121db921c3bd0abbd9576f80e3bb0b373d64f1f5e27af1e5184819b8e8f3d2131577dd6fa309ec7e31010a465ac10aa1f366f08b6fc7f4ef1f2a369a4defe6b3cfe8a3f07b357f18df8c47250347776b7636afcac9f857ec5977e5101b059855479268a4a02594c62babb471b15a3ead6eab3940133fa8889b82f80d5387461ca222bce3bf4df982a1bf019635d4010a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353134343035312d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353432203030303030206e200a30303030303034333539203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353939203030303030206e200a30303030303032373234203030303030206e200a30303030303032383534203030303030206e200a30303030303032393837203030303030206e200a30303030303033313234203030303030206e200a30303030303033323437203030303030206e200a30303030303033333736203030303030206e200a30303030303033353038203030303030206e200a30303030303033363434203030303030206e200a30303030303033373732203030303030206e200a30303030303033383939203030303030206e200a30303030303034303238203030303030206e200a30303030303034313631203030303030206e200a30303030303034323633203030303030206e200a30303030303034363037203030303030206e200a30303030303034363933203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c43443443423832414234413438444338373437454338454145323041423543393e203c43443443423832414234413438444338373437454338454145323041423543393e205d0a3e3e0a7374617274787265660a343739370a2525454f46	Comprobante_Multiple_000106.pdf	application/pdf
109	103	2.00	2026-01-15 19:41:11.648282	EFECTIVO	5	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
110	88	2.00	2026-01-15 19:47:43.27235	EFECTIVO	1	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
108	89	2.00	2026-01-15 19:41:11.544136	EFECTIVO	5	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323331300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb4e234916ddfb2b429a5ecc484554bc1fecb2c0a06a0146856b545b9749a82cd918199891fa6be61fe66ffa0f6addbb5ef5894ca79d36370097dba83be5c7ad3837eefb61c1adf3a2f327d97f7b829df63e0c7bef4f1493810d6f7a4a7017d7fe341b9ef504974a313c9dc45349c7e6b73de90337be431a62603e582ea317c13969a4d7ca06c786d7bd7ffefaf96258b0e33e2b4e3f17ec72302c3e9cf5ffc586df7bfde192079378908e8b35167c6c78503aa1dbf488ce261694010b6ba460cd3bcbb535d6b9a8a2d43a58e56b16ae8a8b5f8bcbe2fc43b1818bf3012bb85e3b2b82f1046bd2cd8df1095ba81a56a984d0a1949a792bb90c355e50ce7b19a36a604777df47f7a3e9d7d13b76f4ad9a7e9dcd47bfcddeb1fef869743d9befca8b915c75297173e675e4c1286f6d14d64a194490352fc372f2e36676373b64169ad5075fbe7c49ff7f6999103c248460d2c3b14fa73dc96b35aaa08dab656a603746410dd1052b74d4b0aa00cd7908054421c810a277da7b9c32ed59abb877424b139d702a1909f8a36827bdaba521e0ba9042e07a4d08c99472c6683597b62b305c04cc728018d5326b7d63094783f3cb4f830fc5c5b09f4cf2b2381db0f3dfcf861f2f376c5232296a5624b7590d78c971ad8e06946630004037c2975228ade05f40be9871969c4f84adf44e99bee5d67788353cd839c7e176ad665cfaaf8655eca4381a7efe545ca5cb16c7c5d5a6ebc13e80afb85bc36f259ea48ca7b57826203040d980d30aca714a09e3953122780fb101ffb8180eae20ea33569c7c3cfb581c0f36c4fcf2f5098593f0e01f868a773e7823a40d16e12be97b5295778fe5e15632274063c42b65e3d2a442cc839e57b74fe5042e3f9a8f67bb5e5745cf5dd71b827be9be3fae9f26a39daf8b18c7b55e04d126a8e531a58259e310adf6a15ac89cc38f1ab38ac620723411ede88febea76c68a9b6a52219cee7c67a93c5f86cde4b956aa3cbadd8b5eb370297a9c97d715d2c6eeca7501116c91a553784744c9236bfced45af4173bc69e18274a6a9178eab79391e577fdcad5ff4276029a7cdc2ae92f55e02248a061e559b0bf14ad8a64838ee0f8bb3b33a1be52275ca02ab24502340596d0245d6f10e858e453d0095ae327f143aa561e35155a544d44467692022927682940d28500538bc400e053d2c83a22593bbd581071fb5c6015606a5a3cb525aee4d13581cde20ccb0315d315885542e3ad2c45735ab242d4a221f9c92210aafb4c0ad6bc983002600af8e4105c42e863760607122e219584e9494a828ca31ad018a74d243be16d623962a15355e19a4669294b41b5c298013eb8289461b8d4c9f2124e4043e295242fa6093a424348afb382b70000420a417a8bd692379b3958e7bdf7a37adbfd5ed48442fb1f657772392b3db1eaaeda586e0c65268684e0b0e312ea1d0ca34b9e91f1bcefcdae13e55bf9dd098a49d3dfc64347e7c9a6fc68bd72070385fabab9168f31897e5bc9a5daf5711af6320ecf14edc1346a128cedf83b3feb47a40c8dd1606c1747189a65670c9e1733047b3bb87a7e9b657d106511d4e135a5f4718cc429ca3c3daf27c837a5da8baa0a94144d4c9ee3300c3d9e368b28acbe87b578f5ce4a71cd3228f29b348054851de79cd0e245869abab9a1998f6bc6c5d43be7417320192ae2235ae567726f517d05d9300e546badd168c749d1c584a7507aaaeb10ed015adf744db63d33e95034fb80772b35add1693f6b11ca6f0ef857c0f64b72b2ce973595836fdff8e80a403e6f00e7604ab9d45b609c3a2c740499545fb45bd13625744c247704d2ed0d22eed09757a63397bf0912c58eb234ec8bdf948fea6c03d10bbc604d247b29822eed347b2b018f4ecc549b2807b71922cda9a933c1ff35129cb78cd21b4557a92187b65267a24ed72a2f75ad7f67ca886129307bb12244a7688128d0946cbab846ca0d0baa618dd3d56d7a36b765db29ba61c7bd8ae6f7cce416a0302e2c0f29a98736419588f08af768b94e990175681e38395bfaa74702a40303f3f6b1ac4c1e624607b6cab6c1a56aeae8a914716fa17b3196dffaee61843267cd8ce0ed1971bd70c4d17cd7133404cc3da7d4c2234d6068814b52ba5ae448085260097e36fa3645997a3db8df9d24f4093f3a52cb6b49958f8f75c19590f2a6f5d3668d49c4d01fde311dd067de79f99a95139270bde3fe91f0d3ffe7ba964d4e0c97c5019d7c38f4cb2d60a0b00b34c3238194935cd3d0c0caf13248376342d8609e85441153d5a628b070607195a32046a19211265d3b8c178c8575934ba34a581a72c8d40c414b933830f15b092d36d27204d882aad4a685a6f31d5d2161db6f5da604a2053ab0d47860060441aab31ac04b004519e18d493b22229c12ba10292141305c7b5f268aeb4c24a0a3b1895399532518c0b90ab5490f806430309ab4162a2082939d1830f52fcf4e483d42912030c5b7964017c8a50ad64c64cde6aa76b930fc483e45f9a7777ab69bbba9a7d386c69bb637908af19247782b80257b52f0f2e8603d64d189bc1fba5cd6fd31c474c4b4d67a98b794f1e702d41e0dfa32b4e81df37719f1806c1d3309a5b85074ceeea3a839ac391b4999125494b3b8e83a63011c49798cb69295dc8515a5fc78845d042fde555d6753160831f2d276cb0809875ddb43943fde170d9147790fad0f150334b8c0f79aa2cb19cc140ce0b0f83a7679624253db32449e99925494a7a24aee4b587946c905ec24ab1daa0090939d1ae4b8a9f765d52a7d4d092349337db69c775f5cb253cb49252a248732261639dc8284746bc849bb58b0904e1a6c41c7c7d28e7ff198dabd95df97058276636fd73f258dd4fca94a9d5b2f25d254efcbc03057e2b9566a4e4b0bfa71a504c639f8d83a75833c37d178cd4d280e449d254eb37fbc2e5ca1b81115fd0e736cdcb72ade8307ff3d973dfd2203d2fe0915f387e0cb162074b1ffcb2a03b8643c44b265d5779d57c9aaa3c2c6c47dfcbf9e6c2764b6c4040121db921c3bd09bb59546f80e3470b373d64f1f5e27af1ab184819b8e8f3d2131577dd6fa309ecfe22010a465ac10aa1f361f08b9fc5f41f1e4b369e4defe7b3afe8a3f0ba9c3f5637d578c4c0d1fd9a9dcdcbd1a4fa0d7bd65d39c4460166d591241a296809a5f1ca2a6d5cac964fcbbb720ed0c40f2ae2a6207ec7fca17187f861c43dffdf942f18fa0b2f24d18c0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353139343633312d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353335203030303030206e200a30303030303034333532203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353932203030303030206e200a30303030303032373137203030303030206e200a30303030303032383437203030303030206e200a30303030303032393830203030303030206e200a30303030303033313137203030303030206e200a30303030303033323430203030303030206e200a30303030303033333639203030303030206e200a30303030303033353031203030303030206e200a30303030303033363337203030303030206e200a30303030303033373635203030303030206e200a30303030303033383932203030303030206e200a30303030303034303231203030303030206e200a30303030303034313534203030303030206e200a30303030303034323536203030303030206e200a30303030303034363030203030303030206e200a30303030303034363836203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c36434439423939383333314537364238333131373644413541373334423039463e203c36434439423939383333314537364238333131373644413541373334423039463e205d0a3e3e0a7374617274787265660a343739300a2525454f46	Comprobante_Multiple_000108.pdf	application/pdf
111	102	2.00	2026-01-15 19:47:43.318925	EFECTIVO	1	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
113	101	7.00	2026-01-15 20:52:22.052154	EFECTIVO	7	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
112	87	2.00	2026-01-15 20:52:21.965467	EFECTIVO	7	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323331370a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55a4b6e1bcb159d731505c48304b0caf5ff68d69628c186240a161d78da265b360d7e044a4e90b79aec21bbc90e3c7eb38c72aa9b4d36a95bb2685a825f439ffbfadcbaff7b8a825be745e74bb27ff6043befbd1df6de9c2926031bdef694e02e6e7d6936bce8092e9562783a89a7928e2dbff4a40fdcf88e688881f960b98c5e04e7a4915e2b1b1c1b8e7b7f7dfff16a58b0d33e2bce3f16ec7a302cde5ef4ffc686df7afde15a079374908e8b2d157c6c74503aa1dbf488ce261594810a5ba250cd3bcbb535d6b9a8a2d43a58e56b156e8aabf7c57571f9b6d8c1c5fb012bb8de7a5784e209d6a4931be313b65035ac5209a1232935f35672196abca09cf73246d5c096f36fe55d39fb5cbe66275f27b3cf8b65f9c7e235eb8fbe97e3c5f2505d8ce4aa2b899333af230f46796ba3b056ca2082ac751956d31fb78bf9e2985978561f7dfaf429fdf7a95542f0901082490fc73e9cf724afdda88236aeb6a941dc1805374417acd05123aa023ce761140885204388de69eff19659cf5ac5bd135a9ae884532948a01f253bedddac0301c7851502d75b4648a1940b46abb9b45d83e120509603c4a85659eb9b4838195c5e7f18bc2dae86fd1492d7c5f9805dfef762f8ee7a27262593a25645729bf580971cc7ea78406986000074637c2985d20af905e4ab056729f9a4dacbef54e85b6e7d475823839d731c69d77ac6a57f35ac6267c5c9f0e387e2261db6382d6e76530ff1017cc5dd167e6bf164653cadc5330141012a069c56708e534a18af8c11c17b980df8a7c5707003535fb0e2ecddc5bbe274b063e6a78f4f389c8487fe0854fce4833742da6051be92bfa7936afe501def65730234467ca76c5c87548879d0623efe177bcfaecb51593f0e3db18a9ebb6e4204f7d4917f8cbf4fcb834f8c32c7b55ed5d1a6aee5318575f81751f25fc2bb303b472a3591158d41f1688adac99fe3c997052b6e27d3092aeac16796caf375e54cc96ba5caa3fb17f16b162e1590cb6a3c41e738dcb92ea088ad1a75aaf0282a796494adeda2f5bbfc1a34c70f2d5c90ce3423c3e964598d46933fe7db07fd05582a6fb3b09b7ecd6e762785df5326313af0a8da8e88ef846d4685d3feb0b8b8a87b52ae5ea75eb069053502fcd5b651f41eef30ee584c05f0eaa6ff47a15333361eb3556a474d8d9606562265a768dc80825440ce0b7452c823382859b2c55b1d78f0516bbcc0caa074745949cbbd696a8bc30fa8346c44cf0d56a1a18b8e35f1a75a55521683910f4ec91085571ad10b05607908200a90d831a880f2c5f0031458bd11250d2a2749ca5494e488f600253aeda16b0beb514e958a1adf19346852948c1b1c294013eb8289461b8d7e9f1124ec043d2951c2fa509394243c8af3382bf0021840482f3081d341f2ec281df5bef66edb7cab9792888d62ebabde4924675f7a98b9d71e42264ba1e1392d38ccb886c242d3b4a7bfec24f3cf5eeed30cdca98ec9dad9979f95a387efcbed26ff7308bc9c6f4dd7e8b5798ceb6a39598c177b62a0f2f14ee913466134ce9f83b3fe6c728faabb2f0ceae9ea10cdb8e052c2e7604e16f3fbefb37d8fa20d0a3b9226b4b98e329885b8c49eb5e7fb0da676a1ea99a6061151a7b8cf000c170fe5745397b1fd6e1eb9ca4f25a6452b5366d50ad0a5bcf39a1d49a8d20e58b53208ed65d5a6867cea2c640f2453456a1cadde4fea3fc0774d0f943b1d775f3032757260a9d51da97acc3ac290b13b3cee8b4de7540e3ce11eed6c63fb63d23996c314fe8d906f807ce851e99ccb3a55b0d97f0e4424333007787420589d2db2ed18167b0666aa2cda2bf55a8843118924c131b9c066bb0e28ccea4de8bc409264c1da247142be5892e44f0adc237168512093248b29e24b26c913477d9924c902be489264d15ef94e923c66fba89e65bce630daa63f49b05f19628f945d137b3fdbdc1e736b983179b01b4362668729b1998061de74640387d64345397f988ccb311b57ecb699c7eef7db1d1f6b90f680803ab03e26b88eac02bba4de4fd6452a74c803abc0f18b4dbeaaf4e234818046bf6836c4c12e1bb03fb6553671969ba382f6c842bf8abbd5f6776dc7209af0cb9642c46e6e5cc39daeb6e386474c9ced4bb0111ab707a814752aa5b5444085a60057a3af658aacebf2cb0ec7f40bd024c794c59636530b7fcf91d1f5e0f2366583c6d0d94cd03f1eb06ed067fe155e8dea3959f0fe59ff64f8eeef6b2763084fe183d1b8663f32cd5a2bdc03987593c19bd15413f16110789d2219b4a365c12660558554f4d8892d1e600e32b26409d432c224ca26bec178d857596cbab4a441a6ac8340c454b933cc870ab899d3ed2a204d882add98d0b2de82d9d2162bb6f5da80269069d74622c30008228d1b32dc0ce02e447982af276d454a4257c205a4282805c7b5f2d8aeb4c2cd14ae6254e6ad5488822f40af5241e22f600d24a2068d8912a4ec44331fa4f969ea83f4291a03025b797401fc16a55ac94c983c374eb7a80fd483945f9a77af58d325eb86fc70b8aced52f3305e4326778ab88256752e0fae8603d66d18bbc5fba90be0663b8e604c4de76e17844f1e70ab41e0ffc75a9c0abf6fea3ec10621d3c0cd6dca03a8bb7acea088385236c35992b274e238780a9420fe08624e4be9424ed2faba46ac8a16e62fafb2a90b860d79b4a6d81001319bbae9020df387c36153dd41ebc3c6439196e00f799a2c71410346ce0b8f80a7494b5292262d49519ab42445c98cc491bcf6b0920dd24b4429ae376841c24e74ea92e6a75397f429c55a9261f2ec38eda4ae7e7a848757524b1489281236d68d8c4a64d44ba4597b398122dc8c9883cff7d5f21fe568b29857f7c7756366b3ff4d1f2677d32a756ab59e7c378d139ff2c080df5aa5e1941caef1a9051474ec233e7886db66a4ef4a91da1ab03c299a66fde6ce707df38dc2883fd0ef6d9697f5d5a20301e7b3ef7dce82f47880477fe1f84cc4461d5cfce003065d1e0e152f85743de54d96b334e54dd949f9ad5a6e13947b63030296e8d80d1dee59d8cd7df50e383ebb70db4317df1eae571f8e8195818b3d2f3d3171d7fb3696c0ee0713e060b415dc21747e19fcead331fdfb878a8d16b3bbe5e233f6287c5f2d1f26b713dc5e43a3bbad385b56e574f207ee5a0fd510570a08ab8e25b148c14b188d375169e3ea7af9bc9a574b80267d30113703f16b168f85394645bce3ff9ef19542ff075513d2da0a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353231303430312d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353432203030303030206e200a30303030303034333539203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353939203030303030206e200a30303030303032373234203030303030206e200a30303030303032383534203030303030206e200a30303030303032393837203030303030206e200a30303030303033313234203030303030206e200a30303030303033323437203030303030206e200a30303030303033333736203030303030206e200a30303030303033353038203030303030206e200a30303030303033363434203030303030206e200a30303030303033373732203030303030206e200a30303030303033383939203030303030206e200a30303030303034303238203030303030206e200a30303030303034313631203030303030206e200a30303030303034323633203030303030206e200a30303030303034363037203030303030206e200a30303030303034363933203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c43313145414244313138454343324234334331443044463937344334413935463e203c43313145414244313138454343324234334331443044463937344334413935463e205d0a3e3e0a7374617274787265660a343739370a2525454f46	Comprobante_Multiple_000112.pdf	application/pdf
115	98	2.00	2026-01-15 21:12:52.355483	EFECTIVO	9	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\N	\N	application/pdf
114	84	2.00	2026-01-15 21:12:52.21831	EFECTIVO	9	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323330300a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb6e1bc915ddf32b0ac82c12c02ad7fba15d5ba2040f2451b1e8c0db36d9b269f021505402f86bf20ff99bfc81d7b3cb2aa7baf96852b764d11c0a3384445ef7b975dff71405b7ce8bd68f64ffea0876d979d7efbcbd504c06d6bfef28c15ddcfad1ac7fd5115c2ac5f0ea245e95746cfea5237de0c6b744430ccc07cb65f42238278df45ad9e0587fd8f9ebef1f6ffa053befb2e2f263c16e7bfde2dd55f76facffadd3edaf75304907e9b8d852c1c74607a513ba4d2fd1d9a4823250614b14aa7967b9b6c63a1755945a07ab7cadc25d71f37b715b5cbf2b7670f17cc00aaeb79e15a1788235e9e4c6f8842d540dab544268494acdbc955c861a2f28e7bd8c5135b0e5f45bf9504e3e976fd8d9d7d1e4f36c5e7e9fbd61ddc153399ccd0fd5c548aeda923839f33af26094b7360a6ba50c22c85a977e35fe713f9bce4e998567f5c9a74f9fd2ff9f564a081e124230e9c5b10f971dc96b37aaa08dab6d6a103746c10dd1052b74d488aa00cf7918054221c810a277da7b3c65d2b15671ef8496263ae1540a12e847c98e3b77eb40c0716185c0f596115228e582d16a2e6ddb60380894e500316aa5acf54d249cf5ae6f3ff4de1537fd6e0ac9dbe2b2c7aeff7bd57f7fbb1393924951ab22b9cd7ac04b8e63b53ca034430000ba31be94426985fc02f2cd8cb3947cd2ece5772af42db7be25ac91c1ce398eb45b79c6a5ff6a58c52e8ab3fec70fc55d3a6c715edceda61ee203f88abb2dfc95c59395f16a2d5e131014a062c06905e738a584f1ca1811bc87d9807f5ef47b7730f5152b2ede5fbd2fce7b3b667ef9f884c34978e88f40c55f3e7823a40d16e52bf97b3caaa68bea742f9b13a031e23765e33aa442cc8316d3925dcd1eaaef871e5545cf5d3b13827be9ac3f864fe3f2e0a3a2be71ad9705b4296879cc14e1280e3ec463b815f6e64068422a1a83aad154b3b33f86a32f3356dc8fc62394d283cf2c95e7eb9299ce64a5caa387a3f8350b972ac775351ca1651cee5c1750bd961d3a9576782f8f2cf17314bf06cdf1c70a2e48679a59e17c34af0683d11fd3ed83fe022c95b059d8bf3f8d16b3a3d445cc0a3caa550bc46fc236b3c179b75f5c5dd54d2857a053f1dfd4fe1a017e5af54d341bef30df588c01f0e6a6e147a153f7351ec354ea3f4d519606d62165c7e8d480825440ae0bb44ec823282859b2a75b1d78f0516b3cc0caa074745949cbbd696a8ac31fa8306c400f0a56a1838b9635f151ad2a298b49c807a76488c22b2d70eadaf21080f791d031a880b2c5f00714583e11a50c2a2749ca5494e480f600253aeea04d0beb5146958a1abf19746452948c1b1c294013eb8289461b8d069f1124ec043d2951c2fa509394243c8af3382bf0001840482f3072d341f2ea281d74be76ee57f9566f21112bc4d64fbd8448cebe743064af3d840c9642c3735a7098710d850da6694b7fd949e69f3ddca7a1b7551593b5b30fbf28078ba779b927041eceb7c669f4d83cc66d351fcd86bb35e96718a878bc55f284519885f3e7e0ac3b193da2daee0b833aba3c443326b894f03998b3d9f4f169b2ef51b4414147d28455aea30c6621aeb158edf97c83315da87a96a94144d429ee3300fdd9a21c6fea32d6ddcd4baef2538969d1c29459b6027427efbc662712aaac06ab5a1984f6bc5aa5867ce92c64ef2353456a1cad5e48ea0fe0bba6f7ed36f87dc1c8d4c981a55677a2eaf1ea04cb903e109bcea91c78c23d91ea404c3ac77298c2bf15f22d90dda1b064ce659d2ad8e43f0722921998033c3910acce16b9ea1816fb0566aa2cda6fea8d10872212498263728155761d5098d19bd039429264c15649e2843c5a92e44f0adc137168512093248b29e23193240b7bac24c9021e2549b2685b49f29cdea37a96f19ac3689bfe24417765983c5276cde4fd6c637b4ea661c6e4c16e0c89991da6c466024a79d3910d1c5a0f15e574311a964336acd87d338f3deeb7333ed720ed010175607d4c701c5905b62bc24fd7452a74c803abc0f1c6265f557a709a40c09b5f351b626f9705d81fdb2a9b48cacd51417764a17f33bbd5f6cfda8e4130e1cd1567889ddcb8862c5d6ec70d719848da63b0101ad705a814752aa5b5444085a6005783af658aacdbf2cb0eb7f40bd024b794c59636530bff9c23a3ebc1e5ab940d1a43673341ff5860dda0cffc2b7c1ad573b2e0dd8bee59fffd3fd64ec6109ec207a371cd7e649ab55620fecdbac9e0c968aa89f83008bc56910cdad1b26013b0aa422a7aecc4162f600e32b26409d432c224ca26bec178d857596cbab4a441a6ac8340c454b933cc870ab88ad3ab55409a1055ba22a165bd05a3a52d566cebb5014d20d3ae8d44860110441a5762b80ac0e587f204414fda8a9484ae840b4851500a8e6be5b15d6985ab28dcbda8cc53a910055f805ea582c427600d24a2068d8912a4ec44331fa4f969ea83f4291a03025b797401bc8b52ad64264c5e1ba75bd407ea41ca2fcddb77aae95675437e38dcceb6297918af21915b455c41ab3a977b37fd1e6b378cdde2fdd28d6fb31d4730a5a675990bc2270fb8d520f0efb116a7c2ef9bba4fb041c83470739bf200eaae9e3328228e94cd7096a42c9d380e9e0225880f41cc69295dc8495a5fd78865d1c2fce5553675c1b0218fd6141b2220665337dd9861fe70386caa3b687dd87828d212fc214f93252e66c0c879e111f03469494ad2a425294a9396a42899913892d71e56b2417a8928c5b5062d48d8894e5dd2fc74ea923ea5584b324c5e1da7add4d52f8ff0f04a6a89221145c2c6ba9151898c7a89345b5d4aa008372366eff36335ff673918cda6d5e369dd98d9e47fe3c5e8615ca54eadd693efa671e26b1d18f05756693825877b7b6a01051dfb8c0f9ee07a19e9bb54a4b6062c4f8aa659bfb92b5c5f75a330e203fab9cdf2b2be527420e07cf6b9af59909e0ff0e82f1c5f82d8a8830b1f7ca3a0cdc3a1e2a590aea7bcd17c92a6bc313b2bbf55f36d82726f6c40c0122dbba1c3bd0abbb9a0de01c79715ee3be8e2dbc3f5f2db30b03270b1e7a5574cdcf5be8d25b0fd4d0438186d057708ad37835f7e1da6fbb8a8d860367998cf3e638fc2efd57c31ba1f0d4a068d1eb6e26c5e95e3d177dcb11eaa21ae1410562d4b62918297301a6fa2d2c6e5b5f26535ade6004dfa60226e06e2372c9e2a796a0c7be0ff9ef0a542ff07f2cfce520a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353231323134342d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353235203030303030206e200a30303030303034333432203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353832203030303030206e200a30303030303032373037203030303030206e200a30303030303032383337203030303030206e200a30303030303032393730203030303030206e200a30303030303033313037203030303030206e200a30303030303033323330203030303030206e200a30303030303033333539203030303030206e200a30303030303033343931203030303030206e200a30303030303033363237203030303030206e200a30303030303033373535203030303030206e200a30303030303033383832203030303030206e200a30303030303034303131203030303030206e200a30303030303034313434203030303030206e200a30303030303034323436203030303030206e200a30303030303034353930203030303030206e200a30303030303034363736203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c43314238463344373045394244374436423346344136314237424636424331463e203c43314238463344373045394244374436423346344136314237424636424331463e205d0a3e3e0a7374617274787265660a343738300a2525454f46	Comprobante_Multiple_000114.pdf	application/pdf
116	83	2.00	2026-01-15 21:21:58.477118	EFECTIVO	11	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323331330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55a4b6e1b4912ddf314094c2f66002b9dff8f76658912dc9044c1a207ded254c92e831f819267307d9ab943dfa66fe075ef7ad52fab5864918a9445d314ba09890cd78b8c7fbca4e0d679d1f991ecbf3dc1ce7b6f86bdd7678ac9c086773d25b88b1b3f9a0d2f7a824ba5185e9dc4ab928e2d3ef5a40fdcf88e688881f960b98c5e04e7a4915e2b1b1c1bdef6fef9ebfbab61c14efbac387f5fb0ebc1b07873d1ff171b7ee9f5872b1d4cd2413a2e3654f0b1d141e9846ed34b7436a9a00c54d810856ade59aeadb1ce4515a5d6c12a5fab70535cfd5a5c17976f8a2d5c3c1fb082eb8d6745289e604d3ab9313e610b55c32a95103a9252336f2597a1c60bca792f63540dec68f665743f9a7e1cbd62279fabe9c7f962f4dbfc15eb8fbf8e6ee78b7d753192abae244ecebc8e3c18e5ad8dc25a298308b2d665584ebeddcd67f36366e1597df4e1c387f4ff875609c143420826bd38f6eebc2779ed4615b471b54d0de2c628b821ba60858e1a5115e0390fa34028041942f44e7b8fa74c7bd62aee9dd0d244279c4a4102fd28d949ef661508382eac10b8de30420aa55c305acda5ed1a0c0781b21c2046b5ca5adf44c2c9e0f2fadde04d7135eca790bc2ece07ecf28f8be1dbebad98944c8a5a15c96dd6035e721cabe301a5190200d08df1a5144a2be41790afe69ca5e4936e27bf53a16fb9f51d618d0c76ce71a45deb1997feab61153b2b4e86efdf1537e9b0c56971b39d7a880fe02bee36f05b8b272be3d55abc26202840c580d30ace714a09e3953122780fb301ffb4180e6e60ea0b569cbdbd785b9c0eb6ccfcfcf1098793f0d01f818abf7cf046481b2cca57f2f7a42a678fe5f14e36274063c46fcac6554885f80ce868312d27d56cc44e46ff43fa97ec64df43abe8b9ebe64470cf9dfadbedd7c968ef43a3d271ad97a5b4296d794ce184d5da59150ee160589e239b9ae08ac6a07e3475ede4cfdbead39c1577d5a44251ddfbcc5279be2a9e297fad547974290ee2d82c5e2a2297e56d85eeb1bf775d40215b36eb54e55158f2c81a817010c706cdf1470b17a433cdd8705a2dcaf1b8fa73b679d01f80a572370bbbeed907a993981d78546d4bc46fc236b3c2697f585c5cd44d2957b0533358f7821a01ce6afb289a8f7798772cc602b8743d0044a15337361ec355ea474d91960626226527e8dc80825440c60bb452c823322859b2c75b1d78f0516b3cc0caa074745949cbbd692a8bc31fa8336c4c0f0e56a1a38b8e35f151ad2a298bc9c807a76488c22b2d70eadaf210400820ad635001c58be10f28b07c220a1a544e9294a928c931ed014a74d243db16d6a3982a15357e33e8d0a428193738528026d605138d361a0d3f2348d8097a52a284f5a12629497814e77156e0013080905e6004a783e4c5513aee7deeddb5f9566f25112bc5c64fbd9448ce3ef53074af3c84349642c3735a70987105858da6694effd84ae6ef3ddca721b8531a93b5b30f3f1b8d1fbf2eb6ebc5f720f070be315ea3c0e631aecb4535bf9def8881b2c73b754f1885d9387f0ecefad3ea012577571814d3e5219a61c1a584cfc19ccc670f5fa7bb1e451b5475244d68731d65300b7189456bc7e71b8ced42d5134d0d22a24e719f0118ce1f4793755dc6fabb7ec9557e2a312dfa9832cb568016e59dd7ec48429576bcaa9541682fca3635e47367211b20992a52e368f582527f00df350d506eb5db5dc1c8d4c981a55677a4ea21eb08cbd1f684b12b369d5339f0847b24f7c5a4732c8729fc6b215f0379730bfc015832e7b24e156cfafb9e886406e6008ff604abb345b61dc362cbc04c9545fb45bd12db93f8cf48121c930bacb6ab80c2a0de84ce0192240bd6268913f26049923f29708fc4be45814c922ca688874c922ceca192240b789024c9a26d24c953ba8fea59c66b0ea3adfb9304fd9561f648d915b3f7bdb5ed29b986199307bb3624667698129b0928e6754736706843b9cc1eabdbd12dbb2dd95d338f3decb6383ed520ed01017560754c301d590536b3f2bbeb22153ae48155e078639daf2a3d384d20e0d12f9a0d71b04d05ec8e6d954da4e5faa8203db2d0bf98ed6afbb3b663d04c78b3e510b1981bd790a7cbedb8211213697b082a02e41547a5a85329ad25022a3405b81c7f1ea5c8ba1e7dda62987e009a6498b2d8d2666ae1cf3932ba1e5cdea66cd0183a9b09fadb23d60dfacc3fc2aa513d270bde3feb9f0cdffe7be5640ce1297c301ad7ec47a6596b858b00b36a3278329a6a223e0c02af53248376b42cd804acaa908a1e3bb1c50b98838c2c5902b58c3089b2896f301ef655169b2e2d699029ab20103155ee0cf3a102aee674bb0a4813a24a5726b4acb7a0b5b4c58a6dbd36a00964dab591c830008248e38a0c5703b80c519e20ec495b9192d0957001290a4ac171ad3cb62bad703585bb1895792a15a2e00bd0ab5490f804ac8144d4a0315182949d68e683343f4d7d903e456340602b8f2e807751aa95cc84c94be37483fa403d48f9a579f78e35ddb2aec90f87dbda2e310fe3354c72a7882b6855e7f2e06a3860dd86b15dbc9fbb016eb6e308bad4742e7741f8e401371a04fe3dd6e254f87d53f709360899066e6e5d1e40ddd5730645c491b219ce9294a513c7c153a004f12188398d5bba9093b4beae11cba285f9cbab6cea8261431ead28364440cca66eba41c3fce170d85477d0fab0f150a425f8439e264b5ccf8091f3c223e069d29294a4494b5294262d495132237124af3dac6483f412518abb0d5a90b0139dbaa4f9e9d4257d4ab1966498bc384e3ba9ab9f1fe1e195d41245228a848d7523a31219f51269d6de4ca0083723e6e0e343b9f8cf685ccd67e5c371dd98d9f4afc963753f2953a756abc977dd38f1350f0cf8ad551a4ec9e11e9f5a4041c73ee183a7b86e46fa2e15a9ad01cb93a269d66f6e0c5757df288cf8807e6eb3bcac2e161d08389f7dee4b16a4a7033cfa0bc79722d6eae0d607df30e8f270a87829a4eb29af5a4cd39437c1aded9772b14950ee8c0d0858a2633774b817613717d65be0f8f2c25d0f5d7c73b85e7e3b0656062ef6bcf48a89bbdeb7b10476bf990007a3ade00ea1f366f0cbafc7f41f1e4b369e4fef17f38fd8a3f07bb978aceeaaf18841a3fb8d385b94a349f51b6e5af7d510570a08ab8e25b148c14b188dd75169e3f272f9bc9c950b80267d30113703f12b168f953a1682ddf3ff4ff952a1bf01e7fcd3d90a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353231323230302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353338203030303030206e200a30303030303034333535203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353935203030303030206e200a30303030303032373230203030303030206e200a30303030303032383530203030303030206e200a30303030303032393833203030303030206e200a30303030303033313230203030303030206e200a30303030303033323433203030303030206e200a30303030303033333732203030303030206e200a30303030303033353034203030303030206e200a30303030303033363430203030303030206e200a30303030303033373638203030303030206e200a30303030303033383935203030303030206e200a30303030303034303234203030303030206e200a30303030303034313537203030303030206e200a30303030303034323539203030303030206e200a30303030303034363033203030303030206e200a30303030303034363839203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c30463239443746423832464137354343433646353039353331423136424241323e203c30463239443746423832464137354343433646353039353331423136424241323e205d0a3e3e0a7374617274787265660a343739330a2525454f46	Comprobante_Multiple_000116.pdf	application/pdf
117	97	2.00	2026-01-15 21:21:58.539855	EFECTIVO	11	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323331330a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55a4b6e1b4912ddf314094c2f66002b9dff8f76658912dc9044c1a207ded254c92e831f819267307d9ab943dfa66fe075ef7ad52fab5864918a9445d314ba09890cd78b8c7fbca4e0d679d1f991ecbf3dc1ce7b6f86bdd7678ac9c086773d25b88b1b3f9a0d2f7a824ba5185e9dc4ab928e2d3ef5a40fdcf88e688881f960b98c5e04e7a4915e2b1b1c1bdef6fef9ebfbab61c14efbac387f5fb0ebc1b07873d1ff171b7ee9f5872b1d4cd2413a2e3654f0b1d141e9846ed34b7436a9a00c54d810856ade59aeadb1ce4515a5d6c12a5fab70535cfd5a5c17976f8a2d5c3c1fb082eb8d6745289e604d3ab9313e610b55c32a95103a9252336f2597a1c60bca792f63540dec68f665743f9a7e1cbd62279fabe9c7f962f4dbfc15eb8fbf8e6ee78b7d753192abae244ecebc8e3c18e5ad8dc25a298308b2d665584ebeddcd67f36366e1597df4e1c387f4ff875609c143420826bd38f6eebc2779ed4615b471b54d0de2c628b821ba60858e1a5115e0390fa34028041942f44e7b8fa74c7bd62aee9dd0d244279c4a4102fd28d949ef661508382eac10b8de30420aa55c305acda5ed1a0c0781b21c2046b5ca5adf44c2c9e0f2fadde04d7135eca790bc2ece07ecf28f8be1dbebad98944c8a5a15c96dd6035e721cabe301a5190200d08df1a5144a2be41790afe69ca5e4936e27bf53a16fb9f51d618d0c76ce71a45deb1997feab61153b2b4e86efdf1537e9b0c56971b39d7a880fe02bee36f05b8b272be3d55abc26202840c580d30ace714a09e3953122780fb301ffb4180e6e60ea0b569cbdbd785b9c0eb6ccfcfcf1098793f0d01f818abf7cf046481b2cca57f2f7a42a678fe5f14e36274063c46fcac6554885f80ce868312d27d56cc44e46ff43fa97ec64df43abe8b9ebe64470cf9dfadbedd7c968ef43a3d271ad97a5b4296d794ce184d5da59150ee160589e239b9ae08ac6a07e3475ede4cfdbead39c1577d5a44251ddfbcc5279be2a9e297fad547974290ee2d82c5e2a2297e56d85eeb1bf775d40215b36eb54e55158f2c81a817010c706cdf1470b17a433cdd8705a2dcaf1b8fa73b679d01f80a572370bbbeed907a993981d78546d4bc46fc236b3c2697f585c5cd44d2957b0533358f7821a01ce6afb289a8f7798772cc602b8743d0044a15337361ec355ea474d91960626226527e8dc80825440c60bb452c823322859b2c75b1d78f0516b3cc0caa074745949cbbd692a8bc31fa8336c4c0f0e56a1a38b8e35f151ad2a298bc9c807a76488c22b2d70eadaf210400820ad635001c58be10f28b07c220a1a544e9294a928c931ed014a74d243db16d6a3982a15357e33e8d0a428193738528026d605138d361a0d3f2348d8097a52a284f5a12629497814e77156e0013080905e6004a783e4c5513aee7deeddb5f9566f25112bc5c64fbd9448ce3ef53074af3c84349642c3735a70987105858da6694effd84ae6ef3ddca721b8531a93b5b30f3f1b8d1fbf2eb6ebc5f720f070be315ea3c0e631aecb4535bf9def8881b2c73b754f1885d9387f0ecefad3ea012577571814d3e5219a61c1a584cfc19ccc670f5fa7bb1e451b5475244d68731d65300b7189456bc7e71b8ced42d5134d0d22a24e719f0118ce1f4793755dc6fabb7ec9557e2a312dfa9832cb568016e59dd7ec48429576bcaa9541682fca3635e47367211b20992a52e368f582527f00df350d506eb5db5dc1c8d4c981a55677a4ea21eb08cbd1f684b12b369d5339f0847b24f7c5a4732c8729fc6b215f0379730bfc015832e7b24e156cfafb9e886406e6008ff604abb345b61dc362cbc04c9545fb45bd12db93f8cf48121c930bacb6ab80c2a0de84ce0192240bd6268913f26049923f29708fc4be45814c922ca688874c922ceca192240b789024c9a26d24c953ba8fea59c66b0ea3adfb9304fd9561f648d915b3f7bdb5ed29b986199307bb3624667698129b0928e6754736706843b9cc1eabdbd12dbb2dd95d338f3decb6383ed520ed01017560754c301d590536b3f2bbeb22153ae48155e078639daf2a3d384d20e0d12f9a0d71b04d05ec8e6d954da4e5faa8203db2d0bf98ed6afbb3b663d04c78b3e510b1981bd790a7cbedb8211213697b082a02e41547a5a85329ad25022a3405b81c7f1ea5c8ba1e7dda62987e009a6498b2d8d2666ae1cf3932ba1e5cdea66cd0183a9b09fadb23d60dfacc3fc2aa513d270bde3feb9f0cdffe7be5640ce1297c301ad7ec47a6596b858b00b36a3278329a6a223e0c02af53248376b42cd804acaa908a1e3bb1c50b98838c2c5902b58c3089b2896f301ef655169b2e2d699029ab20103155ee0cf3a102aee674bb0a4813a24a5726b4acb7a0b5b4c58a6dbd36a00964dab591c830008248e38a0c5703b80c519e20ec495b9192d0957001290a4ac171ad3cb62bad703585bb1895792a15a2e00bd0ab5490f804ac8144d4a0315182949d68e683343f4d7d903e456340602b8f2e807751aa95cc84c94be37483fa403d48f9a579f78e35ddb2aec90f87dbda2e310fe3354c72a7882b6855e7f2e06a3860dd86b15dbc9fbb016eb6e308bad4742e7741f8e401371a04fe3dd6e254f87d53f709360899066e6e5d1e40ddd5730645c491b219ce9294a513c7c153a004f12188398d5bba9093b4beae11cba285f9cbab6cea8261431ead28364440cca66eba41c3fce170d85477d0fab0f150a425f8439e264b5ccf8091f3c223e069d29294a4494b5294262d495132237124af3dac6483f412518abb0d5a90b0139dbaa4f9e9d4257d4ab1966498bc384e3ba9ab9f1fe1e195d41245228a848d7523a31219f51269d6de4ca0083723e6e0e343b9f8cf685ccd67e5c371dd98d9f4afc963753f2953a756abc977dd38f1350f0cf8ad551a4ec9e11e9f5a4041c73ee183a7b86e46fa2e15a9ad01cb93a269d66f6e0c5757df288cf8807e6eb3bcac2e161d08389f7dee4b16a4a7033cfa0bc79722d6eae0d607df30e8f270a87829a4eb29af5a4cd39437c1aded9772b14950ee8c0d0858a2633774b817613717d65be0f8f2c25d0f5d7c73b85e7e3b0656062ef6bcf48a89bbdeb7b10476bf990007a3ade00ea1f366f0cbafc7f41f1e4b369e4fef17f38fd8a3f07bb978aceeaaf18841a3fb8d385b94a349f51b6e5af7d510570a08ab8e25b148c14b188dd75169e3f272f9bc9c950b80267d30113703f12b168f953a1682ddf3ff4ff952a1bf01e7fcd3d90a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303131353231323230302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353338203030303030206e200a30303030303034333535203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032353935203030303030206e200a30303030303032373230203030303030206e200a30303030303032383530203030303030206e200a30303030303032393833203030303030206e200a30303030303033313230203030303030206e200a30303030303033323433203030303030206e200a30303030303033333732203030303030206e200a30303030303033353034203030303030206e200a30303030303033363430203030303030206e200a30303030303033373638203030303030206e200a30303030303033383935203030303030206e200a30303030303034303234203030303030206e200a30303030303034313537203030303030206e200a30303030303034323539203030303030206e200a30303030303034363033203030303030206e200a30303030303034363839203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c30463239443746423832464137354343433646353039353331423136424241323e203c30463239443746423832464137354343433646353039353331423136424241323e205d0a3e3e0a7374617274787265660a343739330a2525454f46	Comprobante_Multiple_000116.pdf	application/pdf
118	124	2.00	2026-01-25 11:14:19.140348	EFECTIVO	17	1	[PAGO MÚLTIPLE 1/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323332310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb4e1b4b1adefb294a9a2c6624a8d4fdc2ae01837204180567946dc76e1247be4486cc68ced3cc3bccdbcc1b647d76b39aafbaed76dbfc45707c20a485ed5ff5fdf75b5970ebbce8fc48f6cf9e6097bdd361efed856232b0e17d4f09eee2d68f66c3ab9ee0522986a793782ae9d8f2734ffac08def908618980f96cbe845704e1ae9b5b2c1b1e1b8f7d7df3edc0c0b76de67c5e58782dd0e86c5e955ff6f6cf8b5d71fb63c98c483745c6cb1e063c383d209dda6477436b1a00c58d822056bde59aeadb1ce4515a5d6c12a5fb37057dcfc56dc16d7a7c50e2ece07ace07aebac08c613ac49921be313b65035ac5209a1432935f35672196abca09cf73246d5c096f3afe5b772f6a93c62675f26b34f8b65f9fbe288f547dfcbf16279282f4672d5a584e4ccebc88351deda28ac953288206b5e86d5f4c7fd62be38611696d5c71f3f7e4cff3fae99103c248460d2c3b1f7973dc96b33aaa08dab756ae03746c10cd1052b74d4f0aa00cb7928054421c810a277da7b9c32eb59abb877424b139d702a3909f8a368a7bdbbd611202eb410b8de524272a59c335acda5ed2a0c8280590e10a3d6cc5adf78c2d9e0faf6fde0b4b819f6934bde16970376fddfabe1bbdb1d9f944c8a9a15c96dd6025e7288d5b180d20c0e00e846f9520aa515e20bc8370bce52f0c9b097dd29d7b7dcfa0eb146043be738c26e6d19977e6b58c52e8ab3e187f7c55d12b6382fee76430ffe017cc5dd16fe5ae349cb785a8b67020203940f38ad601ca794305e192382f7501bf0cf8be1e00eaabe62c5c5bbab77c5f96047cdcf8b4f189c8407ff7054bcf2c11b216db0485fc9ded349357fac4ef6d239011a23fe5236b62e15621ef474f9af728e882f97a3c5a1d2aae8b9eb064370cf89fb63fc7d5a1e2c2d521cd77a95439b9c96c7144ee017ffe26b58162ae708a3c6aba231481c4d423bfb633cf9bc60c5fd643a41363d5866a93c6fb3660a5c2b551e5dda57316c162f658feb6a3c41d938dcba2e2083adaa744aefc8287964e4ac8365250d1b34c78b355c90ce34fdc2f964598d46933fe6db82fe022c15b45958146b56ccc7cbeae15512249a061ed5ba16e22f619b26e1bc3f2caeaeea6a94cbd4a90a6c8a408d0063ad0b28aa8e7768742cfa01987453f9a3d0a90c1b8fae2a15a2263b4b031591b453946c40812a20e211cf06f4f00c8a962cee56071e7cd41a075819948e2e4b69b9374d667178813cc34674c760154ab9e868131fd5ac92b468897c704a8628bcd20252d79a07015c00611d830a485e0c2fc0c0ea442434b09c282955519423da0214e9b4877a2dac4732552a6afc65509a4952d26f20520027d605138d361a953e4348e8097c52a484f6c12649495814f2382b70001420a417e8bd692779b1978e7a5f7af7eb78abc791885962eba79e4624679f7be8b65b0b218ca5d0b09c161c6a6ca130ca34c5e92f3bc1fcb3c37dea7e3ba931693b7bf845397afcbe2cf784c0e17cabaf46a5cd63dc56cbc962bcdd46fc1c03698f77f29e300a4d715e0ecefab3c90352eebe3048a62b219a66c1a580cfc19c2de60fdf67fb8aa20db23a8226ac631d69300b718d096bcff30dfa75a1ea8ea606115127bfcf000c178fe574939731f76e1eb9cc4f05a6451d5366550a50a2bcf39a1d4bb0b26eaf6a66e0dacb6a1d1af23959c80248868ad410ad9e4cea0f60bba600ca9d72bb2f18193a39b054ea8e95504ea8630c45fa406c3aa672e009f758a80331e918cb6a57bc15f26d423e14968cb93c2c9bfde7404432027380c70782d5d122d715c362ca404f95457ba38e84381491081288c90566dad6a1d0a837aef30a419205db0489469088570992bca475901c8a4906491ed3bc66906461b1c37b9520c9021e1e24284fdd20f1e8d3b3686fa43db26d943c5df45145cb78cda1b54d8192587c65767a246dbbd3fbd9dcf674ad86269307bbd1249a76e812a30996cb9b926c60d1baab28e78f93713966e38add370dd9c37e93e3530ed2201090085a31b1eac832b09d127e3a2f52be430aac02c71b9b8055e9e0d48260837ed58c8883dd5dc0fed8b03c37ba2b2a167759ec37d2775ce94f1d90b169c29bebfd216673e39ac5e96a406e96886961fb1adb088dab03248b3a9ad26422c0429383abd19732f9d66df97967c9f40bd0e492298bad6c261dfe3922a3f0c1e8eba00d1a59a469a27f3c62e2a065fe95c51a5576b2e0fd8bfed9f0dddf5b2323d125f741775c2f4032f55a2b5c0298b6cee064d4d5b4fb3070bc4e9e0cdad1b45828605a0555f4188b2d1e581e6468c924a81147d8a4d9b472301efa5516c32e4d691029ad1388983a9cccf243055ccbe9f534204d882a5d97d0b4de62b3a52da66cebb5c1a640a6711b910c05c08934aec7702d808b10e589653da92b9212bc12262049b155705c2b8f014b2b5c4be11e46654ea55c142b03542b15243ec1e240c26b509a28424a4ff4f283543fbdfd206d8ad200c7561e7500ef22592b99719397fae9d6f603f920c597e6ddfbd574c3bad97f38dcd47677f3505eb34c6e0b08b65de0aa8ee5c1cd70c0ba256337793f77fbdb0cc8c17088d05eec4ae761c21ce07685c001188d53e6f74de22736420835ece736f901ebbbbad5a09671246d666f49d2d291e3602aac05f12196735a4a177294d6d7496295b530a878958d5d6cd91048ed9a0d2e10b3b19baecfd08238089b120f6a1fa61e6a71891d224fdd25ae68b095f3c2c3e3e9c52549492f2e49527a71499292210991bcf6d0920dd24bb829ee376842424f74ec92eaa76397b429b5b924dde4c57eda895dfd7c1b0faba49a28d2b248d85857322a9291301167ebdb0964e1a6cb1c7c7aa896ff284793c5bc7a38a92b339bfd6ffa38f936ad52a9566df3bba99cf88e077afcb5569abd92c3253e35846225fb64273cc35d33c277c548ad0d689e244ded7e736bd8de7b2333e203fadc66ca6f2f171d96703e7bee4b86a4a73d3c0a0cc7372236ece0e6075f2fe8eee290f2924bd76dde64394b6dde949d955fabe5eeb5ed9ed88080263a7a43897b1176735bbd038e6f2edcf750c6b7bbebd55763a065e062d64b4fb4dcf5cc8d41b0fbb50418187505f7089d37835f7d37a6fff058b1d162f66db9f884510a7f57cbc7c9fd64543270f46dcbcf9655399dfc8edbd64339d4c8575d65424f1823a03f14f8b557dab8ba60beace6d512a0891fb4c44d477c04fa13694e946025fff78caf38fa3f9ea9d2300a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303132353131313432302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353436203030303030206e200a30303030303034333633203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032363033203030303030206e200a30303030303032373238203030303030206e200a30303030303032383538203030303030206e200a30303030303032393931203030303030206e200a30303030303033313238203030303030206e200a30303030303033323531203030303030206e200a30303030303033333830203030303030206e200a30303030303033353132203030303030206e200a30303030303033363438203030303030206e200a30303030303033373736203030303030206e200a30303030303033393033203030303030206e200a30303030303034303332203030303030206e200a30303030303034313635203030303030206e200a30303030303034323637203030303030206e200a30303030303034363131203030303030206e200a30303030303034363937203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c43323332454442334534323830453943393343334241423641354143323035353e203c43323332454442334534323830453943393343334241423641354143323035353e205d0a3e3e0a7374617274787265660a343830310a2525454f46	Comprobante_Multiple_000118.pdf	application/pdf
119	132	15.50	2026-01-25 11:14:19.177357	EFECTIVO	17	1	[PAGO MÚLTIPLE 2/2] | Pago múltiple de 2 facturas	\N	\N	t	REGISTRADO	\\x255044462d312e330a25badface00a332030206f626a0a3c3c2f54797065202f506167650a2f506172656e742031203020520a2f5265736f75726365732032203020520a2f4d65646961426f78205b302030203539352e32373939393939393939393939373237203834312e383839393939393939393939393836345d0a2f436f6e74656e74732034203020520a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f4c656e67746820323332310a2f46696c746572202f466c6174654465636f64650a3e3e0a73747265616d0a789cb55acb4e1b4b1adefb294a9a2c6624a8d4fdc2ae01837204180567946dc76e1247be4486cc68ced3cc3bccdbcc1b647d76b39aafbaed76dbfc45707c20a485ed5ff5fdf75b5970ebbce8fc48f6cf9e6097bdd361efed856232b0e17d4f09eee2d68f66c3ab9ee0522986a793782ae9d8f2734ffac08def908618980f96cbe845704e1ae9b5b2c1b1e1b8f7d7df3edc0c0b76de67c5e58782dd0e86c5e955ff6f6cf8b5d71fb63c98c483745c6cb1e063c383d209dda6477436b1a00c58d822056bde59aeadb1ce4515a5d6c12a5fb37057dcfc56dc16d7a7c50e2ece07ace07aebac08c613ac49921be313b65035ac5209a1432935f35672196abca09cf73246d5c096f3afe5b772f6a93c62675f26b34f8b65f9fbe288f547dfcbf16279282f4672d5a584e4ccebc88351deda28ac953288206b5e86d5f4c7fd62be38611696d5c71f3f7e4cff3fae99103c248460d2c3b1f7973dc96b33aaa08dab756ae03746c10cd1052b74d4f0aa00cb7928054421c810a277da7b9c32eb59abb877424b139d702a3909f8a368a7bdbbd611202eb410b8de524272a59c335acda5ed2a0c8280590e10a3d6cc5adf78c2d9e0faf6fde0b4b819f6934bde16970376fddfabe1bbdb1d9f944c8a9a15c96dd6025e7288d5b180d20c0e00e846f9520aa515e20bc8370bce52f0c9b097dd29d7b7dcfa0eb146043be738c26e6d19977e6b58c52e8ab3e187f7c55d12b6382fee76430ffe017cc5dd16fe5ae349cb785a8b67020203940f38ad601ca794305e192382f7501bf0cf8be1e00eaabe62c5c5bbab77c5f96047cdcf8b4f189c8407ff7054bcf2c11b216db0485fc9ded349357fac4ef6d239011a23fe5236b62e15621ef474f9af728e882f97a3c5a1d2aae8b9eb064370cf89fb63fc7d5a1e2c2d521cd77a95439b9c96c7144ee017ffe26b58162ae708a3c6aba231481c4d423bfb633cf9bc60c5fd643a41363d5866a93c6fb3660a5c2b551e5dda57316c162f658feb6a3c41d938dcba2e2083adaa744aefc8287964e4ac8365250d1b34c78b355c90ce34fdc2f964598d46933fe6db82fe022c15b45958146b56ccc7cbeae15512249a061ed5ba16e22f619b26e1bc3f2caeaeea6a94cbd4a90a6c8a408d0063ad0b28aa8e7768742cfa01987453f9a3d0a90c1b8fae2a15a2263b4b031591b453946c40812a20e211cf06f4f00c8a962cee56071e7cd41a075819948e2e4b69b9374d667178813cc34674c760154ab9e868131fd5ac92b468897c704a8628bcd20252d79a07015c00611d830a485e0c2fc0c0ea442434b09c282955519423da0214e9b4877a2dac4732552a6afc65509a4952d26f20520027d605138d361a953e4348e8097c52a484f6c12649495814f2382b70001420a417e8bd692779b1978e7a5f7af7eb78abc791885962eba79e4624679f7be8b65b0b218ca5d0b09c161c6a6ca130ca34c5e92f3bc1fcb3c37dea7e3ba931693b7bf845397afcbe2cf784c0e17cabaf46a5cd63dc56cbc962bcdd46fc1c03698f77f29e300a4d715e0ecefab3c90352eebe3048a62b219a66c1a580cfc19c2de60fdf67fb8aa20db23a8226ac631d69300b718d096bcff30dfa75a1ea8ea606115127bfcf000c178fe574939731f76e1eb9cc4f05a6451d5366550a50a2bcf39a1d4bb0b26eaf6a66e0dacb6a1d1af23959c80248868ad410ad9e4cea0f60bba600ca9d72bb2f18193a39b054ea8e95504ea8630c45fa406c3aa672e009f758a80331e918cb6a57bc15f26d423e14968cb93c2c9bfde7404432027380c70782d5d122d715c362ca404f95457ba38e84381491081288c90566dad6a1d0a837aef30a419205db0489469088570992bca475901c8a4906491ed3bc66906461b1c37b9520c9021e1e24284fdd20f1e8d3b3686fa43db26d943c5df45145cb78cda1b54d8192587c65767a246dbbd3fbd9dcf674ad86269307bbd1249a76e812a30996cb9b926c60d1baab28e78f93713966e38add370dd9c37e93e3530ed2201090085a31b1eac832b09d127e3a2f52be430aac02c71b9b8055e9e0d48260837ed58c8883dd5dc0fed8b03c37ba2b2a167759ec37d2775ce94f1d90b169c29bebfd216673e39ac5e96a406e96886961fb1adb088dab03248b3a9ad26422c0429383abd19732f9d66df97967c9f40bd0e492298bad6c261dfe3922a3f0c1e8eba00d1a59a469a27f3c62e2a065fe95c51a5576b2e0fd8bfed9f0dddf5b2323d125f741775c2f4032f55a2b5c0298b6cee064d4d5b4fb3070bc4e9e0cdad1b45828605a0555f4188b2d1e581e6468c924a81147d8a4d9b472301efa5516c32e4d691029ad1388983a9cccf243055ccbe9f534204d882a5d97d0b4de62b3a52da66cebb5c1a640a6711b910c05c08934aec7702d808b10e589653da92b9212bc12262049b155705c2b8f014b2b5c4be11e46654ea55c142b03542b15243ec1e240c26b509a28424a4ff4f283543fbdfd206d8ad200c7561e7500ef22592b99719397fae9d6f603f920c597e6ddfbd574c3bad97f38dcd47677f3505eb34c6e0b08b65de0aa8ee5c1cd70c0ba256337793f77fbdb0cc8c17088d05eec4ae761c21ce07685c001188d53e6f74de22736420835ece736f901ebbbbad5a09671246d666f49d2d291e3602aac05f12196735a4a177294d6d7496295b530a878958d5d6cd91048ed9a0d2e10b3b19baecfd08238089b120f6a1fa61e6a71891d224fdd25ae68b095f3c2c3e3e9c52549492f2e49527a71499292210991bcf6d0920dd24bb829ee376842424f74ec92eaa76397b429b5b924dde4c57eda895dfd7c1b0faba49a28d2b248d85857322a9291301167ebdb0964e1a6cb1c7c7aa896ff284793c5bc7a38a92b339bfd6ffa38f936ad52a9566df3bba99cf88e077afcb5569abd92c3253e35846225fb64273cc35d33c277c548ad0d689e244ded7e736bd8de7b2333e203fadc66ca6f2f171d96703e7bee4b86a4a73d3c0a0cc7372236ece0e6075f2fe8eee290f2924bd76dde64394b6dde949d955fabe5eeb5ed9ed88080263a7a43897b1176735bbd038e6f2edcf750c6b7bbebd55763a065e062d64b4fb4dcf5cc8d41b0fbb50418187505f7089d37835f7d37a6fff058b1d162f66db9f884510a7f57cbc7c9fd64543270f46dcbcf9655399dfc8edbd64339d4c8575d65424f1823a03f14f8b557dab8ba60beace6d512a0891fb4c44d477c04fa13694e946025fff78caf38fa3f9ea9d2300a656e6473747265616d0a656e646f626a0a312030206f626a0a3c3c2f54797065202f50616765730a2f4b696473205b3320302052205d0a2f436f756e7420310a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963610a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f48656c7665746963612d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a392030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965720a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31302030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31312030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d4f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31322030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f436f75726965722d426f6c644f626c697175650a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31332030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d526f6d616e0a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31342030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c640a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31352030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d4974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31362030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f54696d65732d426f6c644974616c69630a2f53756274797065202f54797065310a2f456e636f64696e67202f57696e416e7369456e636f64696e670a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31372030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f5a61706644696e67626174730a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a31382030206f626a0a3c3c0a2f54797065202f466f6e740a2f42617365466f6e74202f53796d626f6c0a2f53756274797065202f54797065310a2f4669727374436861722033320a2f4c61737443686172203235350a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f50726f63536574205b2f504446202f54657874202f496d61676542202f496d61676543202f496d616765495d0a2f466f6e74203c3c0a2f46312035203020520a2f46322036203020520a2f46332037203020520a2f46342038203020520a2f46352039203020520a2f4636203130203020520a2f4637203131203020520a2f4638203132203020520a2f4639203133203020520a2f463130203134203020520a2f463131203135203020520a2f463132203136203020520a2f463133203137203020520a2f463134203138203020520a3e3e0a2f584f626a656374203c3c0a3e3e0a3e3e0a656e646f626a0a31392030206f626a0a3c3c0a2f50726f647563657220286a7350444620332e302e34290a2f4372656174696f6e446174652028443a32303236303132353131313432302d303527303027290a3e3e0a656e646f626a0a32302030206f626a0a3c3c0a2f54797065202f436174616c6f670a2f50616765732031203020520a2f4f70656e416374696f6e205b3320302052202f46697448206e756c6c5d0a2f506167654c61796f7574202f4f6e65436f6c756d6e0a3e3e0a656e646f626a0a787265660a302032310a303030303030303030302036353533352066200a30303030303032353436203030303030206e200a30303030303034333633203030303030206e200a30303030303030303135203030303030206e200a30303030303030313532203030303030206e200a30303030303032363033203030303030206e200a30303030303032373238203030303030206e200a30303030303032383538203030303030206e200a30303030303032393931203030303030206e200a30303030303033313238203030303030206e200a30303030303033323531203030303030206e200a30303030303033333830203030303030206e200a30303030303033353132203030303030206e200a30303030303033363438203030303030206e200a30303030303033373736203030303030206e200a30303030303033393033203030303030206e200a30303030303034303332203030303030206e200a30303030303034313635203030303030206e200a30303030303034323637203030303030206e200a30303030303034363131203030303030206e200a30303030303034363937203030303030206e200a747261696c65720a3c3c0a2f53697a652032310a2f526f6f74203230203020520a2f496e666f203139203020520a2f4944205b203c31333834313641373639333838414444433642413338453743334631444141413e203c31333834313641373639333838414444433642413338453743334631444141413e205d0a3e3e0a7374617274787265660a343830310a2525454f46	Comprobante_Multiple_000118.pdf	application/pdf
\.


--
-- Data for Name: t_tarifa; Type: TABLE DATA; Schema: facturacion; Owner: postgres
--

COPY facturacion.t_tarifa (id_tarifa, nombre, detalle, precio_por_m3, limite_min_m3, limite_max_m3, tipo_tarifa, fecha_creacion, activo, vigencia_desde, vigencia_hasta, es_vigente) FROM stdin;
4	Exceso de Consumo	Cargo por m³ adicional	1.00	16.00	\N	exceso	2025-12-17 11:15:13.43592-05	t	2025-01-01 00:00:00-05	\N	t
6	Tarifa Otro	Otras tarifas	5.00	0.00	5.00	otro	2025-12-17 11:15:13.43592-05	f	2025-01-01 00:00:00-05	2025-12-17 13:54:56.109401-05	f
7	t especial	\N	3.00	0.00	\N	especial	2025-12-17 13:44:11.01386-05	t	2025-12-17 14:14:27.661751-05	\N	t
3	Consumo Básico	Tarifa fija hasta 15 m³	20.00	0.00	15.00	basico	2025-12-17 11:15:13.43592-05	f	2025-12-17 14:23:49.063788-05	2025-12-17 14:24:00.251051-05	f
8	Consumo Básico	Tarifa fija hasta 15 m³	2.00	0.00	15.00	basico	2025-12-17 13:53:34.717488-05	t	2025-12-17 14:24:00.251051-05	\N	t
\.


--
-- Data for Name: t_historial_medidor; Type: TABLE DATA; Schema: medidores; Owner: postgres
--

COPY medidores.t_historial_medidor (id_historial, id_medidor, id_usuario_afi_anterior, id_usuario_afi_nuevo, fecha_cambio, motivo_cambio, costo_cambio, id_usuario_sistema, observaciones, activo, facturado) FROM stdin;
1	15	16	20	2026-01-12 15:16:35.926202-05	Cambio de afiliado del medidor	\N	1	Cambio realizado desde API por admin	t	f
2	15	20	16	2026-01-12 15:36:22.231751-05	Cambio de afiliado del medidor	\N	1	Cambio realizado desde API por admin	t	f
3	9	17	19	2026-01-12 15:45:39.757457-05	Cambio de afiliado del medidor	13.50	1	Cambio realizado desde API por admin	t	f
4	4	\N	17	2026-01-25 16:08:19.623819-05	Cambio de afiliado del medidor	13.50	1	Cambio realizado por admin	t	t
\.


--
-- Data for Name: t_lecturas; Type: TABLE DATA; Schema: medidores; Owner: postgres
--

COPY medidores.t_lecturas (id_lectura, id_medidor, lectura_actual, lectura_anterior, consumo_m3, fecha_lectura, id_lector, observacion, activo, es_estimada) FROM stdin;
141	5	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
144	15	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
149	20	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
148	9	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
136	4	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
156	11	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
151	12	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
162	10	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
152	6	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
157	13	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
159	3	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
153	17	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
154	18	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
161	2	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
155	5	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
160	15	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
158	20	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
163	9	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
150	4	20	10	10	2025-12-01	1	⚡ Lectura estimada - Promedio de 1 meses anteriores | Confirmada automáticamente	t	f
170	11	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
167	12	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
175	10	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
165	6	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
171	13	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
166	17	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
168	18	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
169	5	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
173	15	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
172	20	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
177	9	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
164	4	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
179	2	30	20	10	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
185	11	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
142	11	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
139	12	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
146	10	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
137	6	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
143	13	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
147	3	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
138	17	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
140	18	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
145	2	10	0	10	2025-11-01	1	⚡ Lectura estimada - Primera lectura - Consumo inicial sugerido: 10 m³ | Confirmada automáticamente	t	f
187	12	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
182	13	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
181	3	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
184	17	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
188	5	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
190	15	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
191	20	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
192	4	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
195	9	50	40	10	2026-03-01	1	\N	t	f
189	6	50	30	20	2026-02-01	1	Lectura confirmada y corregida	t	f
186	10	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
193	18	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
180	2	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
183	9	40	30	10	2026-02-01	1	⚡ Lectura estimada - Promedio de 3 meses anteriores | Confirmada automáticamente	t	f
196	17	65	50	15	2026-03-14	1	\N	t	f
176	3	40	20	20	2026-01-01	1	⚡ Lectura estimada - Promedio de 2 meses anteriores | Confirmada automáticamente	t	f
197	4	78	65	13	2026-03-25	1	\N	t	f
198	2	83	78	5	2026-03-31	1	\N	t	f
199	24	12	0	12	2026-01-01	1	\N	t	f
200	25	14	0	14	2026-01-01	1	\N	t	f
\.


--
-- Data for Name: t_medidor; Type: TABLE DATA; Schema: medidores; Owner: postgres
--

COPY medidores.t_medidor (id_medidor, num_medidor, id_usuario_afi, id_sector, latitud, longitud, altitud, activo) FROM stdin;
11	2222	10	1	\N	\N	\N	t
12	3332	11	1	\N	\N	\N	t
10	1111	9	1	-1.553233285692093	-78.759242241438	\N	t
6	404004	6	3	\N	\N	\N	t
13	3342	12	1	\N	\N	2323.00	t
3	0002	7	1	5	\N	5.00	t
17	10008	1	3	-1.5494688298415127	-78.75507539032957	3371.00	t
18	3333	5	1	\N	\N	\N	t
2	0003	18	3	-1.55	-78.76	\N	t
5	0004	4	3	-1.555270189650322	-78.75719605087723	3370.00	t
20	19999	14	3	\N	\N	3374.00	t
15	7775	16	1	\N	\N	\N	t
9	008	19	3	\N	\N	\N	t
4	0005	17	\N	-1.5513042013762306	-78.76092605759442	\N	t
24	1234	26	3	\N	\N	3374.00	t
25	2345	27	1	\N	\N	3374.00	t
\.


--
-- Data for Name: t_sector; Type: TABLE DATA; Schema: medidores; Owner: postgres
--

COPY medidores.t_sector (id_sector, nombre_sector, descripcion, activo) FROM stdin;
3	Centro	\N	t
1	Los Pinos	Se ubica al final de la comunidad - Sa	t
\.


--
-- Data for Name: t_servicios; Type: TABLE DATA; Schema: medidores; Owner: postgres
--

COPY medidores.t_servicios (id_servicio, nombre, descripcion, precio_base, activo, fecha_creacion, vigencia_desde, vigencia_hasta, es_vigente) FROM stdin;
4	Fugas	\N	2.50	t	2025-12-03 21:23:15.494878-05	2025-12-03 21:23:15.494878-05	\N	t
1	Alcantarillado	\N	2.00	t	2025-12-03 16:00:55.214953-05	2025-12-03 16:00:55.214953-05	\N	t
5	Adicional	\N	13.00	t	2025-12-17 14:49:31.386828-05	2025-12-17 14:49:31.386828-05	\N	t
3	Instalacion	\N	50.00	f	2025-12-03 16:00:55.214953-05	2025-12-03 16:00:55.214953-05	2026-01-11 16:18:45.192912-05	f
6	Instalacion	\N	55.00	t	2026-01-11 16:18:45.192912-05	2026-01-11 16:18:45.192912-05	\N	t
7	Cambio de medidor	Precio para aplicar al cambio de medidor	13.50	t	2026-01-12 15:35:34.098833-05	2026-01-12 15:35:34.098833-05	\N	t
\.


--
-- Data for Name: t_multa; Type: TABLE DATA; Schema: multas; Owner: postgres
--

COPY multas.t_multa (id_tipo_multa, nombre_multa, descripcion, monto, activo, vigencia_desde, vigencia_hasta, es_vigente, fecha_creacion) FROM stdin;
2	Inacistencia a Reuniones	\N	20.00	t	2025-12-08 00:00:00-05	\N	t	2025-12-08 19:21:44.353759-05
4	Reconecion	\N	12.00	t	2025-12-10 00:00:00-05	\N	t	2025-12-09 21:35:10.938319-05
7	Mingas	\N	13.50	t	2025-12-29 00:00:00-05	\N	t	2025-12-29 17:04:03.474996-05
\.


--
-- Data for Name: t_multas_afiliados; Type: TABLE DATA; Schema: multas; Owner: postgres
--

COPY multas.t_multas_afiliados (id_multa_afi, id_usuario_afi, id_tipo_multa, monto, fecha_multa, fecha_pago, observaciones, activo, estado, facturado) FROM stdin;
65	18	7	13.50	2026-01-10	2026-01-10	\N	t	pagada	t
51	18	2	20.00	2025-12-29	2026-01-10	\N	t	pagada	t
62	18	2	20.00	2026-01-06	2026-01-10	\N	t	pagada	t
66	1	7	13.50	2026-01-11	\N	\N	t	facturado	t
49	7	2	20.00	2025-01-02	2025-12-29	\N	t	pagada	t
52	7	2	20.00	2025-12-29	2025-12-29	\N	t	pagada	t
53	12	2	20.00	2025-12-29	2025-12-29	\N	t	pagada	t
50	17	2	20.00	2025-12-27	2026-01-03	\N	t	pagada	t
57	1	2	20.00	2026-01-03	2026-01-03	\N	t	pagada	t
45	10	2	20.00	2025-12-16	\N	\N	t	pendiente	t
46	12	2	20.00	2025-12-16	\N	\N	t	pendiente	t
44	9	2	20.00	2025-12-16	\N	\N	t	pendiente	t
35	7	2	20.00	2025-12-09	2026-01-08	\N	t	pagada	t
58	11	2	20.00	2026-01-03	2026-01-08	\N	t	pagada	t
40	1	2	20.00	2025-12-15	\N	\N	f	pendiente	f
43	4	2	20.00	2025-12-15	\N	\N	t	pendiente	t
59	9	7	13.50	2026-01-03	\N	\N	t	pendiente	t
60	6	2	20.00	2026-01-03	\N	\N	t	pendiente	t
61	12	2	20.00	2026-01-03	\N	\N	t	pendiente	t
54	4	2	20.00	2025-12-29	\N	\N	t	pendiente	t
55	4	2	20.00	2025-12-29	\N	\N	t	pendiente	t
48	16	2	20.00	2025-12-25	\N	\N	t	pendiente	t
63	16	2	20.00	2026-01-06	\N	\N	t	pendiente	t
64	16	7	13.50	2026-01-06	\N	\N	t	pendiente	t
56	14	7	13.50	2026-01-02	2026-01-02	\N	t	pagada	t
\.


--
-- Data for Name: t_notificaciones; Type: TABLE DATA; Schema: notificaciones; Owner: postgres
--

COPY notificaciones.t_notificaciones (id_notificacion, id_usuario_sistema, titulo, mensaje, tipo, estado, fecha_creacion, fecha_leido, es_mantenimiento, fecha_inicio_mantenimiento, fecha_fin_mantenimiento, modulos_afectados, enviar_email, email_enviado, fecha_envio_email, prioridad, duracion_estimada) FROM stdin;
4	11	Usuario modificado	El usuario 'jessica' fue modificado correctamente.	info	no_leido	2025-11-07 14:02:48.357295-05	2025-11-07 14:02:48.357295	f	\N	\N	\N	f	f	\N	media	\N
8	12	Usuario modificado	El usuario 'rene' fue modificado correctamente.	info	no_leido	2025-11-07 14:02:48.357295-05	2025-11-07 14:02:48.357295	f	\N	\N	\N	f	f	\N	media	\N
10	6	Usuario modificado	El usuario 'alex' fue modificado correctamente.	info	no_leido	2025-11-07 14:02:48.357295-05	2025-11-07 14:02:48.357295	f	\N	\N	\N	f	f	\N	media	\N
11	10	Usuario modificado	El usuario 'andy' fue modificado correctamente.	info	no_leido	2025-11-07 14:02:48.357295-05	2025-11-07 14:02:48.357295	f	\N	\N	\N	f	f	\N	media	\N
7	3	Usuario modificado	El usuario 'lector' fue modificado correctamente.	info	leido	2025-11-07 14:02:48.357295-05	2025-11-07 19:03:08.407214	f	\N	\N	\N	f	f	\N	media	\N
12	1	Usuario modificado	El usuario 'lector' fue modificado correctamente.	info	leido	2025-11-07 19:04:23.710075-05	2025-11-07 19:21:27.506964	f	\N	\N	\N	f	f	\N	media	\N
13	1	Usuario modificado	El usuario 'lector' fue modificado correctamente.	info	leido	2025-11-07 19:48:22.864761-05	2025-11-07 19:49:38.461908	f	\N	\N	\N	f	f	\N	media	\N
15	3	Usuario modificado	El usuario 'rene' fue modificado correctamente.	info	leido	2025-11-08 04:16:11.298149-05	2025-11-08 04:45:29.547949	f	\N	\N	\N	f	f	\N	media	\N
17	3	Usuario activado	El usuario 'alex' fue activado correctamente.	info	leido	2025-11-08 04:40:38.409518-05	2025-11-08 04:45:29.547949	f	\N	\N	\N	f	f	\N	media	\N
18	3	Usuario desactivado	El usuario 'alex' fue desactivado correctamente.	alerta	leido	2025-11-08 04:42:17.248218-05	2025-11-08 04:45:29.547949	f	\N	\N	\N	f	f	\N	media	\N
16	3	Usuario desactivado	El usuario 'alex' fue desactivado correctamente.	alerta	leido	2025-11-08 04:35:09.456048-05	2025-11-08 04:45:29.547949	f	\N	\N	\N	f	f	\N	media	\N
19	3	Usuario activado	El usuario 'alex' fue activado correctamente.	info	leido	2025-11-08 04:45:16.839744-05	2025-11-08 04:45:29.547949	f	\N	\N	\N	f	f	\N	media	\N
20	3	Usuario desactivado	El usuario 'alex' fue desactivado correctamente.	alerta	leido	2025-11-08 04:48:09.150798-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
21	3	Usuario desactivado	El usuario 'alex' no se pudo eliminar porque tiene relación con otros módulos. Fue desactivado.	alerta	leido	2025-11-08 04:56:53.996741-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
22	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque tiene relación con otros módulos. Fue desactivado.	alerta	leido	2025-11-08 04:59:18.378143-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
23	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque tiene relación con otros módulos. Fue desactivado.	alerta	leido	2025-11-08 05:01:34.092231-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
24	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.	alerta	leido	2025-11-08 05:02:30.475564-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
25	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.	alerta	leido	2025-11-08 05:04:27.320051-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
26	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.	alerta	leido	2025-11-08 05:06:30.013906-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
27	3	Usuario desactivado	El usuario 'rene' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.	alerta	leido	2025-11-08 05:07:50.461732-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
28	3	Usuario desactivado	El usuario 'alex' no se pudo eliminar porque está relacionado con otros módulos. Fue desactivado automáticamente.	alerta	leido	2025-11-08 05:09:45.253499-05	2025-11-08 05:14:55.832869	f	\N	\N	\N	f	f	\N	media	\N
14	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2025-11-08 01:48:34.069287-05	2025-11-10 02:02:41.093834	f	\N	\N	\N	f	f	\N	media	\N
33	1	Afiliado creado	El usuario 'Jeferson Alexander Charco Tenesaca' fue afiliado correctamente con código 1.	exito	leido	2025-11-08 20:20:12.098315-05	2025-11-10 02:02:41.093834	f	\N	\N	\N	f	f	\N	media	\N
34	1	Afiliado creado	El usuario 'Juan Jose Ushca' fue afiliado correctamente con código 2.	exito	leido	2025-11-08 20:46:18.768693-05	2025-11-10 02:02:41.093834	f	\N	\N	\N	f	f	\N	media	\N
31	3	Sector eliminado	El sector 'Los Pinos' fue eliminado correctamente.	info	leido	2025-11-08 17:00:25.129294-05	2025-11-12 03:10:38.01046	f	\N	\N	\N	f	f	\N	media	\N
36	1	Medidor modificado	El medidor '123456789' fue modificado correctamente.	info	leido	2025-11-11 00:20:55.676558-05	2025-11-11 00:21:32.733857	f	\N	\N	\N	f	f	\N	media	\N
29	3	Rol desactivado	El rol 'Cliente' no se pudo eliminar porque tiene 4 usuario(s) asignados. Fue desactivado automáticamente.	alerta	leido	2025-11-08 16:54:09.666091-05	2025-11-12 03:10:49.675	f	\N	\N	\N	f	f	\N	media	\N
30	3	Rol modificado	El rol 'Cliente' fue modificado correctamente.	info	leido	2025-11-08 16:54:47.262917-05	2025-11-12 03:10:49.675	f	\N	\N	\N	f	f	\N	media	\N
32	3	Sector modificado	El sector 'Silveria' fue modificado correctamente.	info	leido	2025-11-08 17:01:39.334839-05	2025-11-12 03:10:49.675	f	\N	\N	\N	f	f	\N	media	\N
40	1	Medidor creado	El medidor '0003' fue creado correctamente.	exito	leido	2025-11-11 14:04:20.721039-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
41	1	Medidor creado	El medidor '0002' fue creado correctamente.	exito	leido	2025-11-11 14:04:44.307692-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
38	1	Sector creado	El sector 'Centro' fue creado correctamente.	exito	leido	2025-11-11 14:01:55.374256-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
35	1	Medidor creado	El medidor '123456789' fue creado correctamente.	exito	leido	2025-11-11 00:15:12.413871-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
37	1	Sector modificado	El sector 'Los Pinos' fue modificado correctamente.	info	leido	2025-11-11 14:01:34.762638-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
39	1	Afiliado creado	El usuario 'Rene R Reyes' fue afiliado correctamente con código 3.	exito	leido	2025-11-11 14:02:40.022663-05	2025-11-12 03:06:14.835052	f	\N	\N	\N	f	f	\N	media	\N
6	5	Usuario modificado	El usuario 'marta' fue modificado correctamente.	info	leido	2025-11-07 14:02:48.357295-05	2025-11-12 03:12:31.400152	f	\N	\N	\N	f	f	\N	media	\N
9	4	Usuario modificado	El usuario 'cliente' fue modificado correctamente.	info	leido	2025-11-07 14:02:48.357295-05	2025-11-12 03:14:38.11244	f	\N	\N	\N	f	f	\N	media	\N
42	1	Medidor creado	El medidor '0005' fue creado correctamente.	exito	leido	2025-11-12 21:15:37.492562-05	2025-11-12 21:37:33.583902	f	\N	\N	\N	f	f	\N	media	\N
43	1	Afiliado creado	El usuario 'Alex Mauricio Charco' fue afiliado correctamente con código 4.	exito	leido	2025-11-13 01:37:09.000301-05	2025-11-13 02:00:17.502532	f	\N	\N	\N	f	f	\N	media	\N
44	1	Medidor creado	El medidor '0004' fue creado correctamente.	exito	leido	2025-11-13 01:37:25.533366-05	2025-11-13 02:00:17.502532	f	\N	\N	\N	f	f	\N	media	\N
45	1	Afiliado creado	El usuario 'Miguel Charco' fue afiliado correctamente con código 5.	exito	leido	2025-11-13 02:01:06.137104-05	2025-11-13 02:04:32.363044	f	\N	\N	\N	f	f	\N	media	\N
46	1	Afiliado creado	El usuario 'Jessica Almeda R' fue afiliado correctamente con código 6.	exito	leido	2025-11-13 02:20:50.987095-05	2025-11-14 00:29:55.049751	f	\N	\N	\N	f	f	\N	media	\N
47	1	Medidor creado	El medidor '404004' fue creado correctamente.	exito	leido	2025-11-13 02:21:07.433011-05	2025-11-14 00:29:55.049751	f	\N	\N	\N	f	f	\N	media	\N
48	1	Sector creado	El sector 'Sanjapamba' fue creado correctamente.	exito	leido	2025-11-13 02:22:20.755091-05	2025-11-14 00:29:55.049751	f	\N	\N	\N	f	f	\N	media	\N
49	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2025-11-14 21:11:30.347662-05	2025-11-15 16:35:49.344712	f	\N	\N	\N	f	f	\N	media	\N
50	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2025-11-14 21:11:36.925761-05	2025-11-15 16:35:49.344712	f	\N	\N	\N	f	f	\N	media	\N
51	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2025-11-14 21:12:00.083943-05	2025-11-15 16:35:49.344712	f	\N	\N	\N	f	f	\N	media	\N
53	5	Usuario modificado	El usuario 'marta' fue modificado correctamente.	info	leido	2025-11-15 16:37:50.331776-05	2025-11-15 16:38:45.030341	f	\N	\N	\N	f	f	\N	media	\N
54	1	Afiliado creado	El usuario 'Andy J Paca Paca' fue afiliado correctamente con código 7.	exito	leido	2025-11-15 16:42:29.13861-05	2025-11-15 17:04:18.311301	f	\N	\N	\N	f	f	\N	media	\N
55	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-11-15 20:24:32.580945-05	2025-11-15 20:38:07.099787	f	\N	\N	\N	f	f	\N	media	\N
56	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-11-15 20:36:36.081343-05	2025-11-15 20:38:07.099787	f	\N	\N	\N	f	f	\N	media	\N
57	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-11-15 20:36:54.32244-05	2025-11-15 20:38:07.099787	f	\N	\N	\N	f	f	\N	media	\N
58	1	Sector modificado	El sector 'Sanjapamba' fue modificado correctamente.	info	leido	2025-11-15 20:37:20.494748-05	2025-11-15 20:38:07.099787	f	\N	\N	\N	f	f	\N	media	\N
59	1	Sector creado	El sector 'Zona Norte' fue creado correctamente.	exito	leido	2025-11-15 20:37:36.88367-05	2025-11-15 20:38:07.099787	f	\N	\N	\N	f	f	\N	media	\N
60	1	Carga masiva completada	Se crearon 5 usuarios correctamente. 0 errores.	exito	leido	2025-11-16 01:00:31.966998-05	2025-11-16 01:08:39.05482	f	\N	\N	\N	f	f	\N	media	\N
61	1	Afiliado creado	El usuario 'Ana Lopez' fue afiliado correctamente con código 8.	exito	leido	2025-11-16 01:55:32.049159-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
62	1	Medidor creado	El medidor '0009' fue creado correctamente.	exito	leido	2025-11-16 01:55:32.185068-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
63	1	Usuario creado	El usuario 'carmelina' fue creado correctamente.	exito	leido	2025-11-18 03:57:59.737533-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
64	1	Medidor creado	El medidor '#####' fue creado correctamente.	exito	leido	2025-11-18 14:43:14.266289-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
65	1	Medidor modificado	El medidor '#####' fue modificado correctamente.	info	leido	2025-11-18 14:47:22.96193-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
66	1	Medidor eliminado	El medidor '#####' fue eliminado correctamente.	info	leido	2025-11-18 14:48:02.482368-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
67	1	Afiliado eliminado	El afiliado 'Ana Lopez' fue eliminado correctamente.	info	leido	2025-11-18 14:48:36.328567-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
68	1	Medidor eliminado	El medidor '0009' fue eliminado correctamente.	info	leido	2025-11-18 14:49:01.891299-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
69	1	Sector creado	El sector '####' fue creado correctamente.	exito	leido	2025-11-18 14:51:10.565344-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
70	1	Medidor creado	El medidor '008' fue creado correctamente.	exito	leido	2025-11-18 14:51:43.368579-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
71	1	Sector eliminado	El sector '####' fue eliminado correctamente.	info	leido	2025-11-18 14:52:04.548082-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
72	1	Sector creado	El sector 'CENTRO' fue creado correctamente.	exito	leido	2025-11-18 14:54:15.475211-05	2025-11-19 21:13:46.425011	f	\N	\N	\N	f	f	\N	media	\N
74	1	Sector eliminado	El sector 'CENTRO' fue eliminado correctamente.	info	leido	2025-11-20 16:26:19.9546-05	2025-11-20 20:08:58.904458	f	\N	\N	\N	f	f	\N	media	\N
75	1	Afiliado eliminado	El afiliado 'Sofia Hernandez' fue eliminado correctamente.	info	leido	2025-11-20 19:39:10.494321-05	2025-11-20 20:08:58.904458	f	\N	\N	\N	f	f	\N	media	\N
73	1	Carga masiva completada	Se crearon 7 afiliados con medidores. 1 errores.	exito	leido	2025-11-20 16:04:25.749641-05	2025-11-20 20:08:58.904458	f	\N	\N	\N	f	f	\N	media	\N
76	1	Medidor eliminado	El medidor '5555' fue eliminado correctamente.	info	leido	2025-11-20 20:49:17.213748-05	2025-11-20 21:15:14.709669	f	\N	\N	\N	f	f	\N	media	\N
78	1	Tarifa creada	La tarifa 'Tarifa Recidencia' fue creada correctamente.	exito	leido	2025-11-24 19:48:30.099735-05	2025-11-24 19:55:49.316675	f	\N	\N	\N	f	f	\N	media	\N
77	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-21_11-57-47.dump' fue creado correctamente.	exito	leido	2025-11-21 16:57:48.253591-05	2025-11-24 19:55:49.316675	f	\N	\N	\N	f	f	\N	media	\N
79	1	Tarifa modificada	La tarifa 'Tarifa especila' fue modificada correctamente.	info	leido	2025-11-24 20:03:59.975536-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
80	1	Tarifa modificada	La tarifa 'Tarifa especial' fue modificada correctamente.	info	leido	2025-11-24 20:04:20.684753-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
81	1	Tarifa creada	La tarifa 'todosds' fue creada correctamente.	exito	leido	2025-11-24 20:04:53.782232-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
82	1	Tarifa creada	La tarifa 'Tarifa Especila' fue creada correctamente.	exito	leido	2025-11-24 20:05:58.992167-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
83	1	Tarifa modificada	La tarifa 'Tarifa Recidencial' fue modificada correctamente.	info	leido	2025-11-24 20:06:35.587009-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
84	1	Tarifa modificada	La tarifa 'Tarifa Especila' fue modificada correctamente.	info	leido	2025-11-24 20:06:47.322689-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
85	1	Tarifa modificada	La tarifa 'Tarifa Es' fue modificada correctamente.	info	leido	2025-11-24 20:06:58.447327-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
86	1	Tarifa modificada	La tarifa 'Tarifa Especial' fue modificada correctamente.	info	leido	2025-11-24 20:07:07.979348-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
87	1	Tarifa modificada	La tarifa 'Tarifa Comercial' fue modificada correctamente.	info	leido	2025-11-24 20:07:59.455767-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
88	1	Tarifa creada	La tarifa 'Com' fue creada correctamente.	exito	leido	2025-11-24 20:14:18.375199-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
89	1	Tarifa modificada	La tarifa 'Tarifa Recidencial' fue modificada correctamente.	info	leido	2025-11-24 20:16:30.346554-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
90	1	Tarifa creada	La tarifa 'como' fue creada correctamente.	exito	leido	2025-11-24 20:24:30.684711-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
91	1	Tarifa eliminada	La tarifa 'como' fue eliminada correctamente.	info	leido	2025-11-24 20:24:47.275654-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
92	1	Tarifa eliminada	La tarifa 'Com' fue eliminada correctamente.	info	leido	2025-11-24 20:24:52.673054-05	2025-11-24 21:12:55.887269	f	\N	\N	\N	f	f	\N	media	\N
93	1	Medidor modificado	El medidor '123456789' fue modificado correctamente.	info	leido	2025-11-25 00:27:27.929382-05	2025-11-25 00:38:18.678233	f	\N	\N	\N	f	f	\N	media	\N
94	1	Medidor modificado	El medidor '123456789' fue modificado correctamente.	info	leido	2025-11-25 00:58:12.292328-05	2025-11-25 01:04:30.296421	f	\N	\N	\N	f	f	\N	media	\N
95	1	Medidor modificado	El medidor '0003' fue modificado correctamente.	info	leido	2025-11-25 01:36:23.146759-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
96	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-11-26 03:31:27.753119-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
97	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-11-26 03:33:47.167345-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
98	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-11-26 03:39:20.715558-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
99	1	Medidor eliminado	El medidor '123456789' fue eliminado correctamente.	info	leido	2025-11-26 03:48:22.958924-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
100	1	Medidor creado	El medidor '100000' fue creado correctamente.	exito	leido	2025-11-26 03:52:34.924085-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
101	1	Medidor modificado	El medidor '100000' fue modificado correctamente.	info	leido	2025-11-26 03:54:27.156726-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
102	1	Medidor modificado	El medidor '100000' fue modificado correctamente.	info	leido	2025-11-26 14:48:16.094388-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
103	1	Medidor modificado	El medidor '100000' fue modificado correctamente.	info	leido	2025-11-26 14:49:18.119396-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
104	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-11-26 14:50:20.474797-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
105	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-11-26 15:07:06.074834-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
106	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-11-26 15:33:52.231726-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
107	1	Tarifa modificada	La tarifa 'Tarifa Comercial' fue modificada correctamente.	info	leido	2025-11-26 15:39:37.026615-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
108	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-26_11-07-02.dump' fue creado correctamente.	exito	leido	2025-11-26 16:07:02.762109-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
109	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-26_11-12-13.dump' fue creado correctamente.	exito	leido	2025-11-26 16:12:13.963566-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
110	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-26_11-18-49.dump' fue creado correctamente.	exito	leido	2025-11-26 16:18:50.149431-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
111	1	Usuario modificado	El usuario 'carmelina' fue modificado correctamente.	info	leido	2025-11-26 18:41:43.903439-05	2025-11-26 18:41:52.194569	f	\N	\N	\N	f	f	\N	media	\N
112	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-26_21-07-00.dump' fue creado correctamente.	exito	leido	2025-11-27 02:07:01.671803-05	2025-11-27 03:11:10.752115	f	\N	\N	\N	f	f	\N	media	\N
113	1	Backup restaurado	La base de datos fue restaurada desde 'jaap_sanjapamba_2025-11-26_21-24-59.dump'.	info	leido	2025-11-27 02:58:37.132051-05	2025-11-27 03:11:10.752115	f	\N	\N	\N	f	f	\N	media	\N
114	1	Backup creado	El backup 'jaap_sanjapamba_2025-11-26_21-59-18.dump' fue creado correctamente.	exito	leido	2025-11-27 02:59:19.023815-05	2025-11-27 03:11:10.752115	f	\N	\N	\N	f	f	\N	media	\N
115	1	Backup restaurado	La base de datos fue restaurada desde 'jaap_sanjapamba_2025-11-26_21-59-18.dump'.	info	leido	2025-11-27 03:00:02.005887-05	2025-11-27 03:11:10.752115	f	\N	\N	\N	f	f	\N	media	\N
116	1	Backup descargado	El backup 'jaap_sanjapamba_2025-11-26_21-59-18.dump' fue descargado.	info	leido	2025-11-27 03:28:35.809215-05	2025-11-27 20:04:58.031147	f	\N	\N	\N	f	f	\N	media	\N
52	3	Usuario modificado	El usuario 'lector' fue modificado correctamente.	info	leido	2025-11-14 21:37:42.304732-05	2025-11-28 21:36:25.096544	f	\N	\N	\N	f	f	\N	media	\N
117	1	Rol creado	El rol 'Reportes' fue creado correctamente.	exito	leido	2025-11-28 22:29:45.351931-05	2025-11-28 22:33:20.378648	f	\N	\N	\N	f	f	\N	media	\N
118	1	Usuario modificado	El usuario 'diego' fue modificado correctamente.	info	leido	2025-11-28 22:32:34.347781-05	2025-11-28 22:33:20.378648	f	\N	\N	\N	f	f	\N	media	\N
119	1	Usuario creado	El usuario 'bryan' fue creado correctamente.	exito	leido	2025-11-28 23:15:50.786926-05	2025-11-28 23:16:49.747694	f	\N	\N	\N	f	f	\N	media	\N
123	1	Usuario modificado	El usuario 'bryan' fue modificado correctamente.	info	leido	2025-11-30 16:40:11.129552-05	2025-11-30 16:41:58.493182	f	\N	\N	\N	f	f	\N	media	\N
122	1	Usuario modificado	El usuario 'alex' fue modificado correctamente.	info	leido	2025-11-30 16:39:52.375371-05	2025-11-30 17:09:57.620218	f	\N	\N	\N	f	f	\N	media	\N
121	1	Medidor modificado	El medidor '1111' fue modificado correctamente.	info	leido	2025-11-30 16:30:40.51322-05	2025-11-30 17:10:02.984918	f	\N	\N	\N	f	f	\N	media	\N
120	1	Usuario modificado	El usuario 'bryan' fue modificado correctamente.	info	leido	2025-11-30 16:27:36.761824-05	2025-11-30 19:10:20.956198	f	\N	\N	\N	f	f	\N	media	\N
124	1	Servicio creado	El servicio 'Alcantarillado' fue creado correctamente.	exito	leido	2025-11-30 20:29:58.18103-05	2025-12-01 14:17:04.633127	f	\N	\N	\N	f	f	\N	media	\N
125	1	Servicio creado	El servicio 'Fugas' fue creado correctamente.	exito	leido	2025-11-30 20:31:25.692396-05	2025-12-01 14:17:04.633127	f	\N	\N	\N	f	f	\N	media	\N
126	1	Lectura creada	Lectura del medidor 0005 registrada correctamente.	exito	leido	2025-12-01 22:02:27.304785-05	2025-12-01 23:58:02.173969	f	\N	\N	\N	f	f	\N	media	\N
129	1	Importación de lecturas completada	Se importaron 3 lecturas correctamente. Errores: 0	exito	leido	2025-12-02 00:16:31.471539-05	2025-12-02 00:17:39.054361	f	\N	\N	\N	f	f	\N	media	\N
127	1	Lectura creada	Lectura del medidor 0005 registrada correctamente.	exito	leido	2025-12-01 23:59:07.170565-05	2025-12-02 01:38:20.843311	f	\N	\N	\N	f	f	\N	media	\N
128	1	Importación de lecturas completada	Se importaron 3 lecturas correctamente. Errores: 0	exito	leido	2025-12-02 00:12:13.09566-05	2025-12-02 01:38:20.843311	f	\N	\N	\N	f	f	\N	media	\N
130	1	Lectura creada	Lectura del medidor 100000 registrada correctamente.	exito	leido	2025-12-02 01:49:47.446245-05	2025-12-02 01:50:31.792145	f	\N	\N	\N	f	f	\N	media	\N
133	1	Importación de lecturas completada	Se importaron 2 lecturas correctamente. Errores: 0	exito	leido	2025-12-03 14:26:35.851337-05	2025-12-03 19:04:06.467713	f	\N	\N	\N	f	f	\N	media	\N
131	1	Servicio creado	El servicio 'Instalacion' fue creado correctamente.	exito	leido	2025-12-02 01:52:24.681204-05	2025-12-03 19:58:43.218633	f	\N	\N	\N	f	f	\N	media	\N
132	1	Tarifa creada	La tarifa 'Tarifaa comun' fue creada correctamente.	exito	leido	2025-12-02 15:18:06.931295-05	2025-12-03 19:58:43.218633	f	\N	\N	\N	f	f	\N	media	\N
134	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Tarifa común'.	info	leido	2025-12-03 19:58:24.044585-05	2025-12-03 19:58:43.218633	f	\N	\N	\N	f	f	\N	media	\N
135	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Tarifa común'.	info	leido	2025-12-03 19:59:18.796952-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
136	1	Vigencia finalizada	La vigencia de la tarifa 'Tarifa Recidencial' fue finalizada.	info	leido	2025-12-03 20:00:21.858263-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
137	1	Tarifa eliminada	La tarifa 'Tarifaa comun' fue eliminada correctamente.	info	leido	2025-12-03 20:00:46.841178-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
138	1	Tarifa creada	La tarifa 'Tarifa Residecial' fue creada correctamente.	exito	leido	2025-12-03 20:05:32.434821-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
139	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Tarifa Residecial'.	info	leido	2025-12-03 20:05:58.810693-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
140	1	Tarifa eliminada	La tarifa 'Tarifa Residecial' fue eliminada correctamente.	info	leido	2025-12-03 20:47:47.715767-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
141	1	Precio de servicio actualizado	El precio del servicio 'Fugas' cambió de $2.00 a $2.50.	info	leido	2025-12-03 21:23:15.546118-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
142	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-03 21:39:55.62339-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
143	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-03 21:40:07.49208-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
144	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:08:47.344187-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
145	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:08:55.181722-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
146	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:09:02.841877-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
147	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:09:24.570309-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
148	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:09:32.715121-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
149	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-04 00:09:39.405601-05	2025-12-04 00:38:16.212915	f	\N	\N	\N	f	f	\N	media	\N
152	1	Lectura creada	Lectura del medidor 3342 registrada correctamente.	exito	leido	2025-12-06 20:28:00.423763-05	2025-12-06 20:28:18.0696	f	\N	\N	\N	f	f	\N	media	\N
150	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-06 19:49:54.11764-05	2025-12-06 22:10:41.933363	f	\N	\N	\N	f	f	\N	media	\N
151	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-06 19:50:27.095087-05	2025-12-06 22:10:41.933363	f	\N	\N	\N	f	f	\N	media	\N
153	1	Carga masiva completada	Se crearon 1 afiliados con medidores. 1 errores.	advertencia	leido	2025-12-06 22:09:47.120617-05	2025-12-06 22:10:41.933363	f	\N	\N	\N	f	f	\N	media	\N
154	1	Backup creado	El backup 'jaap_sanjapamba_2025-12-07_16-11-39.dump' fue creado correctamente.	exito	leido	2025-12-07 21:11:39.969572-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
155	1	Backup eliminado	El backup 'jaap_sanjapamba_2025-11-26_21-24-59.dump' fue eliminado correctamente.	info	leido	2025-12-07 21:17:02.023692-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
162	1	Sector creado	El sector 'ssss' fue creado correctamente.	exito	leido	2025-12-07 22:29:36.299108-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
156	1	Backup eliminado	El backup 'jaap_sanjapamba_2025-11-26_21-59-18.dump' fue eliminado correctamente.	info	leido	2025-12-07 21:20:13.676951-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
157	1	Backup descargado	El backup 'jaap_sanjapamba_2025-12-07_16-11-39.dump' fue descargado.	info	leido	2025-12-07 21:20:27.442951-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
158	1	Backup creado	El backup 'jaap_sanjapamba_2025-12-07_16-20-39.dump' fue creado correctamente.	exito	leido	2025-12-07 21:20:40.152232-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
159	1	Afiliado eliminado	El afiliado 'Jeny Alexandra Gavilanez' fue eliminado correctamente.	info	leido	2025-12-07 21:55:49.457948-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
160	1	Sector eliminado	El sector 'Zona Norte' fue eliminado correctamente.	info	leido	2025-12-07 22:29:03.567224-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
161	1	Sector eliminado	El sector 'Sanjapamba' fue eliminado correctamente.	info	leido	2025-12-07 22:29:11.569137-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
163	1	Sector eliminado	El sector 'ssss' fue eliminado correctamente.	info	leido	2025-12-07 22:29:43.527356-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
164	1	Sector creado	El sector 'ssss' fue creado correctamente.	exito	leido	2025-12-07 22:30:00.040443-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
165	1	Afiliado eliminado	El afiliado 'Juan Jose Ushca Saca' fue eliminado correctamente.	info	leido	2025-12-08 13:49:22.835707-05	2025-12-08 13:55:53.049542	f	\N	\N	\N	f	f	\N	media	\N
166	1	Tipo de multa creado	El tipo de multa 'Inacistencia a Reuniones' fue creado correctamente.	exito	leido	2025-12-09 00:19:57.23968-05	2025-12-09 00:26:01.071475	f	\N	\N	\N	f	f	\N	media	\N
167	1	Tipo de multa creado	El tipo de multa 'inacistencia a Reuniones' fue creado correctamente.	exito	leido	2025-12-09 00:23:35.584692-05	2025-12-09 00:26:01.071475	f	\N	\N	\N	f	f	\N	media	\N
168	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-10 01:00:16.554394-05	2025-12-10 01:00:51.715285	f	\N	\N	\N	f	f	\N	media	\N
169	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 01:10:11.545984-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
170	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 01:10:41.99607-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
171	1	Lectura creada	Lectura del medidor 100000 registrada correctamente.	exito	leido	2025-12-10 01:13:19.712172-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
172	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-10 01:18:16.682444-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
173	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-10 01:19:20.143971-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
174	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-10 01:20:12.07313-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
175	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 01:23:34.618965-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
176	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 01:24:07.247496-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
177	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 01:31:12.887962-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
178	1	Tipo de multa creado	El tipo de multa 'Reconecion' fue creado correctamente.	exito	leido	2025-12-10 02:35:11.057539-05	2025-12-10 19:43:51.150293	f	\N	\N	\N	f	f	\N	media	\N
179	1	Lecturas Septiembre/2025 importadas	1 lecturas registradas correctamente	exito	leido	2025-12-10 20:03:51.458285-05	2025-12-10 20:05:44.641986	f	\N	\N	\N	f	f	\N	media	\N
180	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:03.747077-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
181	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:09.709241-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
182	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:15.817451-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
183	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:20.949831-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
184	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:26.398588-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
185	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:31.895851-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
186	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:40.228172-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
187	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:45.885209-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
188	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:52.191443-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
189	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:06:57.468331-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
190	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:03.078543-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
191	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:08.168299-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
192	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:19.511916-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
193	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:25.26712-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
194	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:30.747204-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
195	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:36.222368-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
196	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:41.640743-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
197	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:46.719945-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
198	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:54.410669-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
199	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:07:59.373184-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
200	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:04.764708-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
201	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:14.114293-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
202	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:19.812467-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
203	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:27.581858-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
204	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:40.967581-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
205	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:46.716429-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
206	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:08:51.940754-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
207	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:09:34.393356-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
208	1	Lecturas Enero/2026 importadas	1 lecturas registradas correctamente	exito	leido	2025-12-10 20:42:28.330972-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
209	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-10 20:43:13.60562-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
210	1	Tipo de multa creado	El tipo de multa '###' fue creado correctamente.	exito	leido	2025-12-10 21:01:35.282784-05	2025-12-11 00:07:58.310304	f	\N	\N	\N	f	f	\N	media	\N
214	1	Tipo de multa eliminado	El tipo de multa 'inacistencia a Reuniones 2' fue eliminado correctamente.	info	leido	2025-12-11 02:07:31.494005-05	2025-12-11 02:07:46.187445	f	\N	\N	\N	f	f	\N	media	\N
213	1	Tipo de multa eliminado	El tipo de multa 'inacistencia a Reuniones' fue eliminado correctamente.	info	leido	2025-12-11 02:07:11.192147-05	2025-12-11 02:07:48.449947	f	\N	\N	\N	f	f	\N	media	\N
211	1	Servicio eliminado	El servicio 'Fugas' fue eliminado correctamente.	info	leido	2025-12-11 01:51:10.759517-05	2025-12-12 03:35:46.014171	f	\N	\N	\N	f	f	\N	media	\N
212	1	Tipo de multa eliminado	El tipo de multa 'Inacistencia a Reuniones' fue eliminado correctamente.	info	leido	2025-12-11 02:07:06.472642-05	2025-12-12 03:35:46.014171	f	\N	\N	\N	f	f	\N	media	\N
215	1	Pago de multa registrado	Se registró el pago de la multa #35	exito	leido	2025-12-12 01:18:30.812674-05	2025-12-12 03:35:46.014171	f	\N	\N	\N	f	f	\N	media	\N
216	1	Medidor modificado	El medidor '100000' fue modificado correctamente.	info	leido	2025-12-12 03:28:49.222291-05	2025-12-12 03:35:46.014171	f	\N	\N	\N	f	f	\N	media	\N
217	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-12-13 15:32:38.145172-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
218	1	Backup creado	El backup 'jaap_sanjapamba_2025-12-13_10-38-55.dump' fue creado correctamente.	exito	leido	2025-12-13 15:38:56.032942-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
219	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-12-13 20:49:39.672853-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
220	1	Medidor modificado	El medidor '100000' fue modificado correctamente.	info	leido	2025-12-13 21:13:40.206887-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
221	1	Medidor modificado	El medidor '3342' fue modificado correctamente.	info	leido	2025-12-13 21:14:10.020694-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
222	1	Medidor modificado	El medidor '3342' fue modificado correctamente.	info	leido	2025-12-13 21:14:27.275448-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
223	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:14:39.222865-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
224	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:14:51.999976-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
225	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:16:07.229672-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
226	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:16:25.735122-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
227	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:27:45.292826-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
228	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:27:54.377719-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
229	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:37:32.237612-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
230	1	Medidor modificado	El medidor '0002' fue modificado correctamente.	info	leido	2025-12-13 21:39:21.874422-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
231	1	Medidor creado	El medidor '5856' fue creado correctamente.	exito	leido	2025-12-13 21:39:55.92056-05	2025-12-15 13:38:32.900826	f	\N	\N	\N	f	f	\N	media	\N
236	17	Nueva lectura registrada	Se registró una lectura de 10m³ para tu medidor N° 2222. Fecha: 15/12/2025	info	leido	2025-12-15 15:04:36.944551-05	2025-12-15 15:04:49.22323	f	\N	\N	\N	f	f	\N	media	\N
232	1	Medidor modificado	El medidor '8885' fue modificado correctamente.	info	leido	2025-12-15 13:39:28.194946-05	2025-12-15 15:49:13.472439	f	\N	\N	\N	f	f	\N	media	\N
233	1	Backup creado	El backup 'jaap_sanjapamba_2025-12-15_09-29-23.dump' fue creado correctamente.	exito	leido	2025-12-15 14:29:24.562341-05	2025-12-15 15:49:13.472439	f	\N	\N	\N	f	f	\N	media	\N
234	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-15 15:04:15.840722-05	2025-12-15 15:49:13.472439	f	\N	\N	\N	f	f	\N	media	\N
235	1	Lectura creada	Lectura del medidor 2222 registrada correctamente. Consumo: 10m³	exito	leido	2025-12-15 15:04:36.911684-05	2025-12-15 15:49:13.472439	f	\N	\N	\N	f	f	\N	media	\N
239	10	Nueva lectura y factura	Se registró una lectura de 4m³ para tu medidor N° 0002.	info	no_leido	2025-12-15 21:11:57.032563-05	2025-12-15 21:11:57.032563	f	\N	\N	\N	f	f	\N	media	\N
237	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-15 21:11:37.654641-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
238	1	Lectura creada	Lectura del medidor 0002 registrada. Consumo: 4m³. ⚠️ Lectura creada pero: No se encontró tarifa aplicable para este consumo	exito	leido	2025-12-15 21:11:56.983412-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
240	1	Tarifa creada	La tarifa 'consumo' fue creada correctamente.	exito	leido	2025-12-15 21:18:32.716397-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
241	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-15 21:21:02.702679-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
242	1	Lectura creada	Lectura del medidor 100000 registrada. Consumo: 10m³. ⚠️ Lectura creada pero: No se encontró tarifa aplicable para este consumo	exito	leido	2025-12-15 21:21:19.349216-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
243	1	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 100000.	info	leido	2025-12-15 21:21:19.490269-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
244	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Residencial Básico'.	info	leido	2025-12-15 21:33:41.14096-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
245	1	Tarifa creada	La tarifa 'Exceso Penalización' fue creada correctamente.	exito	leido	2025-12-15 21:37:07.25591-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
246	1	Tarifa eliminada	La tarifa 'Tarifa común' fue eliminada correctamente.	info	leido	2025-12-15 21:37:19.442273-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
247	1	Tarifa eliminada	La tarifa 'consumo' fue eliminada correctamente.	info	leido	2025-12-15 21:37:24.940734-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
248	1	Tarifa eliminada	La tarifa 'Tarifa Recidencial' fue eliminada correctamente.	info	leido	2025-12-15 21:37:30.578444-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
249	1	Tarifa eliminada	La tarifa 'Tarifa Comercial' fue eliminada correctamente.	info	leido	2025-12-15 21:37:40.151829-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
250	1	Tarifa eliminada	La tarifa 'Tarifa Residecial' fue eliminada correctamente.	info	leido	2025-12-15 21:37:51.814598-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
251	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-15 21:44:38.410129-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
252	1	Lectura creada	Lectura del medidor 100000 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0001 generada exitosamente	exito	leido	2025-12-16 00:51:42.327546-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
253	1	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 100000. Factura FACT-202512-0001 generada por $2.24	info	leido	2025-12-16 00:51:42.523719-05	2025-12-16 01:03:00.887856	f	\N	\N	\N	f	f	\N	media	\N
254	1	Usuario modificado	El usuario 'carla' fue modificado correctamente.	info	leido	2025-12-16 20:53:26.753236-05	2025-12-16 22:36:18.374134	f	\N	\N	\N	f	f	\N	media	\N
292	10	Nueva lectura y factura	Se registró una lectura de 3m³ para tu medidor N° 0002. Factura FACT-202512-0003 generada por $6.72	info	no_leido	2025-12-16 23:02:32.590841-05	2025-12-16 23:02:32.590841	f	\N	\N	\N	f	f	\N	media	\N
295	13	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 1111.	info	no_leido	2025-12-16 23:44:53.891389-05	2025-12-16 23:44:53.892388	f	\N	\N	\N	f	f	\N	media	\N
298	13	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 1111. Factura FACT-202512-0004 generada por $11.20	info	no_leido	2025-12-16 23:49:22.871894-05	2025-12-16 23:49:22.872891	f	\N	\N	\N	f	f	\N	media	\N
307	14	Nueva lectura y factura	Se registró una lectura de 5m³ para tu medidor N° 3342. Factura FACT-202512-0006 generada por $24.64	info	leido	2025-12-17 01:06:52.181152-05	2025-12-30 21:02:25.60233	f	\N	\N	\N	f	f	\N	media	\N
301	17	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 2222.	info	leido	2025-12-17 00:21:28.131654-05	2025-12-30 21:07:19.223064	f	\N	\N	\N	f	f	\N	media	\N
304	17	Nueva lectura y factura	Se registró una lectura de 8m³ para tu medidor N° 2222. Factura FACT-202512-0005 generada por $31.36	info	leido	2025-12-17 00:45:29.453881-05	2025-12-30 21:07:19.223064	f	\N	\N	\N	f	f	\N	media	\N
289	18	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 3332. Factura FACT-202512-0002 generada por $22.40	info	leido	2025-12-16 22:52:50.553385-05	2026-01-04 23:26:07.986426	f	\N	\N	\N	f	f	\N	media	\N
316	12	Nueva lectura y factura	Se registró una lectura de 6m³ para tu medidor N° 0003. Factura FACT-202512-0007 generada por $2.24	info	no_leido	2025-12-17 15:42:31.462379-05	2025-12-17 15:42:31.463379	f	\N	\N	\N	f	f	\N	media	\N
330	11	Nueva lectura y factura	Se registró una lectura de 8m³ para tu medidor N° 404004.	info	no_leido	2025-12-18 01:25:41.897613-05	2025-12-18 01:25:41.897613	f	\N	\N	\N	f	f	\N	media	\N
287	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-16 22:52:26.79937-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
288	1	Lectura creada	Lectura del medidor 3332 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0002 generada exitosamente	exito	leido	2025-12-16 22:52:50.444859-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
290	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-16 23:02:11.869266-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
291	1	Lectura creada	Lectura del medidor 0002 registrada. Consumo: 3m³. ✅ Factura FACT-202512-0003 generada exitosamente	exito	leido	2025-12-16 23:02:32.536846-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
293	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-16 23:44:19.873302-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
294	1	Lectura creada	Lectura del medidor 1111 registrada. Consumo: 10m³. ⚠️ Lectura creada pero: Ya existe factura para el periodo 2025-12	exito	leido	2025-12-16 23:44:53.8444-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
296	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-16 23:48:58.916945-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
297	1	Lectura creada	Lectura del medidor 1111 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0004 generada exitosamente	exito	leido	2025-12-16 23:49:22.815886-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
299	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-17 00:20:28.567634-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
300	1	Lectura creada	Lectura del medidor 2222 registrada. Consumo: 10m³. ⚠️ Lectura creada pero: Ya existe factura para el periodo 2025-12	exito	leido	2025-12-17 00:21:28.05809-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
302	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-17 00:25:26.236472-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
303	1	Lectura creada	Lectura del medidor 2222 registrada. Consumo: 8m³. ✅ Factura FACT-202512-0005 generada exitosamente	exito	leido	2025-12-17 00:45:29.329286-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
305	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-17 01:06:26.060316-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
306	1	Lectura creada	Lectura del medidor 3342 registrada. Consumo: 5m³. ✅ Factura FACT-202512-0006 generada exitosamente	exito	leido	2025-12-17 01:06:52.010965-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
308	1	Estado de factura actualizado	Factura FACT-202512-0002 ahora está 'pagada'	info	leido	2025-12-17 02:39:52.924832-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
309	1	Sector eliminado	El sector 'ssss' fue eliminado correctamente.	info	leido	2025-12-17 14:43:34.573801-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
310	1	Servicio creado	El servicio 'Adicional' fue creado correctamente.	exito	leido	2025-12-17 14:49:31.824691-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
311	1	Vigencia finalizada	La vigencia de la tarifa 'Residencial Básico' fue finalizada.	info	leido	2025-12-17 14:52:11.881296-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
312	1	Tarifa creada	La tarifa 'saas' fue creada correctamente.	exito	leido	2025-12-17 14:54:39.44114-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
313	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Tarifa Especial'.	info	leido	2025-12-17 14:58:50.767541-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
314	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-17 15:42:13.778358-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
315	1	Lectura creada	Lectura del medidor 0003 registrada. Consumo: 6m³. ✅ Factura FACT-202512-0007 generada exitosamente	exito	leido	2025-12-17 15:42:31.114572-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
317	1	Tarifa creada	La tarifa 't especial' fue creada correctamente.	exito	leido	2025-12-17 18:44:11.069949-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
318	1	Vigencia finalizada	La vigencia de la tarifa 'Exceso de Consumo' fue finalizada.	info	leido	2025-12-17 18:44:40.292047-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
319	1	Tarifa versionada	Se creó una nueva versión de la tarifa 'Consumo Básico'.	info	leido	2025-12-17 18:53:34.778165-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
320	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente.	exito	leido	2025-12-17 19:13:45.838746-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
339	13	Nueva lectura y factura	Se registró una lectura de 20m³ para tu medidor N° 1111. Factura FACT-202512-0002 generada por $27.00	info	no_leido	2025-12-18 01:31:19.402354-05	2025-12-18 01:31:19.402354	f	\N	\N	\N	f	f	\N	media	\N
321	1	Vigencia activada	La tarifa 't especial' ahora está activa y vigente.	exito	leido	2025-12-17 19:14:27.681834-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
322	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente.	exito	leido	2025-12-17 19:14:36.964173-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
323	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente.	exito	leido	2025-12-17 19:16:35.834626-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
324	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente.	exito	leido	2025-12-17 19:16:55.013484-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
325	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente. Se desactivó 'Consumo Básico'.	exito	leido	2025-12-17 19:23:49.140332-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
326	1	Vigencia activada	La tarifa 'Consumo Básico' ahora está activa y vigente. Se desactivó 'Consumo Básico'.	exito	leido	2025-12-17 19:24:00.27259-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
327	1	Tarifa eliminada	La tarifa 'Tarifa Especial' fue eliminada correctamente.	info	leido	2025-12-17 19:27:34.388935-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
328	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-18 01:14:02.407642-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
329	1	Lectura creada	Lectura del medidor 404004 registrada. Consumo: 8m³. ⚠️ Lectura creada pero: No se encontró tarifa básica vigente	exito	leido	2025-12-18 01:25:41.801058-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
331	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-18 01:27:59.689985-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
332	1	Lectura creada	Lectura del medidor 100000 registrada. Consumo: 10m³. ⚠️ Lectura creada pero: No se encontró tarifa básica vigente	exito	leido	2025-12-18 01:28:22.825644-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
333	1	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 100000.	info	leido	2025-12-18 01:28:23.161322-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
334	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-18 01:28:58.709621-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
335	1	Lectura creada	Lectura del medidor 100000 registrada. Consumo: 8m³. ✅ Factura FACT-202512-0001 generada exitosamente	exito	leido	2025-12-18 01:29:16.264075-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
336	1	Nueva lectura y factura	Se registró una lectura de 8m³ para tu medidor N° 100000. Factura FACT-202512-0001 generada por $2.00	info	leido	2025-12-18 01:29:16.764526-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
337	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-18 01:30:39.764943-05	2025-12-18 01:30:48.023526	f	\N	\N	\N	f	f	\N	media	\N
342	16	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 3333. Factura FACT-202512-0003 generada por $2.30	info	no_leido	2025-12-18 02:41:38.504809-05	2025-12-18 02:41:38.504809	f	\N	\N	\N	f	f	\N	media	\N
348	4	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 0005. Factura FACT-202512-0005 generada por $2.30	info	no_leido	2025-12-19 01:33:00.170105-05	2025-12-19 01:33:00.170105	f	\N	\N	\N	f	f	\N	media	\N
355	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 3m³ para el medidor N° 0002. Factura FACT-202511-0002 generada por $2.30	info	no_leido	2025-12-19 02:26:57.855606-05	2025-12-19 02:26:57.855606	f	\N	\N	\N	f	f	\N	media	\N
356	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 4m³ para el medidor N° 0004. Factura FACT-202511-0003 generada por $25.30	info	no_leido	2025-12-19 02:27:00.902352-05	2025-12-19 02:27:00.903348	f	\N	\N	\N	f	f	\N	media	\N
358	12	Lectura confirmada y factura generada	Se confirmó tu lectura de 6m³ para el medidor N° 0003. Factura FACT-202511-0005 generada por $2.30	info	no_leido	2025-12-19 02:27:01.938158-05	2025-12-19 02:27:01.938158	f	\N	\N	\N	f	f	\N	media	\N
361	4	Lectura confirmada y factura generada	Se confirmó la lectura de 15m³ para tu medidor N° 0005. Factura FACT-202601-0001 generada por $2.30	info	no_leido	2025-12-19 02:41:11.534481-05	2025-12-19 02:41:11.534481	f	\N	\N	\N	f	f	\N	media	\N
363	4	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 0005. Factura FACT-202509-0001 generada por $2.30	info	no_leido	2025-12-19 04:32:14.831308-05	2025-12-19 04:32:14.831308	f	\N	\N	\N	f	f	\N	media	\N
338	1	Lectura creada	Lectura del medidor 1111 registrada. Consumo: 20m³. ✅ Factura FACT-202512-0002 generada exitosamente	exito	leido	2025-12-18 01:31:19.359365-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
340	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-18 02:41:24.311466-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
341	1	Lectura creada	Lectura del medidor 3333 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0003 generada exitosamente	exito	leido	2025-12-18 02:41:38.440288-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
343	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-19 01:31:40.238006-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
344	1	Lectura creada	Lectura del medidor 2222 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0004 generada exitosamente	exito	leido	2025-12-19 01:32:06.884666-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
346	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-19 01:32:46.858724-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
349	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-19 01:37:38.798298-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
400	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-23 01:44:50.581766-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
401	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-23 01:48:53.932583-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
402	1	Comprobante guardado	Comprobante del pago #22 guardado exitosamente	exito	leido	2025-12-23 01:48:59.245689-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
403	1	Pago registrado	Pago de $25.30 registrado correctamente	exito	leido	2025-12-23 03:38:00.060666-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
428	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-12-24 16:53:53.195202-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
429	1	Medidor modificado	El medidor '008' fue modificado correctamente.	info	leido	2025-12-25 00:28:43.854946-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
430	1	Lectura creada	Lectura del medidor 008 registrada. Consumo: 13m³. ✅ Factura FACT-202512-0006 generada exitosamente	exito	leido	2025-12-25 00:29:25.014276-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
432	1	Lectura estimada confirmada	Lectura confirmada para medidor 2222. Consumo real: 10m³. ✅ Factura FACT-202601-0002 generada exitosamente	exito	leido	2025-12-25 15:41:15.096253-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
434	1	Lectura creada	Lectura del medidor 008 registrada. Consumo: 13m³. ✅ Factura FACT-202601-0003 generada exitosamente	exito	leido	2025-12-25 15:42:12.028759-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
436	1	Lectura actualizada	Lectura modificada. Factura reactivada (anulada → pendiente)	info	leido	2025-12-25 16:30:14.407514-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
437	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2025-12-25 16:30:41.543183-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
438	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2025-12-25 16:41:39.117929-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
439	1	Pago registrado	Pago de $8.05 registrado correctamente	exito	leido	2025-12-25 20:59:51.677469-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
440	1	Comprobante guardado	Comprobante del pago #25 guardado exitosamente	exito	leido	2025-12-25 20:59:51.875538-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
441	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-25 21:21:35.928138-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
442	1	Comprobante guardado	Comprobante del pago #26 guardado exitosamente	exito	leido	2025-12-25 21:21:36.862828-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
357	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 5m³ para el medidor N° 3342. Factura FACT-202511-0004 generada por $2.30	info	leido	2025-12-19 02:27:01.536678-05	2025-12-30 21:02:25.60233	f	\N	\N	\N	f	f	\N	media	\N
347	1	Lectura creada	Lectura del medidor 0005 registrada. Consumo: 10m³. ✅ Factura FACT-202512-0005 generada exitosamente	exito	leido	2025-12-19 01:33:00.120947-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
350	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-19 01:38:16.943043-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
351	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-19 01:39:22.720241-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
352	1	Lectura modificada	La lectura fue modificada correctamente.	info	leido	2025-12-19 01:41:00.073533-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
353	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-19 02:21:13.945648-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
354	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 4m³ para el medidor N° 100000. Factura FACT-202511-0001 generada por $2.30	info	leido	2025-12-19 02:26:56.175576-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
359	1	Confirmación masiva completada	Se confirmaron 5 lecturas y se generaron 5 facturas para el periodo 11/2025	exito	leido	2025-12-19 02:27:02.05673-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
360	1	Lectura estimada confirmada	Lectura confirmada para medidor 0005. Consumo real: 15m³. ✅ Factura FACT-202601-0001 generada exitosamente	exito	leido	2025-12-19 02:41:11.473513-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
362	1	Lectura creada	Lectura del medidor 0005 registrada. Consumo: 10m³. ✅ Factura FACT-202509-0001 generada exitosamente	exito	leido	2025-12-19 04:32:14.51513-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
364	1	Lecturas Febrero/2026 importadas	12 lecturas y 12 facturas generadas correctamente	exito	leido	2025-12-19 16:09:05.599045-05	2025-12-19 16:10:13.717507	f	\N	\N	\N	f	f	\N	media	\N
365	1	Pago registrado	Pago de $4.60 registrado correctamente	exito	leido	2025-12-19 20:28:55.632678-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
366	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-19 20:38:15.368757-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
367	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-19 20:40:42.800468-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
368	1	Pago registrado	Pago de $13.80 registrado correctamente	exito	leido	2025-12-19 20:50:24.755653-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
369	1	Pago registrado	Pago de $77.05 registrado correctamente	exito	leido	2025-12-19 21:23:28.174396-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
370	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-19 21:33:01.094825-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
371	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-19 21:37:12.519757-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
372	1	Pago registrado	Pago de $25.30 registrado correctamente	exito	leido	2025-12-19 21:44:09.365313-05	2025-12-20 02:48:50.275552	f	\N	\N	\N	f	f	\N	media	\N
373	1	Pago registrado	Pago de $17.25 registrado correctamente	exito	leido	2025-12-20 16:28:13.970877-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
374	1	Pago registrado	Pago de $17.25 registrado correctamente	exito	leido	2025-12-20 16:47:08.641866-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
375	1	Pago registrado	Pago de $40.25 registrado correctamente	exito	leido	2025-12-20 16:49:16.314126-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
376	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-20 19:25:04.764833-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
377	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-20 19:54:08.119895-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
378	1	Pago registrado	Pago de $22.43 registrado correctamente	exito	leido	2025-12-20 19:55:54.463309-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
379	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-20 20:07:11.948756-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
380	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-20 20:12:32.661982-05	2025-12-20 20:48:03.07153	f	\N	\N	\N	f	f	\N	media	\N
382	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 4m³ para el medidor N° 0004. Factura FACT-202510-0002 generada por $2.30	info	no_leido	2025-12-20 20:56:45.800225-05	2025-12-20 20:56:45.801225	f	\N	\N	\N	f	f	\N	media	\N
383	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 2m³ para el medidor N° 0002. Factura FACT-202510-0003 generada por $2.30	info	no_leido	2025-12-20 20:56:46.69479-05	2025-12-20 20:56:46.69479	f	\N	\N	\N	f	f	\N	media	\N
386	13	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 1111. Factura FACT-202510-0006 generada por $2.30	info	no_leido	2025-12-20 20:56:47.702354-05	2025-12-20 20:56:47.702354	f	\N	\N	\N	f	f	\N	media	\N
387	16	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3333. Factura FACT-202510-0007 generada por $2.30	info	no_leido	2025-12-20 20:56:47.974699-05	2025-12-20 20:56:47.9757	f	\N	\N	\N	f	f	\N	media	\N
389	12	Lectura confirmada y factura generada	Se confirmó tu lectura de 3m³ para el medidor N° 0003. Factura FACT-202510-0009 generada por $2.30	info	no_leido	2025-12-20 20:56:49.591657-05	2025-12-20 20:56:49.591657	f	\N	\N	\N	f	f	\N	media	\N
390	11	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 404004. Factura FACT-202510-0010 generada por $2.30	info	no_leido	2025-12-20 20:56:50.449177-05	2025-12-20 20:56:50.449177	f	\N	\N	\N	f	f	\N	media	\N
391	4	Lectura confirmada y factura generada	Se confirmó tu lectura de 20m³ para el medidor N° 0005. Factura FACT-202510-0011 generada por $8.05	info	no_leido	2025-12-20 20:56:51.116182-05	2025-12-20 20:56:51.117174	f	\N	\N	\N	f	f	\N	media	\N
392	5	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 7775. Factura FACT-202510-0012 generada por $2.30	info	no_leido	2025-12-20 20:56:51.545243-05	2025-12-20 20:56:51.546244	f	\N	\N	\N	f	f	\N	media	\N
381	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 35m³ para el medidor N° 100000. Factura FACT-202510-0001 generada por $25.30	info	leido	2025-12-20 20:56:42.871663-05	2025-12-22 13:43:06.896603	f	\N	\N	\N	f	f	\N	media	\N
393	1	Confirmación masiva completada	Se confirmaron 12 lecturas y se generaron 12 facturas para el periodo 10/2025	exito	leido	2025-12-20 20:56:51.6214-05	2025-12-22 13:43:06.896603	f	\N	\N	\N	f	f	\N	media	\N
394	1	Usuario modificado	El usuario 'alex' fue modificado correctamente.	info	leido	2025-12-21 20:12:04.554437-05	2025-12-22 13:43:06.896603	f	\N	\N	\N	f	f	\N	media	\N
395	1	Usuario modificado	El usuario 'alex' fue modificado correctamente.	info	leido	2025-12-21 20:16:06.18747-05	2025-12-22 13:43:06.896603	f	\N	\N	\N	f	f	\N	media	\N
396	1	Usuario modificado	El usuario 'luis' fue modificado correctamente.	info	leido	2025-12-21 20:16:57.549283-05	2025-12-22 13:43:06.896603	f	\N	\N	\N	f	f	\N	media	\N
397	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-23 01:06:37.238353-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
398	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-23 01:27:48.618959-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
399	1	Pago registrado	Pago de $19.55 registrado correctamente	exito	leido	2025-12-23 01:32:46.624277-05	2025-12-23 13:42:15.049487	f	\N	\N	\N	f	f	\N	media	\N
404	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-23 15:23:11.071333-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
385	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 12m³ para el medidor N° 3342. Factura FACT-202510-0005 generada por $2.30	info	leido	2025-12-20 20:56:47.426719-05	2025-12-30 21:02:25.60233	f	\N	\N	\N	f	f	\N	media	\N
388	18	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3332. Factura FACT-202510-0008 generada por $2.30	info	leido	2025-12-20 20:56:48.594821-05	2026-01-04 23:26:07.986426	f	\N	\N	\N	f	f	\N	media	\N
405	1	Comprobante guardado	Comprobante del pago #24 guardado exitosamente	exito	leido	2025-12-23 15:23:19.765384-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
406	1	Rol modificado	El rol 'Afiliado' fue modificado correctamente.	info	leido	2025-12-23 16:23:25.651099-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
407	1	Medidor modificado	El medidor '10003' fue modificado correctamente.	info	leido	2025-12-23 20:07:13.325888-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
408	1	Afiliado creado	El usuario 'Bryan Charco' fue afiliado correctamente con código 15.	exito	leido	2025-12-23 21:33:15.978317-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
409	1	Afiliado modificado	El afiliado 'Bryan Charco' fue modificado correctamente.	info	leido	2025-12-23 21:33:45.529138-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
410	1	Afiliado modificado	El afiliado 'Bryan Charco' fue modificado correctamente.	info	leido	2025-12-23 21:33:55.330965-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
411	1	Medidor creado	El medidor '19999' fue creado correctamente.	exito	leido	2025-12-23 21:34:35.259402-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
412	1	Medidor eliminado	El medidor '8885' fue eliminado correctamente.	info	leido	2025-12-24 14:39:57.834774-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
413	1	Medidor modificado	El medidor '10008' fue modificado correctamente.	info	leido	2025-12-24 14:49:41.59075-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
414	1	Afiliado creado	El usuario 'Jeny Alexandra Gavilanez' fue afiliado correctamente con código 16.	exito	leido	2025-12-24 14:59:47.193399-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
415	1	Afiliado creado	El usuario 'Juan Jose Ushca Saca' fue afiliado correctamente con código 17.	exito	leido	2025-12-24 15:00:01.330857-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
416	1	Medidor modificado	El medidor '3333' fue modificado correctamente.	info	leido	2025-12-24 15:06:05.866336-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
417	1	Medidor modificado	El medidor '3333' fue modificado correctamente.	info	leido	2025-12-24 15:11:19.073259-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
418	1	Medidor modificado	El medidor '3333' fue modificado correctamente.	info	leido	2025-12-24 15:11:19.935191-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
419	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-12-24 15:56:08.253253-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
420	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-12-24 16:01:07.274817-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
421	1	Medidor modificado	El medidor '3333' fue modificado correctamente.	info	leido	2025-12-24 16:02:32.409155-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
422	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2025-12-24 16:04:18.042863-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
423	1	Medidor modificado	El medidor '0003' fue modificado correctamente.	info	leido	2025-12-24 16:12:08.032098-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
424	1	Medidor modificado	El medidor '19999' fue modificado correctamente.	info	leido	2025-12-24 16:21:29.171919-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
425	1	Medidor modificado	El medidor '0004' fue modificado correctamente.	info	leido	2025-12-24 16:25:51.54747-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
426	1	Medidor modificado	El medidor '7775' fue modificado correctamente.	info	leido	2025-12-24 16:31:20.723952-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
427	1	Medidor modificado	El medidor '19999' fue modificado correctamente.	info	leido	2025-12-24 16:50:23.678002-05	2025-12-26 21:29:46.316258	f	\N	\N	\N	f	f	\N	media	\N
443	1	Multa eliminada	La multa anulada ID 34 de Alex Mauricio Charco fue eliminada correctamente.	info	leido	2025-12-28 02:39:07.562266-05	2025-12-28 02:56:50.748035	f	\N	\N	\N	f	f	\N	media	\N
444	1	Multa eliminada	La multa anulada ID 47 de Luis Vargas fue eliminada correctamente.	info	leido	2025-12-28 02:39:18.209652-05	2025-12-28 02:56:50.748035	f	\N	\N	\N	f	f	\N	media	\N
445	1	Multa eliminada	La multa anulada ID 1 de Jeferson Alexander Charco Tenesaca fue eliminada correctamente.	info	leido	2025-12-28 02:39:36.210015-05	2025-12-28 02:56:50.748035	f	\N	\N	\N	f	f	\N	media	\N
446	1	Multa eliminada	La multa anulada ID 36 de Jeferson Alexander Charco Tenesaca fue eliminada correctamente.	info	leido	2025-12-28 02:42:38.16866-05	2025-12-28 02:56:50.748035	f	\N	\N	\N	f	f	\N	media	\N
447	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2025-12-28 03:19:01.943457-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
448	1	Comprobante guardado	Comprobante del pago #27 guardado exitosamente	exito	leido	2025-12-28 03:19:02.114-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
449	1	Lectura actualizada	Lectura modificada. Factura reactivada (anulada → pendiente)	info	leido	2025-12-28 03:29:30.145095-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
450	1	Pago registrado	Pago de $22.00 registrado correctamente	exito	leido	2025-12-28 03:30:06.153493-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
451	1	Comprobante guardado	Comprobante del pago #28 guardado exitosamente	exito	leido	2025-12-28 03:30:06.320579-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
452	1	Pago registrado	Pago de $25.30 registrado correctamente	exito	leido	2025-12-28 04:01:02.491027-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
453	1	Comprobante guardado	Comprobante del pago #29 guardado exitosamente	exito	leido	2025-12-28 04:01:02.9234-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
454	1	Pago registrado	Pago de $2.00 registrado correctamente	exito	leido	2025-12-28 04:04:25.793074-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
455	1	Comprobante guardado	Comprobante del pago #30 guardado exitosamente	exito	leido	2025-12-28 04:04:25.99205-05	2025-12-29 16:32:03.10956	f	\N	\N	\N	f	f	\N	media	\N
431	19	Nueva lectura y factura	Se registró una lectura de 13m³ para tu medidor N° 008. Factura FACT-202512-0006 generada por $2.30	info	leido	2025-12-25 00:29:25.094833-05	2025-12-29 20:59:55.308866	f	\N	\N	\N	f	f	\N	media	\N
435	19	Nueva lectura y factura	Se registró una lectura de 13m³ para tu medidor N° 008. Factura FACT-202601-0003 generada por $2.00	info	leido	2025-12-25 15:42:12.095836-05	2025-12-29 20:59:55.308866	f	\N	\N	\N	f	f	\N	media	\N
467	10	Nueva lectura y factura	Se registró una lectura de 11m³ para tu medidor N° 0002. Factura FACT-202512-0008 generada por $42.00	info	no_leido	2025-12-29 21:38:51.336157-05	2025-12-29 21:38:51.337156	f	\N	\N	\N	f	f	\N	media	\N
433	17	Lectura confirmada y factura generada	Se confirmó la lectura de 10m³ para tu medidor N° 2222. Factura FACT-202601-0002 generada por $2.00	info	leido	2025-12-25 15:41:15.21281-05	2025-12-30 21:07:19.223064	f	\N	\N	\N	f	f	\N	media	\N
477	1	Pago registrado	Pago de $2.00 registrado correctamente	exito	leido	2025-12-29 21:43:43.897553-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
478	1	Comprobante guardado	Comprobante del pago #36 guardado exitosamente	exito	leido	2025-12-29 21:43:44.035147-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
479	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-29 21:50:09.612673-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
472	14	Nueva lectura y factura	Se registró una lectura de 5m³ para tu medidor N° 3342. Factura FACT-202512-0009 generada por $22.00	info	leido	2025-12-29 21:41:05.975175-05	2025-12-30 21:02:25.60233	f	\N	\N	\N	f	f	\N	media	\N
481	6	Nueva lectura y factura	Se registró una lectura de 5m³ para tu medidor N° 0004. Factura FACT-202512-0010 generada por $42.00	info	no_leido	2025-12-29 21:50:24.258102-05	2025-12-29 21:50:24.258102	f	\N	\N	\N	f	f	\N	media	\N
473	1	Pago registrado	Pago de $2.00 registrado correctamente	exito	leido	2025-12-29 21:41:21.001917-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
474	1	Comprobante guardado	Comprobante del pago #34 guardado exitosamente	exito	leido	2025-12-29 21:41:21.134497-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
456	1	Usuario modificado	El usuario 'bryan' fue modificado correctamente.	info	leido	2025-12-29 19:38:29.204869-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
457	1	Pago registrado	Pago de $2.00 registrado correctamente	exito	leido	2025-12-29 20:54:45.346282-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
458	1	Comprobante guardado	Comprobante del pago #31 guardado exitosamente	exito	leido	2025-12-29 20:54:45.638005-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
459	1	Lectura actualizada	Lectura modificada. Sin factura asociada	info	leido	2025-12-29 21:26:25.445914-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
460	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-29 21:26:44.905771-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
461	1	Lectura creada	Lectura del medidor 0003 registrada. Consumo: 4m³. ✅ Factura FACT-202512-0007 generada exitosamente	exito	leido	2025-12-29 21:26:57.530236-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
463	1	Pago registrado	Pago de $2.00 registrado correctamente	exito	leido	2025-12-29 21:27:41.367426-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
464	1	Comprobante guardado	Comprobante del pago #32 guardado exitosamente	exito	leido	2025-12-29 21:27:41.563025-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
465	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-29 21:38:36.767039-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
466	1	Lectura creada	Lectura del medidor 0002 registrada. Consumo: 11m³. ✅ Factura FACT-202512-0008 generada exitosamente	exito	leido	2025-12-29 21:38:51.169923-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
468	1	Pago registrado	Pago de $42.00 registrado correctamente	exito	leido	2025-12-29 21:39:23.081283-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
469	1	Comprobante guardado	Comprobante del pago #33 guardado exitosamente	exito	leido	2025-12-29 21:39:23.431517-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
470	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2025-12-29 21:40:25.849274-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
471	1	Lectura creada	Lectura del medidor 3342 registrada. Consumo: 5m³. ✅ Factura FACT-202512-0009 generada exitosamente	exito	leido	2025-12-29 21:41:05.916067-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
475	1	Pago registrado	Pago de $20.00 registrado correctamente	exito	leido	2025-12-29 21:43:14.038395-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
476	1	Comprobante guardado	Comprobante del pago #35 guardado exitosamente	exito	leido	2025-12-29 21:43:14.181225-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
480	1	Lectura creada	Lectura del medidor 0004 registrada. Consumo: 5m³. ✅ Factura FACT-202512-0010 generada exitosamente	exito	leido	2025-12-29 21:50:23.998377-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
482	1	Pago registrado	Pago de $2.00 registrado correctamente (sin multas). 2 multa(s) pendiente(s) para próxima facturación	exito	leido	2025-12-29 21:54:36.01584-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
483	1	Comprobante guardado	Comprobante del pago #38 guardado exitosamente	exito	leido	2025-12-29 21:54:36.70342-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
484	1	Tipo de multa creado	El tipo de multa 'Mingas' fue creado correctamente.	exito	leido	2025-12-29 22:04:03.600493-05	2025-12-30 20:14:14.264784	f	\N	\N	\N	f	f	\N	media	\N
485	1	Afiliado no eliminado	El afiliado 'Rene R Reyes' no se puede eliminar porque tiene relaciones con otros módulos.	alerta	leido	2025-12-30 20:42:20.498091-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
486	1	Usuario creado	El usuario 'jose' fue creado correctamente.	exito	leido	2025-12-30 22:11:36.110879-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
487	1	Usuario modificado	El usuario 'jose' fue modificado correctamente.	info	leido	2025-12-30 22:12:04.795642-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
488	1	Usuario modificado	El usuario 'jose' fue modificado correctamente.	info	leido	2025-12-30 22:12:15.364025-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
489	1	Medidor modificado	El medidor '5856' fue modificado correctamente.	info	leido	2025-12-31 02:23:12.005862-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
490	1	Medidor modificado	El medidor '58560' fue modificado correctamente.	info	leido	2025-12-31 03:17:50.197218-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
491	1	Afiliado creado	El usuario 'Jose J Acan' fue afiliado correctamente con código 18.	exito	leido	2025-12-31 03:18:19.744682-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
492	1	Medidor modificado	El medidor '58560' fue modificado correctamente.	info	leido	2025-12-31 03:18:39.235799-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
493	1	Medidor eliminado	El medidor '58560' fue eliminado correctamente.	info	leido	2025-12-31 03:19:05.020609-05	2026-01-02 16:14:52.197874	f	\N	\N	\N	f	f	\N	media	\N
514	13	Lectura confirmada y factura generada	Se confirmó la lectura de 15m³ para tu medidor N° 1111. Factura FACT-202601-0006 generada por $15.50	info	no_leido	2026-01-03 19:39:46.113494-05	2026-01-03 19:39:46.113494	f	\N	\N	\N	f	f	\N	media	\N
494	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2026-01-03 01:53:37.648105-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
506	1	Pago registrado	Pago de $20.00 registrado	exito	leido	2026-01-03 19:20:17.955295-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
522	11	Lectura confirmada y factura generada	Se confirmó la lectura de 9m³ para tu medidor N° 404004. Factura FACT-202601-0007 generada por $22.00	info	no_leido	2026-01-03 19:56:33.575059-05	2026-01-03 19:56:33.575059	f	\N	\N	\N	f	f	\N	media	\N
528	14	Lectura confirmada y factura generada	Se confirmó la lectura de 5m³ para tu medidor N° 3342. Factura FACT-202601-0008 generada por $22.00	info	no_leido	2026-01-03 20:06:13.524822-05	2026-01-03 20:06:13.524822	f	\N	\N	\N	f	f	\N	media	\N
529	4	Usuario modificado	El usuario 'cliente' fue modificado correctamente.	info	no_leido	2026-01-04 03:03:34.508404-05	2026-01-04 03:03:34.510405	f	\N	\N	\N	f	f	\N	media	\N
511	18	Lectura confirmada y factura generada	Se confirmó la lectura de 10m³ para tu medidor N° 3332. Factura FACT-202601-0005 generada por $2.00	info	leido	2026-01-03 19:37:58.585533-05	2026-01-04 23:26:07.986426	f	\N	\N	\N	f	f	\N	media	\N
495	1	Backup creado	El backup 'jaap_sanjapamba_2026-01-02_21-13-46.dump' fue creado correctamente.	exito	leido	2026-01-03 02:13:46.588439-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
496	1	Pago registrado	Pago de $2.30 registrado correctamente	exito	leido	2026-01-03 02:46:03.852039-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
497	1	Comprobante guardado	Comprobante del pago #39 guardado exitosamente	exito	leido	2026-01-03 02:46:04.170499-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
498	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-03 03:01:32.927168-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
499	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-03 03:02:34.640218-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
500	1	Pago registrado	Pago de $21.00 registrado (incluye mora de $1.00)	exito	leido	2026-01-03 17:49:29.86916-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
501	1	Comprobante guardado	Comprobante del pago #40 guardado exitosamente	exito	leido	2026-01-03 17:49:30.124468-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
502	1	Lectura estimada confirmada	Lectura confirmada para medidor 10008. Consumo real: 4m³. ✅ Factura FACT-202601-0004 generada exitosamente	exito	leido	2026-01-03 18:52:13.006288-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
503	1	Lectura confirmada y factura generada	Se confirmó la lectura de 4m³ para tu medidor N° 10008. Factura FACT-202601-0004 generada por $22.00	info	leido	2026-01-03 18:52:13.390279-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
504	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-03 19:19:18.872827-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
505	1	Comprobante guardado	Comprobante del pago #41 guardado exitosamente	exito	leido	2026-01-03 19:19:20.203245-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
507	1	Comprobante guardado	Comprobante del pago #42 guardado exitosamente	exito	leido	2026-01-03 19:20:18.88316-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
508	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-03 19:24:25.664542-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
509	1	Comprobante guardado	Comprobante del pago #43 guardado exitosamente	exito	leido	2026-01-03 19:24:26.961549-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
510	1	Lectura estimada confirmada	Lectura confirmada para medidor 3332. Consumo real: 10m³. ✅ Factura FACT-202601-0005 generada exitosamente	exito	leido	2026-01-03 19:37:58.418408-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
512	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-03 19:38:56.229524-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
513	1	Lectura estimada confirmada	Lectura confirmada para medidor 1111. Consumo real: 15m³. ✅ Factura FACT-202601-0006 generada exitosamente	exito	leido	2026-01-03 19:39:46.007122-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
515	1	Pago registrado	Pago de $20.00 registrado	exito	leido	2026-01-03 19:46:49.120909-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
516	1	Comprobante guardado	Comprobante del pago #44 guardado exitosamente	exito	leido	2026-01-03 19:46:50.247843-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
517	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-03 19:51:23.255733-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
518	1	Comprobante guardado	Comprobante del pago #45 guardado exitosamente	exito	leido	2026-01-03 19:51:23.57461-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
519	1	Pago registrado	Pago de $13.50 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-03 19:51:40.293149-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
520	1	Comprobante guardado	Comprobante del pago #46 guardado exitosamente	exito	leido	2026-01-03 19:51:40.510214-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
521	1	Lectura estimada confirmada	Lectura confirmada para medidor 404004. Consumo real: 9m³. ✅ Factura FACT-202601-0007 generada exitosamente	exito	leido	2026-01-03 19:56:33.414014-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
523	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-03 19:56:58.646295-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
524	1	Comprobante guardado	Comprobante del pago #47 guardado exitosamente	exito	leido	2026-01-03 19:56:59.049286-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
525	1	Pago registrado	Pago de $20.00 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-03 19:57:13.800517-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
526	1	Comprobante guardado	Comprobante del pago #48 guardado exitosamente	exito	leido	2026-01-03 19:57:14.115931-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
527	1	Lectura estimada confirmada	Lectura confirmada para medidor 3342. Consumo real: 5m³. ✅ Factura FACT-202601-0008 generada exitosamente	exito	leido	2026-01-03 20:06:13.393472-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
530	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-04 23:59:12.805287-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
531	1	Comprobante guardado	Comprobante del pago #50 guardado exitosamente	exito	leido	2026-01-04 23:59:13.340817-05	2026-01-05 19:57:26.103901	f	\N	\N	\N	f	f	\N	media	\N
551	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:41:24.614751-05	2026-01-06 20:06:12.537966	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
535	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.17874-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
536	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.180736-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
537	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.181736-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
538	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.182859-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
539	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.184858-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
540	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.185857-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
541	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.186857-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
542	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.18886-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
543	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.189859-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
544	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.192862-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
545	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.193859-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
547	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.196856-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
548	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.19786-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
549	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 06:12:05.199856-05	\N	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
533	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 06:12:05.110089-05	2026-01-06 06:24:05.519412	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
552	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.619341-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
550	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:41:24.474474-05	2026-01-06 14:41:57.243317	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
534	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 06:12:05.175734-05	2026-01-06 20:06:12.537966	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
618	20	Mingas	Mingas el días sábado	info	leido	2026-01-06 20:35:31.352462-05	2026-01-06 20:37:26.233204	f	\N	\N	\N	f	f	\N	media	\N
553	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.621341-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
554	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.625878-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
555	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.627884-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
556	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.629414-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
557	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.630931-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
558	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.633943-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
559	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.636509-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
560	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.639059-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
561	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.641082-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
562	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.642081-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
564	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.64508-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
565	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.646607-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
566	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:41:24.647625-05	\N	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
619	20	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
621	18	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
622	12	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
623	11	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
624	4	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
625	6	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
626	17	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
627	3	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
628	14	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
629	16	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
630	10	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
631	15	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
633	13	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.721009-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
634	19	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.722021-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
635	5	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:51:19.722021-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
569	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:01.338747-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
570	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:11.52899-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
571	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:21.757517-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
572	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:31.956931-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
573	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:42.130832-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
574	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:52:52.439757-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
575	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:53:02.663452-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
576	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:53:12.8844-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
577	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:53:23.062778-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
578	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:53:33.238702-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
579	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:53:43.468456-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
581	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:54:03.858772-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
582	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:54:14.041619-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
583	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:54:24.316439-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
567	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:51:40.630008-05	2026-01-06 20:02:33.3067	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
632	9	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	leido	2026-01-06 20:51:19.721009-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	alta	\N
568	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:51:51.109147-05	2026-01-06 20:06:12.537966	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
602	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 20:04:04.084343-05	2026-01-06 20:06:05.142353	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:07.169409	alta	\N
636	20	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.741105-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
638	18	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
639	12	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
640	11	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
641	4	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
642	6	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
586	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 14:59:58.693862-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
587	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:08.871506-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
588	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:19.054668-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
589	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:29.2544-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
590	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:39.483808-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
591	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:49.658084-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
592	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:00:59.897342-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
593	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:01:10.173884-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
594	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:01:20.374488-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
595	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:01:30.568516-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
596	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:01:40.82545-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
598	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:02:01.256097-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
599	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:02:11.434307-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
600	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 15:02:21.619279-05	\N	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
584	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:59:38.147472-05	2026-01-06 20:02:33.3067	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
603	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:07.170446-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:09.211441	alta	\N
604	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:09.211441-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:11.737826	alta	\N
585	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:59:48.470754-05	2026-01-06 20:06:12.537966	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
643	17	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
644	3	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
645	14	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
646	16	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
647	10	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
648	15	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
605	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:11.738833-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:14.081393	alta	\N
606	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:14.082409-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:16.432847	alta	\N
607	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:16.433836-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:18.097033	alta	\N
608	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:18.098026-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:19.952757	alta	\N
609	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:19.954985-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:21.81873	alta	\N
610	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:21.819721-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:23.359746	alta	\N
611	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:23.361258-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:24.826588	alta	\N
612	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:24.826588-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:26.405527	alta	\N
613	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:26.406539-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:28.968674	alta	\N
650	13	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
651	19	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
652	5	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	no_leido	2026-01-06 20:53:35.742103-05	\N	f	\N	\N	\N	f	f	\N	alta	\N
653	4	Preuba	esto es una prueba	info	no_leido	2026-01-06 20:56:03.063981-05	\N	f	\N	\N	\N	f	f	\N	media	\N
654	20	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
656	18	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
657	12	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
658	11	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
659	4	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
660	6	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.465479-05	\N	f	\N	\N	\N	f	f	\N	media	\N
661	17	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
662	3	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
663	14	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
664	16	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
665	10	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
666	15	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
668	13	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
667	9	Preuba masiva	esto es una prueba de mensaje masiva	info	leido	2026-01-06 20:57:19.466477-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
669	19	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
670	5	Preuba masiva	esto es una prueba de mensaje masiva	info	no_leido	2026-01-06 20:57:19.466477-05	\N	f	\N	\N	\N	f	f	\N	media	\N
615	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:31.452386-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:32.872431	alta	\N
616	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:32.873429-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:34.416722	alta	\N
617	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 20:04:34.416722-05	\N	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:37.168381	alta	\N
672	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.721221-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
674	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.742034-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
675	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.743046-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
676	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.744559-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
677	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.745572-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
678	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.746573-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
679	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.747575-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
680	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.748574-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
681	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.748574-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
682	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.749573-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
683	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.750575-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
684	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.751575-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
686	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.753098-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
687	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.754099-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
688	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-06 21:08:54.756112-05	\N	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
620	1	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	leido	2026-01-06 20:51:19.721009-05	2026-01-06 16:39:24.332815	f	\N	\N	\N	f	f	\N	alta	\N
685	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 21:08:54.752086-05	2026-01-11 12:36:35.989487	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
601	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 20:04:00.880145-05	2026-01-06 16:39:24.332815	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:04.083344	alta	\N
637	1	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	leido	2026-01-06 20:53:35.741105-05	2026-01-06 16:39:24.332815	f	\N	\N	\N	f	f	\N	alta	\N
655	1	Preuba masiva	esto es una prueba de mensaje masiva	info	leido	2026-01-06 20:57:19.465479-05	2026-01-06 16:39:24.332815	f	\N	\N	\N	f	f	\N	media	\N
671	1	solo para mi	preuba	info	leido	2026-01-06 21:03:24.60654-05	2026-01-06 16:39:24.332815	f	\N	\N	\N	f	f	\N	media	\N
673	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 21:08:54.739779-05	2026-01-06 16:39:24.332815	t	2026-01-09 18:08:00	2026-01-10 16:08:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
689	1	para mi	mensaje solo para mi	info	leido	2026-01-06 16:38:42.485249-05	2026-01-06 16:39:24.332815	f	\N	\N	\N	f	f	\N	media	\N
690	1	Pago registrado	Pago de $4.00 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:13:43.164433-05	2026-01-06 22:14:05.65892	f	\N	\N	\N	f	f	\N	media	\N
709	16	Lectura confirmada y factura generada	Se confirmó la lectura de 10m³ para tu medidor N° 7775. Factura FACT-202601-0010 generada por $55.50	info	no_leido	2026-01-07 04:38:26.384297-05	\N	f	\N	\N	\N	f	f	\N	media	\N
691	1	Pago registrado	Pago de $4.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:16:59.375278-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
692	1	Pago registrado	Pago de $4.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:17:57.478119-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
693	1	Pago registrado	Pago de $7.00 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:19:37.964658-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
694	1	Pago registrado	Pago de $4.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:21:09.627907-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
695	1	Comprobante guardado	Comprobante del pago #55 guardado exitosamente	exito	leido	2026-01-07 03:21:17.590082-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
696	1	Pago registrado	Pago de $4.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:24:15.442729-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
697	1	Comprobante guardado	Comprobante del pago #56 guardado exitosamente	exito	leido	2026-01-07 03:24:17.167788-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
698	1	Pago registrado	Pago de $4.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:35:37.830592-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
699	1	Comprobante guardado	Comprobante del pago #57 guardado exitosamente	exito	leido	2026-01-07 03:35:39.384368-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
700	1	Pago registrado	Pago de $6.30 registrado (incluye mora de $1.00)	exito	leido	2026-01-07 03:46:52.086914-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
701	1	Comprobante guardado	Comprobante del pago #58 guardado exitosamente	exito	leido	2026-01-07 03:46:53.823228-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
702	1	Lectura estimada confirmada	Lectura confirmada para medidor 0003. Consumo real: 6m³. ✅ Factura FACT-202601-0009 generada exitosamente	exito	leido	2026-01-07 04:02:47.400425-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
704	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-07 04:17:30.046819-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
705	1	Comprobante guardado	Comprobante del pago #59 guardado exitosamente	exito	leido	2026-01-07 04:17:37.979976-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
706	1	Pago registrado	Pago de $20.00 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-07 04:23:20.488621-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
707	1	Comprobante guardado	Comprobante del pago #60 guardado exitosamente	exito	leido	2026-01-07 04:23:21.995653-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
703	9	Lectura confirmada y factura generada	Se confirmó la lectura de 6m³ para tu medidor N° 0003. Factura FACT-202601-0009 generada por $22.00	info	leido	2026-01-07 04:02:47.534561-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
708	1	Lectura estimada confirmada	Lectura confirmada para medidor 7775. Consumo real: 10m³. ✅ Factura FACT-202601-0010 generada exitosamente	exito	leido	2026-01-07 04:38:26.231712-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
710	1	Pago registrado	Pago de $57.50 registrado. 3 multa(s) pagada(s)	exito	leido	2026-01-07 04:52:15.875508-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
711	1	Comprobante guardado	Comprobante del pago #61 guardado exitosamente	exito	leido	2026-01-07 04:52:21.148304-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
712	1	Pago registrado	Pago de $4.00 registrado	exito	leido	2026-01-07 05:15:17.156456-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
713	1	Comprobante guardado	Comprobante del pago #62 guardado exitosamente	exito	leido	2026-01-07 05:15:18.798846-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
714	1	Pago registrado	Pago de $24.00 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-07 05:20:28.978016-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
715	1	Comprobante guardado	Comprobante del pago #63 guardado exitosamente	exito	leido	2026-01-07 05:20:31.335417-05	2026-01-07 10:00:02.107263	f	\N	\N	\N	f	f	\N	media	\N
717	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.910169-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
718	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.914202-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
719	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.915176-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
720	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.917541-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
721	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.918536-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
722	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.920524-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
723	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.921522-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
724	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.922522-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
725	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.925529-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
726	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.925529-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
727	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.928052-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
728	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.930053-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
730	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.933052-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
731	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.935053-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
732	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:30:59.936582-05	\N	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
734	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.498406-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
735	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.500401-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
794	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0002. Factura FACT-202511-0006 generada por $22.00	info	no_leido	2026-01-08 22:17:32.438402-05	\N	f	\N	\N	\N	f	f	\N	media	\N
796	4	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3333. Factura FACT-202511-0008 generada por $2.00	info	no_leido	2026-01-08 22:17:33.971905-05	\N	f	\N	\N	\N	f	f	\N	media	\N
798	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0004. Factura FACT-202511-0010 generada por $2.00	info	no_leido	2026-01-08 22:17:35.187551-05	\N	f	\N	\N	\N	f	f	\N	media	\N
799	16	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 7775. Factura FACT-202511-0011 generada por $2.00	info	no_leido	2026-01-08 22:17:35.732762-05	\N	f	\N	\N	\N	f	f	\N	media	\N
736	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.502926-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
737	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.507477-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
738	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.508459-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
739	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.509456-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
740	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.510468-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
741	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.511466-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
742	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.512743-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
743	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.513459-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
744	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.514459-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
745	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.515456-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
747	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.516964-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
748	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.517982-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
749	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:40:15.520988-05	\N	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
751	20	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.108391-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
752	18	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.110409-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
753	12	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.1114-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
754	11	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.114402-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
755	4	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.115393-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
756	6	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.118954-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
757	17	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.11995-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
758	3	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.120954-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
759	14	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.121963-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
746	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:40:15.515456-05	2026-01-11 12:36:35.989487	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
760	16	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.123957-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
761	10	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.125966-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
762	15	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.128532-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
764	13	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.130531-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
765	19	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.13153-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
766	5	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	no_leido	2026-01-07 10:41:21.132534-05	\N	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
716	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:30:59.879831-05	2026-01-07 10:41:46.759574	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
733	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:40:15.462347-05	2026-01-07 10:41:46.759574	t	2026-01-08 10:41:00	\N	\N	f	f	\N	alta	\N
750	1	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:41:21.104236-05	2026-01-07 10:41:46.759574	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
770	4	Lectura confirmada y factura generada	Se confirmó la lectura de 10m³ para tu medidor N° 3333.	info	no_leido	2026-01-08 19:06:42.732317-05	\N	f	\N	\N	\N	f	f	\N	media	\N
772	6	Lectura confirmada y factura generada	Se confirmó la lectura de 4m³ para tu medidor N° 0004. Factura FACT-202601-0011 generada por $47.04	info	no_leido	2026-01-08 19:07:37.909401-05	\N	f	\N	\N	\N	f	f	\N	media	\N
776	10	Lectura confirmada y factura generada	Se confirmó la lectura de 3m³ para tu medidor N° 0002. Factura FACT-202601-0012 generada por $2.00	info	no_leido	2026-01-08 19:40:01.772794-05	\N	f	\N	\N	\N	f	f	\N	media	\N
789	17	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 2222. Factura FACT-202511-0001 generada por $2.00	info	no_leido	2026-01-08 22:17:29.799299-05	\N	f	\N	\N	\N	f	f	\N	media	\N
790	18	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3332. Factura FACT-202511-0002 generada por $22.00	info	no_leido	2026-01-08 22:17:30.83361-05	\N	f	\N	\N	\N	f	f	\N	media	\N
791	13	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 1111. Factura FACT-202511-0003 generada por $2.00	info	no_leido	2026-01-08 22:17:31.223542-05	\N	f	\N	\N	\N	f	f	\N	media	\N
792	11	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 404004. Factura FACT-202511-0004 generada por $2.00	info	no_leido	2026-01-08 22:17:31.694223-05	\N	f	\N	\N	\N	f	f	\N	media	\N
793	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3342. Factura FACT-202511-0005 generada por $2.00	info	no_leido	2026-01-08 22:17:32.015441-05	\N	f	\N	\N	\N	f	f	\N	media	\N
763	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:41:21.129535-05	2026-01-11 12:36:35.989487	t	2026-01-08 10:42:00	2026-01-08 16:42:00	\N	f	f	\N	alta	6h
800	5	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 19999. Factura FACT-202511-0012 generada por $15.50	info	no_leido	2026-01-08 22:17:36.03602-05	\N	f	\N	\N	\N	f	f	\N	media	\N
804	17	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 2222. Factura FACT-202512-0001 generada por $2.00	info	no_leido	2026-01-08 22:19:12.361886-05	\N	f	\N	\N	\N	f	f	\N	media	\N
809	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0002. Factura FACT-202512-0006 generada por $2.00	info	no_leido	2026-01-08 22:19:14.763128-05	\N	f	\N	\N	\N	f	f	\N	media	\N
816	19	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 008. Factura FACT-202512-0013 generada por $2.00	info	no_leido	2026-01-08 22:19:19.202445-05	\N	f	\N	\N	\N	f	f	\N	media	\N
818	1	Confirmación masiva completada	Se confirmaron 14 lecturas y se generaron 14 facturas para el periodo 12/2025	exito	leido	2026-01-08 22:19:19.807988-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
819	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-08 22:20:06.013823-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
801	19	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 008. Factura FACT-202511-0013 generada por $2.00	info	no_leido	2026-01-08 22:17:36.242098-05	\N	f	\N	\N	\N	f	f	\N	media	\N
807	11	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 404004. Factura FACT-202512-0004 generada por $2.00	info	no_leido	2026-01-08 22:19:13.919264-05	\N	f	\N	\N	\N	f	f	\N	media	\N
814	16	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 7775. Factura FACT-202512-0011 generada por $2.00	info	no_leido	2026-01-08 22:19:18.673164-05	\N	f	\N	\N	\N	f	f	\N	media	\N
803	1	Confirmación masiva completada	Se confirmaron 14 lecturas y se generaron 14 facturas para el periodo 11/2025	exito	leido	2026-01-08 22:17:36.729233-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
812	9	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0003. Factura FACT-202512-0009 generada por $2.00	info	leido	2026-01-08 22:19:16.97224-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
802	20	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0005. Factura FACT-202511-0014 generada por $2.00	info	no_leido	2026-01-08 22:17:36.596717-05	\N	f	\N	\N	\N	f	f	\N	media	\N
806	13	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 1111. Factura FACT-202512-0003 generada por $2.00	info	no_leido	2026-01-08 22:19:13.292437-05	\N	f	\N	\N	\N	f	f	\N	media	\N
811	4	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3333. Factura FACT-202512-0008 generada por $2.00	info	no_leido	2026-01-08 22:19:16.620581-05	\N	f	\N	\N	\N	f	f	\N	media	\N
815	5	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 19999. Factura FACT-202512-0012 generada por $2.00	info	no_leido	2026-01-08 22:19:19.0003-05	\N	f	\N	\N	\N	f	f	\N	media	\N
805	18	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3332. Factura FACT-202512-0002 generada por $2.00	info	no_leido	2026-01-08 22:19:12.945345-05	\N	f	\N	\N	\N	f	f	\N	media	\N
817	20	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0005. Factura FACT-202512-0014 generada por $2.00	info	no_leido	2026-01-08 22:19:19.659327-05	\N	f	\N	\N	\N	f	f	\N	media	\N
810	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 10008. Factura FACT-202512-0007 generada por $2.00	info	leido	2026-01-08 22:19:16.093323-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
808	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3342. Factura FACT-202512-0005 generada por $2.00	info	no_leido	2026-01-08 22:19:14.319672-05	\N	f	\N	\N	\N	f	f	\N	media	\N
813	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0004. Factura FACT-202512-0010 generada por $2.00	info	no_leido	2026-01-08 22:19:18.052525-05	\N	f	\N	\N	\N	f	f	\N	media	\N
795	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 10008. Factura FACT-202511-0007 generada por $2.00	info	leido	2026-01-08 22:17:33.474108-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
767	1	Pago registrado	Pago de $4.00 registrado (incluye mora de $1.00)	exito	leido	2026-01-08 18:50:59.998312-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
768	1	Comprobante guardado	Comprobante del pago #64 guardado exitosamente	exito	leido	2026-01-08 18:51:07.552631-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
769	1	Lectura estimada confirmada	Lectura confirmada para medidor 3333. Consumo real: 10m³. ⚠️ Lectura confirmada pero: Ya existe factura activa para el periodo 2026-01	exito	leido	2026-01-08 19:06:42.646753-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
771	1	Lectura estimada confirmada	Lectura confirmada para medidor 0004. Consumo real: 4m³. ✅ Factura FACT-202601-0011 generada exitosamente	exito	leido	2026-01-08 19:07:37.517128-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
773	1	Pago registrado	Pago de $44.80 registrado. 2 multa(s) pagada(s)	exito	leido	2026-01-08 19:34:34.665848-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
774	1	Comprobante guardado	Comprobante del pago #65 guardado exitosamente	exito	leido	2026-01-08 19:35:16.734476-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
775	1	Lectura estimada confirmada	Lectura confirmada para medidor 0002. Consumo real: 3m³. ✅ Factura FACT-202601-0012 generada exitosamente	exito	leido	2026-01-08 19:40:01.622648-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
777	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-08 19:40:23.018824-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
778	1	Comprobante guardado	Comprobante del pago #66 guardado exitosamente	exito	leido	2026-01-08 19:40:27.598701-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
779	1	Pago registrado	Pago de $20.00 registrado	exito	leido	2026-01-08 19:46:28.66971-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
780	1	Pago registrado	Pago de $53.50 registrado. 3 multa(s) pagada(s)	exito	leido	2026-01-08 20:39:53.576163-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
781	1	Comprobante guardado	Comprobante del pago #68 guardado exitosamente	exito	leido	2026-01-08 20:39:59.265969-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
782	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-08 21:08:00.685856-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
783	1	Pago registrado	Pago de $4.00 registrado	exito	leido	2026-01-08 21:12:01.371236-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
784	1	Comprobante guardado	Comprobante del pago #70 guardado exitosamente	exito	leido	2026-01-08 21:12:06.23745-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
785	1	Pago registrado	Pago de $4.00 registrado	exito	leido	2026-01-08 21:13:45.081857-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
786	1	Comprobante guardado	Comprobante del pago #71 guardado exitosamente	exito	leido	2026-01-08 21:13:47.711057-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
787	1	Pago registrado	Pago de $4.00 registrado	exito	leido	2026-01-08 21:16:09.227491-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
788	1	Comprobante guardado	Comprobante del pago #72 guardado exitosamente	exito	leido	2026-01-08 21:16:11.674543-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
820	1	Comprobante guardado	Comprobante del pago #73 guardado exitosamente	exito	leido	2026-01-08 22:20:13.21976-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
821	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 00:18:57.60323-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
822	1	Comprobante guardado	Comprobante del pago #74 guardado exitosamente	exito	leido	2026-01-09 00:19:05.838229-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
823	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 00:35:04.422868-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
824	1	Comprobante guardado	Comprobante del pago #75 guardado exitosamente	exito	leido	2026-01-09 00:35:06.347069-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
825	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 01:06:01.606913-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
826	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 01:10:26.645889-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
827	1	Comprobante guardado	Comprobante del pago #77 guardado exitosamente	exito	leido	2026-01-09 01:11:28.380578-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
828	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 02:04:14.586896-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
829	1	Comprobante guardado	Comprobante del pago #78 guardado exitosamente	exito	leido	2026-01-09 02:04:18.012956-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
830	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-09 02:14:31.030298-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
831	1	Comprobante guardado	Comprobante del pago #79 guardado exitosamente	exito	leido	2026-01-09 02:14:35.355649-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
832	1	Pago registrado	Pago de $13.50 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-09 02:20:58.284428-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
833	1	Comprobante guardado	Comprobante del pago #80 guardado exitosamente	exito	leido	2026-01-09 02:21:01.35954-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
834	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-09 02:39:48.28288-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
835	1	Comprobante guardado	Comprobante del pago #81 guardado exitosamente	exito	leido	2026-01-09 02:39:51.156636-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
836	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-09 03:28:25.494946-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
837	1	Comprobante guardado	Comprobante del pago #82 guardado exitosamente	exito	leido	2026-01-09 03:28:31.378876-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
838	1	Pago registrado	Pago de $20.00 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-09 03:38:52.08487-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
839	1	Comprobante guardado	Comprobante del pago #83 guardado exitosamente	exito	leido	2026-01-09 03:38:58.211481-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
840	1	Pago registrado	Pago de $2.00 registrado. 1 multa(s) liberada(s)	exito	leido	2026-01-09 04:39:01.346311-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
841	1	Comprobante guardado	Comprobante del pago #84 guardado exitosamente	exito	leido	2026-01-09 04:39:10.256539-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
842	1	Pago registrado	Pago de $20.00 registrado. 1 multa(s) pagada(s)	exito	leido	2026-01-09 04:39:27.51391-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
843	1	Comprobante guardado	Comprobante del pago #85 guardado exitosamente	exito	leido	2026-01-09 04:39:37.788524-05	2026-01-10 10:50:26.425221	f	\N	\N	\N	f	f	\N	media	\N
844	17	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 2222. Factura FACT-202601-0001 generada por $2.00	info	no_leido	2026-01-10 16:14:22.666826-05	\N	f	\N	\N	\N	f	f	\N	media	\N
845	18	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3332. Factura FACT-202601-0002 generada por $2.00	info	no_leido	2026-01-10 16:14:23.355999-05	\N	f	\N	\N	\N	f	f	\N	media	\N
846	13	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 1111. Factura FACT-202601-0003 generada por $2.00	info	no_leido	2026-01-10 16:14:23.882979-05	\N	f	\N	\N	\N	f	f	\N	media	\N
847	11	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 404004. Factura FACT-202601-0004 generada por $2.00	info	no_leido	2026-01-10 16:14:24.513977-05	\N	f	\N	\N	\N	f	f	\N	media	\N
848	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3342. Factura FACT-202601-0005 generada por $2.00	info	no_leido	2026-01-10 16:14:24.922548-05	\N	f	\N	\N	\N	f	f	\N	media	\N
849	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0002. Factura FACT-202601-0006 generada por $2.00	info	no_leido	2026-01-10 16:14:25.397554-05	\N	f	\N	\N	\N	f	f	\N	media	\N
851	4	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3333. Factura FACT-202601-0008 generada por $2.00	info	no_leido	2026-01-10 16:14:27.731704-05	\N	f	\N	\N	\N	f	f	\N	media	\N
853	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0004. Factura FACT-202601-0010 generada por $2.00	info	no_leido	2026-01-10 16:14:29.323194-05	\N	f	\N	\N	\N	f	f	\N	media	\N
854	16	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 7775. Factura FACT-202601-0011 generada por $2.00	info	no_leido	2026-01-10 16:14:30.049872-05	\N	f	\N	\N	\N	f	f	\N	media	\N
855	5	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 19999. Factura FACT-202601-0012 generada por $2.00	info	no_leido	2026-01-10 16:14:30.520834-05	\N	f	\N	\N	\N	f	f	\N	media	\N
856	19	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 008. Factura FACT-202601-0013 generada por $2.00	info	no_leido	2026-01-10 16:14:30.780692-05	\N	f	\N	\N	\N	f	f	\N	media	\N
857	20	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0005. Factura FACT-202601-0014 generada por $2.00	info	no_leido	2026-01-10 16:14:31.317601-05	\N	f	\N	\N	\N	f	f	\N	media	\N
850	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 10008. Factura FACT-202601-0007 generada por $2.00	info	leido	2026-01-10 16:14:27.119709-05	2026-01-10 11:14:47.483858	f	\N	\N	\N	f	f	\N	media	\N
858	1	Confirmación masiva completada	Se confirmaron 14 lecturas y se generaron 14 facturas para el periodo 01/2026	exito	leido	2026-01-10 16:14:31.451135-05	2026-01-10 11:14:47.483858	f	\N	\N	\N	f	f	\N	media	\N
859	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2026-01-10 16:38:39.793128-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
862	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2026-01-10 16:47:00.786945-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
852	9	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0003. Factura FACT-202601-0009 generada por $2.00	info	leido	2026-01-10 16:14:28.119997-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
861	9	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 0003. Factura FACT-202601-0015 generada por $2.00	info	leido	2026-01-10 16:39:13.694585-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
863	9	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0003. Factura FACT-202601-0015 generada por $55.50	info	leido	2026-01-10 16:47:21.543015-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
929	1	Comprobante guardado	Comprobante del pago #108 guardado exitosamente	exito	leido	2026-01-16 00:41:14.312352-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
930	1	Comprobante guardado	Comprobante del pago #108 guardado exitosamente	exito	leido	2026-01-16 00:46:33.242441-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
931	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-16 00:47:43.345604-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
935	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 01:52:26.797444-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
860	1	Lectura creada	Lectura del medidor 0003 registrada. Consumo: 10m³. ✅ Factura FACT-202601-0015 generada exitosamente	exito	leido	2026-01-10 16:39:13.571234-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
864	1	Confirmación masiva completada	Se confirmaron 1 lecturas y se generaron 1 facturas para el periodo 01/2026	exito	leido	2026-01-10 16:47:21.68663-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
865	1	Pago registrado	Pago de $53.50 registrado. 3 multa(s) pagada(s)	exito	leido	2026-01-10 17:03:35.894931-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
866	1	Comprobante guardado	Comprobante del pago #86 guardado exitosamente	exito	leido	2026-01-10 17:03:42.753516-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
867	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-10 17:04:19.906429-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
868	1	Comprobante guardado	Comprobante del pago #87 guardado exitosamente	exito	leido	2026-01-10 17:04:24.908249-05	2026-01-10 12:22:19.387661	f	\N	\N	\N	f	f	\N	media	\N
870	11	Lectura confirmada y factura generada	Se confirmó la lectura de 20m³ para tu medidor N° 404004. Factura FACT-202602-0001 generada por $7.00	info	no_leido	2026-01-11 16:08:47.257411-05	\N	f	\N	\N	\N	f	f	\N	media	\N
871	17	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 2222. Factura FACT-202602-0002 generada por $2.00	info	no_leido	2026-01-11 16:09:03.528653-05	\N	f	\N	\N	\N	f	f	\N	media	\N
872	18	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3332. Factura FACT-202602-0003 generada por $2.00	info	no_leido	2026-01-11 16:09:04.283721-05	\N	f	\N	\N	\N	f	f	\N	media	\N
873	13	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 1111. Factura FACT-202602-0004 generada por $2.00	info	no_leido	2026-01-11 16:09:04.786398-05	\N	f	\N	\N	\N	f	f	\N	media	\N
874	14	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3342. Factura FACT-202602-0005 generada por $2.00	info	no_leido	2026-01-11 16:09:05.181578-05	\N	f	\N	\N	\N	f	f	\N	media	\N
875	10	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0002. Factura FACT-202602-0006 generada por $2.00	info	no_leido	2026-01-11 16:09:05.819995-05	\N	f	\N	\N	\N	f	f	\N	media	\N
877	4	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 3333. Factura FACT-202602-0008 generada por $2.00	info	no_leido	2026-01-11 16:09:08.455758-05	\N	f	\N	\N	\N	f	f	\N	media	\N
879	6	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0004. Factura FACT-202602-0010 generada por $2.00	info	no_leido	2026-01-11 16:09:10.562547-05	\N	f	\N	\N	\N	f	f	\N	media	\N
880	16	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 7775. Factura FACT-202602-0011 generada por $2.00	info	no_leido	2026-01-11 16:09:11.390592-05	\N	f	\N	\N	\N	f	f	\N	media	\N
881	5	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 19999. Factura FACT-202602-0012 generada por $2.00	info	no_leido	2026-01-11 16:09:11.819899-05	\N	f	\N	\N	\N	f	f	\N	media	\N
882	19	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 008. Factura FACT-202602-0013 generada por $2.00	info	no_leido	2026-01-11 16:09:12.166017-05	\N	f	\N	\N	\N	f	f	\N	media	\N
883	20	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0005. Factura FACT-202602-0014 generada por $2.00	info	no_leido	2026-01-11 16:09:12.848444-05	\N	f	\N	\N	\N	f	f	\N	media	\N
3	9	Usuario modificado	El usuario 'jeny' fue modificado correctamente.	info	leido	2025-11-07 14:02:48.357295-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
462	9	Nueva lectura y factura	Se registró una lectura de 4m³ para tu medidor N° 0003. Factura FACT-202512-0007 generada por $22.00	info	leido	2025-12-29 21:26:57.593243-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
546	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 06:12:05.194855-05	2026-01-11 12:36:35.989487	t	2026-01-08 01:11:00	2026-01-09 01:11:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
563	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:41:24.644081-05	2026-01-11 12:36:35.989487	t	2026-01-07 22:40:00	2026-01-08 09:40:00	Facturación, Lecturas, Pagos	f	f	\N	alta	\N
580	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 14:53:53.681592-05	2026-01-11 12:36:35.989487	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
597	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 15:01:51.040681-05	2026-01-11 12:36:35.989487	t	2026-01-08 09:51:00	2026-01-09 09:51:00	Facturación, Lecturas, Pagos	t	f	\N	alta	\N
649	9	Reunión	Se debe asistir a un reunión el día sábado a las 7:00	info	leido	2026-01-06 20:53:35.742103-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	alta	\N
614	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-06 20:04:28.968674-05	2026-01-11 12:36:35.989487	t	2026-01-08 15:03:00	2026-01-09 15:03:00	Facturación, Lecturas, Pagos	t	t	2026-01-06 20:04:31.452386	alta	\N
729	9	Mantenimiento Programado del Sistema	Se realizará un mantenimiento programado para mejorar el rendimiento y estabilidad del sistema. Durante este período, el acceso al sistema estará temporalmente suspendido.	mantenimiento	leido	2026-01-07 10:30:59.93205-05	2026-01-11 12:36:35.989487	t	2026-01-08 16:29:00	2026-01-09 13:27:00	\N	f	f	\N	alta	20h
869	1	Lectura estimada confirmada	Lectura confirmada para medidor 404004. Consumo real: 20m³. ✅ Factura FACT-202602-0001 generada exitosamente	exito	leido	2026-01-11 16:08:47.04889-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
797	9	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0003. Factura FACT-202511-0009 generada por $2.00	info	leido	2026-01-08 22:17:34.283967-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
878	9	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 0003. Factura FACT-202602-0009 generada por $2.00	info	leido	2026-01-11 16:09:09.064074-05	2026-01-11 12:36:35.989487	f	\N	\N	\N	f	f	\N	media	\N
876	1	Lectura confirmada y factura generada	Se confirmó tu lectura de 10m³ para el medidor N° 10008. Factura FACT-202602-0007 generada por $2.00	info	leido	2026-01-11 16:09:07.783725-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
884	1	Confirmación masiva completada	Se confirmaron 13 lecturas y se generaron 13 facturas para el periodo 02/2026	exito	leido	2026-01-11 16:09:13.068987-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
885	1	Precio de servicio actualizado	El precio del servicio 'Instalacion' cambió de $50.00 a $55.00.	info	leido	2026-01-11 16:18:45.22804-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
886	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-11 17:15:23.816557-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
887	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-11 17:26:36.570935-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
888	1	Comprobante guardado	Comprobante del pago #89 guardado exitosamente	exito	leido	2026-01-11 17:26:43.83266-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
889	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2026-01-11 17:32:43.575026-05	2026-01-11 12:57:57.281509	f	\N	\N	\N	f	f	\N	media	\N
891	16	Medidor retirado	El medidor '7775' fue retirado de su afiliación (código 14).	info	no_leido	2026-01-12 15:16:36.161976-05	\N	f	\N	\N	\N	f	f	\N	media	\N
892	20	Medidor asignado	Se le ha asignado el medidor '7775' a su afiliación (código 18).	info	no_leido	2026-01-12 15:16:36.211575-05	\N	f	\N	\N	\N	f	f	\N	media	\N
895	20	Medidor retirado	El medidor '7775' fue retirado de su afiliación (código 18).	info	no_leido	2026-01-12 15:36:22.388894-05	\N	f	\N	\N	\N	f	f	\N	media	\N
896	16	Medidor asignado	Se le ha asignado el medidor '7775' a su afiliación (código 14).	info	no_leido	2026-01-12 15:36:22.426859-05	\N	f	\N	\N	\N	f	f	\N	media	\N
898	19	Medidor retirado	El medidor '008' fue retirado de su afiliación (código 15).	info	no_leido	2026-01-12 15:45:39.883054-05	\N	f	\N	\N	\N	f	f	\N	media	\N
899	3	Medidor asignado	Se le ha asignado el medidor '008' a su afiliación (código 17).	info	no_leido	2026-01-12 15:45:39.91831-05	\N	f	\N	\N	\N	f	f	\N	media	\N
901	3	Nueva lectura y factura	Se registró una lectura de 8m³ para tu medidor N° 008. Factura FACT-202603-0001 generada por $2.24	info	no_leido	2026-01-12 16:27:23.474134-05	\N	f	\N	\N	\N	f	f	\N	media	\N
904	3	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 008. Factura FACT-202603-0001 generada por $17.36	info	no_leido	2026-01-12 16:34:53.767429-05	\N	f	\N	\N	\N	f	f	\N	media	\N
890	1	Medidor modificado	El medidor '7775' fue modificado correctamente.	info	leido	2026-01-12 15:16:36.088517-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
893	1	Servicio creado	El servicio 'Cambio de medidor' fue creado correctamente.	exito	leido	2026-01-12 15:35:34.136704-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
894	1	Medidor modificado	El medidor '7775' fue modificado correctamente.	info	leido	2026-01-12 15:36:22.349784-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
897	1	Medidor modificado	El medidor '008' fue modificado correctamente.	info	leido	2026-01-12 15:45:39.843378-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
900	1	Lectura creada	Lectura del medidor 008 registrada. Consumo: 8m³. ✅ Factura FACT-202603-0001 generada exitosamente	exito	leido	2026-01-12 16:27:23.346597-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
902	1	Lectura eliminada	La lectura fue eliminada correctamente.	info	leido	2026-01-12 16:34:14.345846-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
903	1	Lectura creada	Lectura del medidor 008 registrada. Consumo: 10m³. ✅ Factura FACT-202603-0001 generada exitosamente	exito	leido	2026-01-12 16:34:53.597262-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
905	1	Pago registrado	Pago de $17.36 registrado	exito	leido	2026-01-12 19:13:13.625328-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
906	1	Comprobante guardado	Comprobante del pago #90 guardado exitosamente	exito	leido	2026-01-12 19:13:18.320759-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
907	1	Pago registrado	Pago de $17.36 registrado	exito	leido	2026-01-12 19:26:09.969501-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
908	1	Comprobante guardado	Comprobante del pago #91 guardado exitosamente	exito	leido	2026-01-12 19:26:16.045726-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
909	1	Pago registrado	Pago de $17.36 registrado	exito	leido	2026-01-12 19:46:28.968751-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
910	1	Comprobante guardado	Comprobante del pago #92 guardado exitosamente	exito	leido	2026-01-12 19:46:34.298097-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
911	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-12 21:07:06.949874-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
912	1	Comprobante guardado	Comprobante del pago #93 guardado exitosamente	exito	leido	2026-01-12 21:07:19.258562-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
913	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-12 21:18:06.659503-05	2026-01-13 21:11:05.620663	f	\N	\N	\N	f	f	\N	media	\N
914	1	Lectura creada	Lectura del medidor 10008 registrada. Consumo: 10m³. ✅ Factura FACT-202603-0002 generada exitosamente	exito	leido	2026-01-14 14:38:51.48627-05	2026-01-14 20:36:37.851379	f	\N	\N	\N	f	f	\N	media	\N
915	1	Nueva lectura y factura	Se registró una lectura de 10m³ para tu medidor N° 10008. Factura FACT-202603-0002 generada por $15.50	info	leido	2026-01-14 14:38:52.534454-05	2026-01-14 20:36:37.851379	f	\N	\N	\N	f	f	\N	media	\N
916	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-14 14:40:11.096269-05	2026-01-14 20:36:37.851379	f	\N	\N	\N	f	f	\N	media	\N
957	12	Medidor retirado	El medidor '0005' fue retirado de su afiliación (código 3).	info	no_leido	2026-01-25 16:08:19.926474-05	\N	f	\N	\N	\N	f	f	\N	media	\N
958	19	Medidor asignado	Se le ha asignado el medidor '0005' a su afiliación (código 15).	info	no_leido	2026-01-25 16:08:19.987491-05	\N	f	\N	\N	\N	f	f	\N	media	\N
960	19	Nueva lectura y factura	Se registró una lectura de 13m³ para tu medidor N° 0005. Factura FACT-202603-0003 generada por $15.50	info	no_leido	2026-01-25 16:10:53.711526-05	\N	f	\N	\N	\N	f	f	\N	media	\N
917	1	Pago registrado	Pago de $2.00 registrado	exito	leido	2026-01-15 02:01:42.979005-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
918	1	Comprobante guardado	Comprobante del pago #94 guardado exitosamente	exito	leido	2026-01-15 02:01:46.729593-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
919	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-15 02:45:39.391141-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
920	1	Comprobante guardado	Comprobante del pago #96 guardado exitosamente	exito	leido	2026-01-15 02:45:46.139608-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
921	1	Pago múltiple registrado	$5.00 pagados en 2 facturas. Mora: $1.00	exito	leido	2026-01-15 19:15:58.425228-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
922	1	Comprobante guardado	Comprobante del pago #98 guardado exitosamente	exito	leido	2026-01-15 19:16:01.193257-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
923	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-15 19:30:04.984506-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
924	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-15 19:36:49.77107-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
925	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-15 19:37:48.620108-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
926	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-15 19:40:49.863093-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
927	1	Comprobante guardado	Comprobante del pago #106 guardado exitosamente	exito	leido	2026-01-15 19:42:12.489683-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
928	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-16 00:41:11.693649-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
932	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-16 00:57:13.376323-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
933	1	Lectura actualizada	Lectura modificada. Factura recalculada (mantiene multas y servicios)	info	leido	2026-01-16 01:01:02.143167-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
934	1	Pago múltiple registrado	$9.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-16 01:52:22.109377-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
936	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 01:52:30.956001-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
937	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 01:52:34.381672-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
938	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 02:02:58.447394-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
939	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 02:03:02.040261-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
940	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 02:04:06.152853-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
941	1	Comprobante guardado	Comprobante del pago #112 guardado exitosamente	exito	leido	2026-01-16 02:04:09.682334-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
942	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-16 02:12:52.472228-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
943	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:12:56.697553-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
944	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:12:58.731647-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
945	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:13:00.45221-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
946	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:21:46.648837-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
947	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:21:48.343704-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
948	1	Comprobante guardado	Comprobante del pago #114 guardado exitosamente	exito	leido	2026-01-16 02:21:49.773014-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
949	1	Pago múltiple registrado	$4.00 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-16 02:21:58.567189-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
950	1	Comprobante guardado	Comprobante del pago #116 guardado exitosamente	exito	leido	2026-01-16 02:22:05.283363-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
951	1	Comprobante guardado	Comprobante del pago #117 guardado exitosamente	exito	leido	2026-01-16 02:22:09.825849-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
952	1	Comprobante guardado	Comprobante del pago #116 guardado exitosamente	exito	leido	2026-01-16 02:22:14.818744-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
953	1	Comprobante guardado	Comprobante del pago #117 guardado exitosamente	exito	leido	2026-01-16 02:22:20.284767-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
954	1	Comprobante guardado	Comprobante del pago #117 guardado exitosamente	exito	leido	2026-01-16 02:22:24.862703-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
955	1	Comprobante guardado	Comprobante del pago #116 guardado exitosamente	exito	leido	2026-01-16 02:22:30.03842-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
956	1	Medidor modificado	El medidor '0005' fue modificado correctamente.	info	leido	2026-01-25 16:08:19.818926-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
959	1	Lectura creada	Lectura del medidor 0005 registrada. Consumo: 13m³. ✅ Factura FACT-202603-0003 generada exitosamente	exito	leido	2026-01-25 16:10:53.559964-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
961	1	Pago múltiple registrado	$17.50 pagados en 2 facturas. Mora: $0.00	exito	leido	2026-01-25 16:14:19.207934-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
962	1	Comprobante guardado	Comprobante del pago #118 guardado exitosamente	exito	leido	2026-01-25 16:14:20.934353-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
963	1	Comprobante guardado	Comprobante del pago #119 guardado exitosamente	exito	leido	2026-01-25 16:14:21.308217-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
964	1	Comprobante guardado	Comprobante del pago #119 guardado exitosamente	exito	leido	2026-01-25 16:14:21.709906-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
965	1	Comprobante guardado	Comprobante del pago #118 guardado exitosamente	exito	leido	2026-01-25 16:14:22.159553-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
966	1	Comprobante guardado	Comprobante del pago #118 guardado exitosamente	exito	leido	2026-01-25 16:14:22.491161-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
967	1	Comprobante guardado	Comprobante del pago #119 guardado exitosamente	exito	leido	2026-01-25 16:14:22.871351-05	2026-01-26 10:30:49.828204	f	\N	\N	\N	f	f	\N	media	\N
968	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-27 00:26:17.451672-05	2026-01-26 19:26:55.260812	f	\N	\N	\N	f	f	\N	media	\N
969	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-27 00:26:32.38215-05	2026-01-26 19:26:55.260812	f	\N	\N	\N	f	f	\N	media	\N
970	1	Afiliado modificado	El afiliado 'Jeferson Alexander Charco Tenesaca' fue modificado correctamente.	info	leido	2026-01-29 19:55:52.751725-05	2026-01-29 14:57:05.725161	f	\N	\N	\N	f	f	\N	media	\N
971	1	Afiliado modificado	El afiliado 'Rene R Reyes' fue modificado correctamente.	info	leido	2026-01-29 19:56:23.124467-05	2026-01-29 14:57:05.725161	f	\N	\N	\N	f	f	\N	media	\N
972	1	Afiliado creado	El usuario 'Sofia Hernandez' fue afiliado correctamente con código 19.	exito	leido	2026-01-29 19:57:28.478516-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
973	1	Afiliado modificado	El afiliado 'Sofia Hernandez' fue modificado correctamente.	info	leido	2026-01-29 19:57:44.209729-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
974	1	Afiliado modificado	El afiliado 'Jeferson Alexander Charco Tenesaca' fue modificado correctamente.	info	leido	2026-01-29 19:58:36.343167-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
975	1	Afiliado modificado	El afiliado 'Jeferson Alexander Charco Tenesaca' fue modificado correctamente.	info	leido	2026-01-29 20:08:11.138299-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
976	1	Afiliado eliminado	El afiliado 'Sofia Hernandez' fue eliminado correctamente.	info	leido	2026-01-29 20:08:36.726312-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
977	1	Afiliado creado	El usuario 'Sofia Hernandez' fue afiliado correctamente con código 1113.	exito	leido	2026-01-29 20:09:23.162836-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
978	1	Afiliado eliminado	El afiliado 'Sofia Hernandez' fue eliminado correctamente.	info	leido	2026-01-29 20:09:37.853076-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
979	1	Afiliado eliminado	El afiliado 'Rene R Reyes' fue eliminado correctamente.	info	leido	2026-01-29 20:10:03.925324-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
980	1	Afiliado no eliminado	El afiliado 'Jose J Acan' no se puede eliminar porque tiene relaciones con otros módulos.	alerta	leido	2026-01-29 20:10:15.266617-05	2026-01-29 15:10:36.733578	f	\N	\N	\N	f	f	\N	media	\N
981	1	Carga masiva completada	Se crearon 1 afiliados con medidores. 1 errores.	advertencia	leido	2026-01-29 20:21:06.692512-05	2026-01-29 15:23:23.040036	f	\N	\N	\N	f	f	\N	media	\N
982	1	Carga masiva completada	Se crearon 1 afiliados con medidores. 1 errores.	advertencia	leido	2026-01-29 20:23:41.218349-05	2026-01-29 16:23:31.404857	f	\N	\N	\N	f	f	\N	media	\N
983	1	Carga masiva completada	Se crearon 1 afiliados con medidores. 1 errores.	advertencia	leido	2026-01-29 21:10:43.922563-05	2026-01-29 16:23:31.404857	f	\N	\N	\N	f	f	\N	media	\N
984	1	Carga masiva completada	Se crearon 1 afiliados con medidores. 1 errores.	advertencia	leido	2026-01-29 21:22:34.291844-05	2026-01-29 16:23:31.404857	f	\N	\N	\N	f	f	\N	media	\N
986	9	Nueva lectura y factura	Se registró una lectura de 5m³ para tu medidor N° 0003. Factura FACT-202603-0004 generada por $4.00	info	no_leido	2026-01-31 15:44:31.884162-05	\N	f	\N	\N	\N	f	f	\N	media	\N
985	1	Lectura creada	Lectura del medidor 0003 registrada. Consumo: 5m³. ✅ Factura FACT-202603-0004 generada exitosamente	exito	leido	2026-01-31 15:44:31.701024-05	2026-01-31 11:00:58.550078	f	\N	\N	\N	f	f	\N	media	\N
987	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-31 16:44:26.091457-05	2026-01-31 14:01:06.735827	f	\N	\N	\N	f	f	\N	media	\N
988	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-31 16:44:33.719507-05	2026-01-31 14:01:06.735827	f	\N	\N	\N	f	f	\N	media	\N
989	1	Usuario modificado	El usuario 'admin' fue modificado correctamente.	info	leido	2026-01-31 16:45:25.767178-05	2026-01-31 14:01:06.735827	f	\N	\N	\N	f	f	\N	media	\N
990	1	Lecturas Enero/2026 importadas	2 lecturas y 2 facturas generadas correctamente	exito	leido	2026-01-31 17:32:58.409251-05	2026-01-31 14:01:06.735827	f	\N	\N	\N	f	f	\N	media	\N
991	1	Backup creado	El backup 'jaap_sanjapamba_2026-01-31_14-38-31.dump' fue creado correctamente.	exito	no_leido	2026-01-31 19:38:32.087691-05	\N	f	\N	\N	\N	f	f	\N	media	\N
\.


--
-- Data for Name: pga_jobagent; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_jobagent (jagpid, jaglogintime, jagstation) FROM stdin;
\.


--
-- Data for Name: pga_jobclass; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_jobclass (jclid, jclname) FROM stdin;
\.


--
-- Data for Name: pga_job; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_job (jobid, jobjclid, jobname, jobdesc, jobhostagent, jobenabled, jobcreated, jobchanged, jobagentid, jobnextrun, joblastrun) FROM stdin;
\.


--
-- Data for Name: pga_schedule; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_schedule (jscid, jscjobid, jscname, jscdesc, jscenabled, jscstart, jscend, jscminutes, jschours, jscweekdays, jscmonthdays, jscmonths) FROM stdin;
\.


--
-- Data for Name: pga_exception; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_exception (jexid, jexscid, jexdate, jextime) FROM stdin;
\.


--
-- Data for Name: pga_joblog; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_joblog (jlgid, jlgjobid, jlgstatus, jlgstart, jlgduration) FROM stdin;
\.


--
-- Data for Name: pga_jobstep; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_jobstep (jstid, jstjobid, jstname, jstdesc, jstenabled, jstkind, jstcode, jstconnstr, jstdbname, jstonerror, jscnextrun) FROM stdin;
\.


--
-- Data for Name: pga_jobsteplog; Type: TABLE DATA; Schema: pgagent; Owner: postgres
--

COPY pgagent.pga_jobsteplog (jslid, jsljlgid, jsljstid, jslstatus, jslresult, jslstart, jslduration, jsloutput) FROM stdin;
\.


--
-- Data for Name: respaldo_tarifa; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.respaldo_tarifa (id_tarifa, nombre, detalle, precio_por_m3, limite_min_m3, limite_max_m3, tipo_tarifa, fecha_creacion, activo, vigencia_desde, vigencia_hasta, es_vigente) FROM stdin;
17	Consumo Básico	Tarifa fija hasta 15 m³	2.00	0.00	15.00	basico	2025-12-15 16:48:55.930693-05	t	2025-01-01 00:00:00-05	\N	t
12	Residencial Básico	Consumo de 0 a 15 m³	1.00	0.00	15.00	basico	2025-12-15 16:33:41.005885-05	f	2025-12-15 00:00:00-05	2025-12-17 09:52:11.85592-05	f
13	Exceso Penalización	Exceso sobre límite máximo	1.00	15.00	100.00	exceso	2025-12-15 16:37:07.20862-05	t	2025-12-15 00:00:00-05	\N	t
18	Exceso de Consumo	Cargo por m³ adicional sobre 15 m³	1.00	0.00	100.00	exceso	2025-12-15 16:48:55.930693-05	t	2025-01-01 00:00:00-05	\N	t
3	Tarifa Especial	\N	1.00	0.00	1.00	especial	2025-11-24 15:05:58.969925-05	f	2025-12-03 14:29:41.645465-05	2025-12-17 09:58:50.731806-05	f
20	Tarifa Especial	\N	1.00	0.00	2.00	especial	2025-12-17 09:58:50.722643-05	t	2025-12-03 00:00:00-05	\N	t
7	Tarifa común	\N	5.00	0.00	5.00	otro	2025-12-03 14:58:23.981362-05	f	2025-12-03 00:00:00-05	2025-12-03 14:59:18.768991-05	f
19	saas	\N	21.00	0.00	100.00	otro	2025-12-17 09:54:39.406134-05	t	2025-12-17 00:00:00-05	\N	t
\.


--
-- Data for Name: t_auditoria_contrasenas; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_auditoria_contrasenas (id_auditoria, id_usuario_sistema, accion, motivo_rechazo, fecha_hora, ip_origen, user_agent, exitoso) FROM stdin;
1	1	VALIDACION_FALLIDA	Esta contraseña es muy común y no está permitida por seguridad	2026-01-03 21:44:03.580642	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	f
4	4	CAMBIO_EXITOSO	\N	2026-01-03 22:12:39.989204	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	t
9	4	CAMBIO_EXITOSO	\N	2026-01-03 22:23:10.504558	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	t
12	4	CAMBIO_EXITOSO	\N	2026-01-03 22:25:15.980913	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	t
13	4	CAMBIO_EXITOSO	\N	2026-01-03 22:25:39.700965	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	t
\.


--
-- Data for Name: t_auditoria_sesiones; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_auditoria_sesiones (id_auditoria, id_usuario_sistema, usuario, evento, session_token, ip_address, user_agent, navegador, sistema_operativo, dispositivo, motivo, exitoso, fecha_hora) FROM stdin;
1	4	cliente	LOGIN	8a4f9598fecfdffa8cfd644a242757c5b9dc9883e9147262284a8559e5f14f94	Unknown	Unknown	Other 	Other 	Other	Login exitoso con OTP	t	2026-01-03 22:41:43.198808
2	4	cliente	SESSION_INVALIDATED	8a4f9598fecfdffa8cfd644a242757c5b9dc9883e9147262284a8559e5f14f94	Unknown	Unknown	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 22:42:51.162999
3	4	cliente	LOGIN	da289ae092e00066e83d2e80f354d6bd25d9f2af14d5e28a995dadf19ae03cbc	Unknown	Unknown	Other 	Other 	Other	Login exitoso con OTP	t	2026-01-03 22:42:51.182725
4	4	cliente	SESSION_INVALIDATED	da289ae092e00066e83d2e80f354d6bd25d9f2af14d5e28a995dadf19ae03cbc	Unknown	Unknown	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 22:50:35.74733
5	4	cliente	LOGIN	f620207b68ad978ac643ce87362fdfb05aa31c9fa3a2b5bfcae94e174f6291cf	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Edge 142.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 22:50:35.89588
6	4	cliente	SESSION_INVALIDATED	f620207b68ad978ac643ce87362fdfb05aa31c9fa3a2b5bfcae94e174f6291cf	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 22:51:21.153441
7	4	cliente	LOGIN	02927f2657d50dfbfbb8d14517406dc02eefcf87274a9c2f1c92ec0ca660c89a	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Chrome 143.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 22:51:21.178197
8	4	cliente	SESSION_INVALIDATED	02927f2657d50dfbfbb8d14517406dc02eefcf87274a9c2f1c92ec0ca660c89a	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 22:58:46.987158
9	4	cliente	LOGIN	1a6cd915f0b4f2f408dfca7b03af5f29dca12193202fa41100043c2ad2edada3	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Edge 142.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 22:58:47.029068
10	4	cliente	SESSION_INVALIDATED	1a6cd915f0b4f2f408dfca7b03af5f29dca12193202fa41100043c2ad2edada3	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 22:59:21.015687
11	4	cliente	LOGIN	3e64b0533b1d731f1e10cfa03d99cd16b4b623d4a864e23f75b7e97eb814ceea	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Chrome 143.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 22:59:21.033721
12	4	cliente	SESSION_INVALIDATED	3e64b0533b1d731f1e10cfa03d99cd16b4b623d4a864e23f75b7e97eb814ceea	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 23:00:43.614496
13	4	cliente	LOGIN	67d3162f1fe74500987950498899efb01fb45e64be5b7bc7c31ddd239fb2c639	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Edge 142.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 23:00:43.630667
14	4	cliente	SESSION_INVALIDATED	67d3162f1fe74500987950498899efb01fb45e64be5b7bc7c31ddd239fb2c639	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 23:01:23.115978
15	4	cliente	LOGIN	68c6e05c9e7a2515af3daf922f679b6bcc2e04acd233487b4626c244d4824e29	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Chrome 143.0.0	Windows 10	Other	Login exitoso con OTP	t	2026-01-03 23:01:23.13624
16	4	cliente	SESSION_INVALIDATED	68c6e05c9e7a2515af3daf922f679b6bcc2e04acd233487b4626c244d4824e29	200.112.220.43	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 23:19:56.621079
17	4	cliente	LOGIN	3371a27f982980cac759fa60f1d909b0687792ba82acbf3074ae5e6c13285c8c	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Sa	Unknown	Unknown	Login exitoso con OTP	t	2026-01-03 23:19:56.730172
18	4	cliente	SESSION_INVALIDATED	3371a27f982980cac759fa60f1d909b0687792ba82acbf3074ae5e6c13285c8c	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-03 23:21:12.394531
19	4	cliente	LOGIN	452b8a1d31e4fd6b095320d47b49e6e2056eaf9b17e4079e84645e0af7f8613c	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Sa	Unknown	Unknown	Login exitoso con OTP	t	2026-01-03 23:21:12.41341
20	1	admin	SESSION_INVALIDATED	f1245e68df45ec62d2f02c332cdc94a7a52cdd783f6330e33309443dc79a3970	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	\N	\N	Login desde nuevo dispositivo	t	2026-01-05 11:47:09.396381
21	1	admin	LOGIN	fc10a2225fa4cfdcf536feca3bdb4604289890389f3955234160fa6ef1120ece	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Sa	Unknown	Unknown	Login exitoso con OTP	t	2026-01-05 11:47:09.545591
\.


--
-- Data for Name: t_configuracion_sistema; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_configuracion_sistema (id_configuracion, clave, valor, tipo_dato, descripcion, categoria, modificable, activo, fecha_creacion, fecha_modificacion, modificado_por) FROM stdin;
1	MAX_INTENTOS_TEMPORALES	5	int	Número máximo de intentos fallidos antes de bloqueo temporal	seguridad_bloqueo	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
2	TIEMPO_BLOQUEO_TEMPORAL	15	int	Tiempo de bloqueo temporal en minutos	seguridad_bloqueo	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
3	MAX_INTENTOS_PERMANENTES	8	int	Número máximo de intentos fallidos antes de bloqueo permanente	seguridad_bloqueo	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
4	VERIFICATION_CODE_LENGTH	6	int	Longitud del código de verificación	seguridad_recuperacion	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
5	VERIFICATION_CODE_EXPIRE_MINUTES	15	int	Tiempo de expiración del código de verificación en minutos	seguridad_recuperacion	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
6	RESET_TOKEN_EXPIRE_MINUTES	10	int	Tiempo de expiración del token de reseteo en minutos	seguridad_recuperacion	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
7	MAX_VERIFICATION_ATTEMPTS	3	int	Número máximo de intentos para verificar código	seguridad_recuperacion	t	t	2026-01-08 22:59:33.992434	2026-01-08 23:22:51.230676	\N
8	ACCESS_TOKEN_EXPIRE_MINUTES	120	int	Tiempo de expiración del token JWT en minutos	seguridad_jwt	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
9	JWT_ALGORITHM	HS256	string	Algoritmo de encriptación para JWT	seguridad_jwt	f	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
10	JWT_REFRESH_TOKEN_EXPIRE_DAYS	7	int	Tiempo de expiración del refresh token en días	seguridad_jwt	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
11	LOG_LEVEL	INFO	string	Nivel de logging (DEBUG, INFO, WARNING, ERROR, CRITICAL)	sistema_logging	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
12	LOG_MAX_FILE_SIZE_MB	10	int	Tamaño máximo del archivo de log en MB	sistema_logging	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
13	LOG_RETENTION_DAYS	30	int	Días de retención de logs antiguos	sistema_logging	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
14	API_RATE_LIMIT_PER_MINUTE	60	int	Número máximo de requests por minuto por IP	sistema_api	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
15	API_MAX_UPLOAD_SIZE_MB	10	int	Tamaño máximo de archivos subidos en MB	sistema_api	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
16	API_TIMEOUT_SECONDS	30	int	Timeout de requests en segundos	sistema_api	t	t	2026-01-08 23:17:09.2236	2026-01-08 23:22:51.230676	\N
33	API_CORS_MAX_AGE	3600	int	Tiempo de caché de preflight CORS en segundos	sistema_api	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
34	SESSION_MAX_CONCURRENT	3	int	Número máximo de sesiones concurrentes por usuario	sistema_sesiones	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
35	SESSION_TIMEOUT_MINUTES	30	int	Tiempo de inactividad antes de cerrar sesión automáticamente	sistema_sesiones	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
36	EMAIL_BATCH_SIZE	50	int	Cantidad de emails a enviar por lote	notificaciones_email	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
37	EMAIL_RETRY_ATTEMPTS	3	int	Número de reintentos para emails fallidos	notificaciones_email	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
38	NOTIFICATION_ENABLED	true	boolean	Activar/desactivar sistema de notificaciones	notificaciones_general	t	t	2026-01-08 23:22:51.230676	2026-01-08 23:22:51.230676	\N
\.


--
-- Data for Name: t_historial_contrasenas; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_historial_contrasenas (id_historial, id_usuario_sistema, clave_hash, fecha_cambio, cambiado_por_admin, motivo_cambio, ip_cambio) FROM stdin;
1	4	$2b$12$N7Lo47PCKx307pEw3fg1UurMFDX9x2NRhCo2aMXRKRrgR9qi2BsgG	2025-10-21 22:01:31.950863	f	migracion_inicial	\N
2	11	$2b$12$8bPUb0MqZqgzkc8U6e42g.0UFLW3e.2UD.qLxOXNUnPjLRhj.eY6W	2025-11-04 19:40:27.475594	f	migracion_inicial	\N
3	12	$2b$12$BZ3XmGfunhTgtpy5LlfIAeo.ugtfc9.T39WS85F1aTsRd.r2WA3s2	2025-11-05 10:18:53.690877	f	migracion_inicial	\N
4	5	$2b$12$ruVd06Ga/S/IfcW/ArLSVe3bsx4YV0H/.vdalMyGBZ2nxMV4p95va	2025-10-22 10:38:13.985435	f	migracion_inicial	\N
5	10	$2b$12$11YDSlAvnl6o5k9tYvL6e.RhLjMTcHx4tGc3rpf9yhbqply1vRqCi	2025-10-30 19:16:42.814879	f	migracion_inicial	\N
6	9	$2b$12$SLD92USnN6qqV4T/Ovt6Y.K80hljXmxnlK/Jx9kbXeBSyUycSS4qC	2025-10-27 10:22:01.391676	f	migracion_inicial	\N
7	13	$2b$12$Ql3FtZaKsBRt./HltP0M8.YXLAm324kkHLI/F5wlPuft.nHgnbkle	2025-11-15 20:00:31.013544	f	migracion_inicial	\N
8	3	$2b$12$tcQF4hUDeClgJES9./M3w.rxWH6env2mrLMlw5HBjGpTPj83a/Q.C	2025-10-21 21:55:28.835417	f	migracion_inicial	\N
9	16	$2b$12$jpQpc4ZNrS/2Dt9tHwPh0OMJtJ30oGQYQB1L6rjwtdaQE8eRVSxKK	2025-11-15 20:00:31.714546	f	migracion_inicial	\N
10	1	$2b$12$DPmLl2mlSYRJZF.RUiDqrOeqESbFJPIWJHiysRCkyucECndK3bGnG	2025-07-24 15:17:19.36669	f	migracion_inicial	\N
11	14	$2b$12$j8Ma6Xnh.0OukrlpkloV1On01TOaxo.OPXJqk.DAvyeoqCseKDIGW	2025-11-15 20:00:31.258584	f	migracion_inicial	\N
12	18	$2b$12$SbYVrNG7N9TMrV8xu9EIoeSZw5x68SGNagEAHvF0vU6xeFvd.VwgG	2025-11-17 22:57:59.694995	f	migracion_inicial	\N
13	6	$2b$12$NXVVKJialyYB1hb4zHNAKeDzv3uIqBG5wbbcEFoPoQ9yi2QXnLPjC	2025-10-23 08:37:33.330367	f	migracion_inicial	\N
14	19	$2b$12$Ud5qBolrAip3rfUnwT9Bg.Dd5klW.R0h1t2R.Fct25vPo1DNdMqlO	2025-11-28 18:15:50.74027	f	migracion_inicial	\N
15	17	$2b$12$Au.DTU7QDnsbtCmcAlduG.Zu2yrnTXWU2wfbR6bkRDiGvIWyqCOs6	2025-11-15 20:00:31.944542	f	migracion_inicial	\N
16	15	$2b$12$PqaR6HScYCEbzkDUJsY/Yu6rDH0sABL.vFnuZjr9j1xHpvrWSo.1i	2025-11-15 20:00:31.484393	f	migracion_inicial	\N
17	1	$2b$12$DPmLl2mlSYRJZF.RUiDqrOeqESbFJPIWJHiysRCkyucECndK3bGnG	2025-12-21 17:08:08.857814	f	cambio_voluntario	127.0.0.1
18	4	$2b$12$iF.xiflgE0QY5rTD/gujt.gZFswr1VwaUOD7LZU7x4WVWysaUamwW	2026-01-03 22:12:39.936592	f	cambio_voluntario	127.0.0.1
19	4	$2b$12$Y1aHDNy9I7Z5ytqoEvuXu.7EaoIkUZ35m.Zpcp5fgOlL9aEhlANyy	2026-01-03 22:23:10.478565	f	cambio_voluntario	127.0.0.1
20	4	$2b$12$M2B/QmDUq0EWBepbUymP/eNYtVnJcADsaj0oHocfcdtU9SrXf8dZq	2026-01-03 22:25:15.964162	f	cambio_voluntario	127.0.0.1
21	4	$2b$12$uxJ6ZZPjcc0fwcPlUWyDJeM8dmLM11Ygh4aUpqybwxz58ryQiTK9i	2026-01-03 22:25:39.696955	f	cambio_voluntario	127.0.0.1
\.


--
-- Data for Name: t_rol_acciones; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_rol_acciones (id_rol_accion, id_rol, nombre_accion, tipo_accion, activo, fecha_asignacion) FROM stdin;
63	1	Sectores	operaciones crud	t	2025-11-08 12:13:30.175784
65	1	Medidores	operaciones crud	t	2025-11-10 10:36:33.456643
68	2	Pagos	operaciones crud	t	2025-11-11 22:15:14.864317
77	1	Tarifas	operaciones crud	t	2025-11-24 14:38:12.614655
78	1	Geolocalizacion	operaciones crud	t	2025-11-24 16:08:15.85508
81	3	Sectores	lectura	t	2025-11-28 16:52:44.547996
84	5	Geolocalizacion	Operaciones CRUD	t	2025-11-30 11:33:03.757191
83	5	Usuarios	Lectura	t	2025-11-28 17:29:59.006878
161	3	HistorialConsumo	operaciones crud	t	2025-12-30 19:42:34.495186
162	3	Facturas_pagos	operaciones crud	t	2025-12-30 19:42:44.256087
163	3	Tarifas	lectura	t	2025-12-30 19:52:29.305823
164	2	Lecturas	lectura	t	2025-12-30 19:55:55.664954
88	1	MultasAfiliados	operaciones crud	t	2025-12-08 20:46:00.326541
165	2	Tarifas	lectura	t	2025-12-30 19:56:45.2881
166	2	Afiliados	lectura	t	2025-12-30 19:56:58.808
90	1	HistorialConsumo	operaciones crud	t	2025-12-15 10:26:11.940153
103	4	HistorialConsumo	operaciones crud	t	2025-12-15 11:18:15.399909
105	1	Facturas	operaciones crud	t	2025-12-15 15:11:50.729895
167	2	Medidores	lectura	t	2025-12-30 19:57:17.482805
141	1	Pagos	operaciones crud	t	2025-12-19 14:53:32.319051
69	2	Notificaciones	lectura	t	2025-11-11 22:16:10.588496
168	2	Facturas_pagos	operaciones crud	t	2025-12-30 20:08:44.279095
169	2	HistorialConsumo	operaciones crud	t	2025-12-30 20:08:52.786476
170	4	Facturas_pagos	operaciones crud	t	2025-12-30 20:10:22.334426
146	5	Notificaciones	operaciones crud	t	2025-12-30 16:01:20.828059
70	4	Notificaciones	lectura	t	2025-11-11 22:26:32.918716
171	4	Geolocalizacion	lectura	t	2025-12-30 20:12:21.998526
172	4	Mi_Medidor	lectura	t	2025-12-30 21:08:14.789575
173	1	Mi_Medidor	operaciones crud	t	2025-12-30 22:27:51.427605
147	1	Configuracion	operaciones crud	t	2025-12-30 16:33:06.80561
149	1	Lecturas	operaciones crud	t	2025-12-30 16:47:44.019213
150	1	Servicios	operaciones crud	t	2025-12-30 16:48:05.947574
151	1	Usuarios	operaciones crud	t	2025-12-30 16:49:35.255565
152	1	Multas	operaciones crud	t	2025-12-30 16:50:20.129788
153	1	Roles	operaciones crud	t	2025-12-30 16:50:56.050772
154	1	Facturas_pagos	operaciones crud	t	2025-12-30 16:53:20.251265
61	1	Afiliados	operaciones crud	t	2025-11-08 12:11:58.982891
60	1	Notificaciones	operaciones crud	t	2025-11-08 12:10:47.431751
155	1	Reportes	operaciones crud	t	2025-12-30 17:09:30.727229
156	3	Lecturas	operaciones crud	t	2025-12-30 17:16:30.595554
158	3	Geolocalizacion	lectura	t	2025-12-30 17:20:29.96979
67	2	Facturas	lectura	t	2025-11-11 22:14:59.557994
160	3	Afiliados	lectura	t	2025-12-30 19:37:42.504061
157	3	Medidores	lectura	t	2025-12-30 17:17:51.43454
57	3	Notificaciones	lectura	t	2025-11-08 12:08:19.247779
\.


--
-- Data for Name: t_roles; Type: TABLE DATA; Schema: seguridad; Owner: postgres
--

COPY seguridad.t_roles (id_rol, nombre_rol, descripcion, activo, fecha_creacion) FROM stdin;
1	Administrador	Rol con acceso total al sistema: gestión de usuarios, configuración, facturación, reportes y auditorías.	t	2025-10-29 14:36:42.81651
2	Cajero	Rol encargado de registrar pagos, generar facturas y consultar reportes financieros.	t	2025-10-29 14:36:42.81651
3	Lector	Rol responsable de registrar y actualizar lecturas de medidores de agua.	t	2025-10-29 14:36:42.81651
5	Reportes	\N	t	2025-11-28 17:29:45.269235
4	Afiliado	Rol de usuario final con acceso a la consulta de facturas, pagos y notificaciones personales. gggg	t	2025-10-29 14:36:42.81651
\.


--
-- Data for Name: t_auditoria_sesiones; Type: TABLE DATA; Schema: usuarios; Owner: postgres
--

COPY usuarios.t_auditoria_sesiones (id_auditoria, id_usuario_sistema, usuario, evento, session_token, ip_address, user_agent, navegador, sistema_operativo, dispositivo, fecha_evento, motivo, exitoso) FROM stdin;
1	1	admin	LOGIN	ca88dc50bd44aa7595a742542a15d65faa7d596b0fbc5d4503bebc81c20fea38	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Sa	Unknown	Unknown	2025-12-21 23:21:14.122832	Login exitoso con OTP	t
2	1	admin	SESSION_INVALIDATED	ca88dc50bd44aa7595a742542a15d65faa7d596b0fbc5d4503bebc81c20fea38	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	2025-12-21 23:22:03.359601	Login desde nuevo dispositivo	t
3	1	admin	LOGIN	b96651c12b25d4adc304e8ffc80e53de11a3d808ac46189a79c8e471c32205f9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Sa	Unknown	Unknown	2025-12-21 23:22:03.398149	Login exitoso con OTP	t
4	1	admin	SESSION_INVALIDATED	b96651c12b25d4adc304e8ffc80e53de11a3d808ac46189a79c8e471c32205f9	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	\N	\N	\N	2025-12-21 23:24:15.705361	Login desde nuevo dispositivo	t
5	1	admin	LOGIN	dd234df0b5043a60f6cf4f5fe2e5d3e64c2740a6b3da9d7ceac37ee2bafb8057	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Sa	Unknown	Unknown	2025-12-21 23:24:15.744494	Login exitoso con OTP	t
6	1	admin	SESSION_INVALIDATED	dd234df0b5043a60f6cf4f5fe2e5d3e64c2740a6b3da9d7ceac37ee2bafb8057	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	\N	\N	\N	2025-12-21 23:31:57.845656	Login desde nuevo dispositivo	t
7	1	admin	LOGIN	f1245e68df45ec62d2f02c332cdc94a7a52cdd783f6330e33309443dc79a3970	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Sa	Unknown	Unknown	2025-12-21 23:31:57.926519	Login exitoso con OTP	t
\.


--
-- Data for Name: t_usuario_afiliado; Type: TABLE DATA; Schema: usuarios; Owner: postgres
--

COPY usuarios.t_usuario_afiliado (id_usuario_afi, fecha_afiliacion, id_sector, id_usuario_sistema, activo, cod_usuario_afi, num_medidor) FROM stdin;
10	2025-11-20	1	17	t	9	2222
11	2025-11-20	1	18	t	10	3332
9	2025-11-20	1	13	t	8	1111
6	2025-11-12	3	11	t	6	404004
12	2025-11-20	1	14	t	11	3342
7	2025-11-15	3	10	t	7	0002
5	2025-11-12	3	4	t	5	3333
18	2025-12-24	3	9	t	16	0003
4	2025-11-12	3	6	t	4	0004
14	2025-11-20	1	5	t	13	19999
16	2025-12-06	3	16	t	14	7775
20	2025-12-30	3	20	t	18	\N
19	2025-12-24	3	3	t	17	008
17	2025-12-23	1	19	t	15	0005
1	2025-11-08	1	1	t	1112	10008
26	2026-01-29	3	12	t	2324	1234
27	2026-01-29	1	15	t	2324C	2345
\.


--
-- Data for Name: t_usuario_sistema; Type: TABLE DATA; Schema: usuarios; Owner: postgres
--

COPY usuarios.t_usuario_sistema (id_usuario_sistema, usuario, clave, nombres, apellidos, cedula, email, fecha_registro, foto, telefono, direccion, activo, sexo, fecha_nac, intentos_fallidos, bloqueado_hasta, bloqueado_permanente, ultimo_acceso, id_rol, session_token, session_created_at, session_expires_at, session_ip, session_user_agent, last_activity) FROM stdin;
11	jessica	$2b$12$8bPUb0MqZqgzkc8U6e42g.0UFLW3e.2UD.qLxOXNUnPjLRhj.eY6W	Jessica	Almeda R	0603483748	jessial@gmail.com	2025-11-04 19:40:27.475594	\N	0999999999	Sanjapamba	t	F	2009-01-28 00:00:00	0	\N	f	2025-11-05 19:58:03.486574	1	\N	\N	\N	\N	\N	\N
12	rene	$2b$12$BZ3XmGfunhTgtpy5LlfIAeo.ugtfc9.T39WS85F1aTsRd.r2WA3s2	Rene R	Reyes	0767676667	rene@gmail.com	2025-11-05 10:18:53.690877	\N	0999999999	Sanjapamba sa	t	M	2004-02-07 00:00:00	0	\N	f	2025-11-05 19:54:00.145716	1	\N	\N	\N	\N	\N	\N
5	marta	$2b$12$ruVd06Ga/S/IfcW/ArLSVe3bsx4YV0H/.vdalMyGBZ2nxMV4p95va	Marta	Aguilar Aguilar	0605654324	martaagukar@gmail.com	2025-10-22 10:38:13.985435	\\x89504e470d0a1a0a0000000d4948445200000200000002000806000000f478d4fa0000000473424954080808087c086488000000097048597300000ec400000ec401952b0e1b0000001974455874536f667477617265007777772e696e6b73636170652e6f72679bee3c1a0000200049444154789cecdd777c1c779dfff1d76cd1ae7aef96644996dc6b123b71e214d220959006a4402040800b4768390e388e763fead1e10e38e0803b8e1e480824a1a477529cb85bee5d56af5b66e6f7c7da21c545daf9ccceeceee7f978ec8340ecf77cb1b5339ff95603a5945b0a805660e6a1ff6c00aa0f7d6a5ef4cf41a004081ffa7d158091e1b6bacd06060ffd730218054ca00f3878e83f0f7ff6013b80adc04e209ee9c62a950f72ed26a39417aa80c5c0c2439fd9a41efacd40c0bb66e50413d8036c033600cf01ab0f7dfabd6b9652d94f0b00a5a6a70438193815580e2c026678daa2fcb58b5421f038f020f018a99e05a5d4146801a0d4b15502e700ab483df41793eab257fe932455103c04dc0ffc89bf0f3b28a55e460b00a55e693e7011a907ff19fc7d6c5e651713788654217007f0306079da22a57c440b00a5526ff4ab80ab81d7929aaca772cf3ee037c0cf49f5106831a094527928009c067c95d424335b3f79f5e9057e44aa9747276a2aa5541e68046e057af0fe21a41f7f7c76029f25b5545329a5540e09907ad3fb39a935e55e3f70f4e3cf8f09dc035c0984504a2995b54a81f792da50c6eb878b7eb2ebb395d4cf4e294a29a5b24603f0afa47695f3fa41a29fecfe0c919a27d282524a29dfea047e08c4f0fec1a19fdcfac4801f001d28a594f28d16526f699378ffa0d04f6e7fe2a4560f6821a094521e6a02be81bef1eb27f39f49e0eba47e0695524a654821a9a57cc378ff20d04f7e7fc6482d212c4129a594ab2e06b6e0fd8d5f3ffa79f16727703dbabbaa524a895b0a3c80f7377afde8e7589ffb481d18a594ef69b5aafcae10f838f07eb274739670b880c2a2628a8a8a292a2ca6a02042b8a080828248ea9f436182a11081406a47da70a820f7be9936249271002ccbc24c26492413c4e331e2f11889789c783cc6f8c418e3e3634c8c8f9148c43d6e74da12c017814f929a2ba0942fe5da6d46e5963381ef005d1eb7634a2291286565152f7c4acb2a282a2a261c2ef0ba6959299188333e36caf0c81023c3830c1ffac46259f34cdd08bc9d54af8052bea30580f2a332526f5037e2d39fd14020407979259555355455d552595943345ae875b3f2c2e4e404030307e9efef65a0ff2043430358966f0ff6b381ef021f2435695529dff0e5cd55e5b595c04f8076af1bf27225a565d4d735515bd74855552dc160d0eb2629c0344dfafb7b3970602f07f6ef6174d497cfd9adc035c0235e3744a9c3b400507e11023e067c04f0c593d5300c6a6aea696c6ca1aebe91c2c262af9ba4a6607c7c8c0307f6b077cf4efafa0e60dbb6d74d3a2c097c06f8f4a17f56ca535a00283fe824f5d67fb2d70d310c83aaea5a9a9a5a696c6c2112897add24e5402c36c9debd3bd9b37b07fdfdbd7e29061e21d51bb0d5eb86a8fca60580f2da85c08f814a2f1b118d163263463b6d33675154a46ffab9687272825dbbb6b27d5b0fe3e3a35e3767187833f01b8fdba1f2981600ca2b015227f67d148f7e0e0dc3a0bea199b6b659d4d6366018fa75c807b66dd37b602fdbb7f7b07fff6e2f7b052ce053a4960bfa7616a3ca5d7ac7535e282375a0caa55e5c3c140ad1dc3c938eced994949479d104e513e3e3a36cdfd6c3f6ed9b4824125e35e30fa4860406bc6a80ca4f5a00a84c9b0bdc8107a7a94522513a3a66d3367396aecd572f9148c4d9b66d335bb76cf06a9f811ee02260bd171757f9490b009549a702b7013599bc6841418499ed5d7476ce21140a67f2d22acb98a6c9f6ed9bd9bc69ad1785c000f03ae0de4c5f58e5272d0054a65c077c0fc8d8ab77385c4067e71cda3bbaf5c1afa625994cb065cb06b6f46cc8f496c431e0adc0ff64f2a22a3ff962bdb5ca6906a9bdfcbf4286f6f2370c839933bb3869f92aeaea1a0904f4c75c4d4f2010a4baba8ed6b64e92c904c343191b9e0f01970126707fa62eaaf293f600283719a41efcefc9d4056b6aea99bf601965651599baa4ca03a3a3c3ac79fe290e1cd89bc9cbfe07f06e74858072891600ca2d41525dfe6fcec4c5a2d142162e3c9186c61999b89cca537bf6ec60cdf34f31393991a94bfe00781ba91e01a5446901a0dc102275e3ba3613179b3163260b169c40b84067f62bf7251209366c58cdb6ad9b32b587c0cf497d973c5ba7a8729316004a5a04f80570b1db172a2e2e65f192e55457d7b97d29a55e61cfee9dac5dfb3413136399b8dcedc095a426092a2542674729494152b3972f73fb423366cc64f98a3328292975fb524abd8265d90443419a9b5b499a49868707ddbee46c6011f02b744e8012a2058092122075a0cfd56e5ea4a020c2b21356d2d5359f4020e0e6a5943aaa783c866559184680eaea3a4a4acb19e83f8865b93a543f1b9847aa08f0c5a9462abb6901a02418a426fc5defe6456a6aea39f994b3a8a8a876f3324a1d93699ac4e32fdd1ba0b8b8848686198c8e0cb93d41701ed04c6a48402947b4005012be0ebcc3cd0bcc9a358f254b4f261cd60d7d94776cdb6272e2c83b048642211a1a6660992643eeee1bb08cd4e9997f74f3222af76901a09cfaf0a18f2b42a1104b979d4247c76c3dad4f79cab22c262727b08fd1fb6e180655d5b5949695d3d7d78b65b9365cbf0298001e72eb022af76901a09cb81af8162ead26292e2e65e5cab3a9aed159feca5bf144625a670314159550535b4f7f5f2fc9a46babf7ce06d6016bddba80ca6dfa4aa5d2751a700f107523bcb2b2869396af221271253eafd9b60db68d6503b675e87df645efb59959db9e79877a900cfbd03f1b060103c0c00818182fbe1dda36a665619a26c96422edf5fe894482e7563fcee060bfe3e61fc524a942e061b72ea0729716002a1d5da46e38ae9cead7d4d4cad26527eb1efe69b26d0bcbb2b16c0bdbb20ffd770bdbb633b5718d7a11cb3259bbe66937b7113e089c026c76eb022a376901a0a6ab14780c98eb467867e71ce6cd5fea4674ceb16db02d13cbb2306d0bdbb4302d0b5d21e63fb66dd3b3791d3b76f4b87589b5a4e6058cba7501957bf4154b4d8701fc1838c38df059b3e6316ffe1237a273826d836526499a4912f138f1788c643289699a2fbce12b7f3a3c3930100c32d07fd08d4bd4925a22f87337c2556ed202404dc73fe1d2c97ef3e72fa57bf60237a2b39a65592493091289430f7c3389659afab0cf52151555840b22f4f51d70237e0e3086ce075053a443006aaace21b5ee58b468340c83850b4fa46de62cc9d8ac669a49924913d34cea833e47eddebd9d8d1b9e73e3ef37099c0ffc453a58e51e2d00d4543401cfe2c2a4bf858b4e64e6cc2ee9d8ac639ae6a107bf3ef4f3c5ee5ddbd8b0e13937a20f004b00d7661daadca04300ea780ce067c062e9e0b9f316d3d131473a366bd8b64522995a5f9e4c26dcdc3446f950595905a17098febe5ee9e8626021a983b9943a2a2d00d4f1bc1f78b774e8ecd90be9ea9e2f1d9b1592c924f1788c783c8e65ba7a788cf2b9f2f24a000607fba4a33b8141e051e960953bb40050c7b218f82910920cede898cddc79e21d0a3e679348240fbded6b37bffabbcaca1a12c9841b470a9f49ead0a0fdd2c12a376801a08e260adc05344a863634cc60f1921579b3afbf65d924120962b118a699f4ba39caa7aaaa6a191d19667c5c74197f085805fc80d4e440a55e420b0075349f062e930c2cafa862c58ad3f362873fdbb688c7e3c4e3936e9f11af72806118d4d635d03f70705a670e4c411d10405705a823c88fd730355d4b81c711ecfa2f2a2ae6b455e7e5fcdefeb6959ad89748b876008cca61f1788c279f7880c9c909c9d8047012a9953c4abd20e0750394ef8480ef22f8f00f04829c78e269b9fdf0b76de2f118e313e3faf057692b2888b068f1728241d15eb230f04384e7f2a8ec97fb7db16aba3e005c2f19b878c972eaea9b24237de5f0523e5367f42b01050511a2d1227a7b4597f13700c3c02392a12abb6901a05eac83d45ee261a9c0f6f66ebaba7273b99f699a2fccea574a52494919f1449c11d99501a701ff4b6a79a0523a04a05ee28b40a1545865654d4e9eec67db36b1588cc9c909ddbc47b9a6ab6b3e656515929145c01724035576d302401d761682b3fe43a1104b979d4c20905b3f62c9649289897192491de757ee0a0402cc5f7002a190e8d0fd15b8749aa7ca3eb9757756e90a025f910c5cb8f0448a8b4b25233d655936939313c46293ba898fca98c2c222babac54fc9fc0a3afcabd01f02957213f016a9b0c6c616e6cccd9d9dfe92c924939393d8b676f7abcc2b2d2d677c7c8cb1b111a9c8066017f09454a0ca4eba0f802a057a805a89b068b49033cfba8070b84022ce63a9b17e9de4a7bc964c2678f4d17b89cb6d12b41f9805886e3da8b28b0e01a87f44e8e10fa9aeff5c78f85ba6c9f8f8b83efc952f84426166cb0e05d403ff2019a8b28f1600f9ad1cb8452aacb1a98586c61952719e4924134cc62674ac5ff94a6d5d23b5b50d9291b702a2cb0c5476d10220bfbd1fa892080a87c32c5870824494676c1b62b149e2b118faec577e347bf6424221b16d3a2a80f74885a9eca30540feaa26d5fd2f62eebc2544a3625b08649c6d5b4c4e6897bff2b7824894cece399291ef032a250355f6d002207fbd0f2893082a2bafa4b5b55322ca13966532313e81a5b3fc5516686a6ea3a444e4ab0ba961c0f74a85a9eca205407e2a02de2115b660c1320c233b1794a496f84d60a37dfe2a3b18864157b7e8f6daff00144b06aaeca005407eba91d41080634d4dad5457d74944655c229138b4b18fd72d516a7a2a2b6b24270456016f920a53d9430b80fc134468ec3f100830775e766ef8138bc788c7635e3743a9b4cdea9a876188ddc26f413786cb3b5a00e49fd7913af5cfb1d6b64e8a8a4a24a2322a168b914ce85efe2abb151616d3d4d42215370b78ad5498ca0e5a00e41f91b7ff60309895c7fc4ec626f5201f953366b6774b1eb8a59301f38c1600f9652e70aa4450dbccae2c5bf66733199bc4d4657e2a874422519a9adba4e24e03b2afaa5769d30220bfdc2411120c0699356bae445446d8364cc662faf0573969e6cc2e0201b1e1fb1ba58294ff6901903fa2c0b51241adad9d44225189a88c88c7f5cd5fe5ae8282088d727301ae2375af5079400b80fc710502dbfe1a86417b47b74073322316d7d3fc54ee6b6ded94da8ba31a9d0c9837b400c81f225d7b0d0d33282e2e9588725d2caeb3fd557e282c2ca2a6a65e2a4e8701f2841600f96106b04a22a87396e83ee4ae4924e2faf0577945703beeb38026a930e55f5a00e4872b10f8bb2e2fafa4b2b246a039ee329349e2f1b8d7cd502aa3ca2baa282d2d97880a00974b04297fd302203fbc5e22a4ad6d96448cab2ccb24169ff4ba194a79a2a9a9552aea6aa920e55f5a00e4be1660b9d390603044f30cb1f5c6aeb06d9bc909dddb5fe5affa866682419125812b01b16a42f9931600b9eff580e3e9c1cdcdad84426181e6b8c5d653fd54de0b85c2d4d5890cdf1be83040ced30220f75d2211d22237c1c815b1581ccbb2bc6e86529e6b941b06d0e580394e0b80dc56099cec34a4b0b088aa2aff4efe4b2612babfbf5287545454496dd3bd12109955a8fc490b80dc762e10721a22b8d7b838cb3489e9b1be4abd84d0304008385b2248f9931600b9ed351221cd725d8ae262317df82bf57275f562cbf845ee21ca9fb400c85d06709ed390a2a212ca2b1cef20ec8a583c8665ebb8bf522f575656416161b144d4ab119844acfc490b80dcb51081ddbc1a1a670834459e699abad39f52c750532bb235f00cf488e09ca50540ee12d9fab7aeae512246946ddbc42675b31fa58ea5baba4e2aea34a920e52f5a00e4ae539d06048321c99b8898782ca6ebfd953a8e8a8a6aa94d811cdf4b943f690190bb1c7f696b6beb0904fcf52392344d92a61eefabd4f10402012a2aaa25a2b400c851febabb2b293310d8c6b3d677ddff36715df2a7d49455d788f4e0b5a3a703e6242d00729348c5eeb7eeff782c8eadbbfd293565423d00a0f30072921600b9e924a701e17001252565126d1161591609dded4fa969292e2e953ac3e3448910e52f5a00e4a6454e032aab6a300cff2cffd5ddfe949a3ec330282faf94885a2811a2fc450b80dce4b800f0d3deff663289659a5e3743a9ac545e2eb29197e37b8af21f2d00724f1de0780790ca4a7f1400b60df184befd2b952ea11e8026c01f370525460b80dcb35822a4acac4222c6b164328e65e99a7fa5d255522a3697478701728c1600b96781d38068b490828288445b1c49bdfdebc43fa59c08870b8844a212515a00e4182d00724fa7d38032992e43c712c978aa0a504a3922b4a2c7f1bd45f98b1600b9a7dd69801fbaff6ddbd6c37e941222540038beb7287fd10220f7cc741ae087f5ffc9441c5bdffe951251545c2211a305408ed10220f7b4390d282e12b9593860eba63f4a092a8c1649c468019063b400c82df540b1d390c222c7118e2412091dfa574a50b450a40028469702e6142d00728be30380028100d168a1445bd262dba9024029252712894a9dec39532244f9831600b9c5f1e93d8585c59e6e016c99091dfb574a986118442222857dad4488f2072d00728be33d3fa385debdfd83aefb57ca2dd1a8c85e0062c70b2aef6901905b1c57e75e6e00649a16961ef7ab942bc2e10289189d039043b400c82d8eab732f0b80a4cefc57ca35420580f600e4102d00724bd61600b60da699f4e4da4ae5032d00d4cb6901905bca9d061484bd2900923af94f2957091500de6f13aac46801905b1c3fbd43e190443ba62d99d4b77fa5dc140a897cb7bd3f254c89d10220b7382ef10381a0443ba6c5b62d2cd3ccf87595ca2786cc3e0022dd08ca1fbc79dd536e112800325f132692faf057b22ccb62dfbe5d1cd8bf87919121128938c16090e29232eaeb9ba8af6ff6c591d79924f4ddceaf3fb41ca705406e71fce5f4a2003075f6bf12d4dfdfcb86f5ab9998187fc9ff6e9a26c343030c0f0db0a5673db3bae6d3dcecf8e88caca105807a392d00724bd60d01d896aefd57324cd364f3e6b5ecdeb56d4abf76c3fad50c0ef4316ffe524f77bfcc948021f2ddd60220876801905b1cff7d66fa4698d4a57f4ac0d0503f6bd73cc3c4c4d8b47edffefdbb8944a3cc9a35cfa596f987d0775b9f193944ff3295a774edbf72c2b62db66dddc4b66d9bd25e46ba73c716eaeb9b292d75bc8a56a9aca2ab0094676cdbc634b5fb5fa5676c7484279f7890ad5b373ada43c2b66d76eedc22d832a5b283f60028cf9896cefe57d3675916dbb76f66fbb64d62f3470ef6ee17c9512a9b6801a03c63eaf23f354dc34303ac5bff2c63a323a2b9c96482c9c909a2516f4fc3542a93b400509ed1f17f3555a699644bcf0676eddaeada96d189445c0b009557b400509eb02c4bf7fe5753d2dfd7cbfaf5ab999c1c3ffe2f76c0d4dd28559ed1024079c2d2f17f751cf1788ccd9bd7b26fefae8c5c2f918867e43a4af9851600ca1396cefe574761db36fbf7ed66d3a635197d2827e2b18c5d4b293fd0024079425700a823191e1e60c3fae7181919caf8b5272727327e4da5bca40580ca38dbb675fb5ff512c964822d5b36b07bd736cfe6868c8d8f7a725da5bca20580ca385b1ffeea10dbb6d9bb67073d3deb3d1f831f1fd30240e5172d0054c6995a002860a0ff209b36ad617474d8eba600303131866ddb7971309052a00580f280656b0190cfc6c7c7d8d2b39e0307f678dd9497b02c8b919121caca2abc6e8a5219a10580ca381dffcf4fc96482eddb36b373e716dffe0c0c0c1cd40240e50d2d0054c6e912c0fc625916bb776f63dbd68d241209af9b734c030307696b9be5753394ca082d005446a56678eb0e80f9c0b66d7a7bf7d2b3793d1313635e37674a8606fbb12c8b40400f4a55b94f0b0095517eedfa55b27a0fec65cb96f58c65d9cc7ad334191e1ea4a2a2caeba628e53a2d005446d93a0130a7f5f7f7d2d3b39e91e141af9b92b60307f66801a0f28216002aa36c4bbbff73d1e0601f5bb76c6060a0cfeba63876e0c05ebabae6eb724095f3b400501965e9f87f4ee9efef65dbd64d0c0e7afbe0370c83b75e7319834323fcf2f67b1c65c56393f4f7f7525d5d27d43aa5fc490b009551ba0b606e181cec3ff4c67fd0eba6d0ddd9c6b7bff0315eb56a39b7ddf917c70500c0ae9d5bb50050394f0b0095515eedf3ae641cecddc7d66d9b7c31c65f5418e5e31f7c27b7dc741de170ea5676ee99a7108d44988c393bd9afbfbf978989310a0b8b259aaa942fe95a1795515a00641fcbb2d8bb77278f3d762fab573fe18b87ff45e79dc19a876ee34337dff0c2c31fa0b8a890b34f5fe138dfb66db66ddde43847293fd31e0095615a00648b6432c1ee5ddbd8b96b1bf1d8a4d7cd01a0ada5897fffe40778dd45e71cf5d75c76e1abf8fd3df73bbed6be7dbb689bd9455191f602a8dca43d002a836cb403c0ff2626c6d9b8f1791e7af04ff4f4acf7c5c3bfa830ca276e7d17eb1efeed311ffe00575e721ec545858eaf69db363d3deb1ce728e557da03a032461ffefe3638d8cfae9d5be9edddebaba19aab2e3d9f2ffcebfb689dd138a55f5f565ac295979cc70fffefb78eafdd7b602f7d7d077442a0ca49da03a032c64f0f1595629a4976efdecee38fddc7537f7b880307f6f8e6ef69d1bc6eeefdedf7f9d9f7be30e587ff616fb9e632b1766cdcf01ca6698ae529e517da03a0541e1a1f1f65d7ae6decdbbb8b64d25f07f4d4d554f1af1f7a176fbffe0a82c1f4de514e5bb19479b33b59bba1c7717b2626c6d9b8e139e6ce5be2384b293fd10240658c3fde2bf3976559f41ddccfeedddbe9efeff5ba39af505c54c82d375dc7876ebe81d2126713ef0cc3e083fff0666eb8f963226ddbbb77271595d53436b688e429e5075a00a8ccd10ac013a3a3c3ecddb3937dfb769148c4bd6ece2b0483016e78c36bf9c4adefa6a9a1562cf79acb2fe4e39ffb163b76ed15c9dbb8e1398a8b4a282baf14c953ca6b3a0740658ca11540c6249309f6ecdecedf9e7c88c71fbb8f9d3bb7f8f2e17fce1927f3d45f7ece77bffcafa20f7f807038c4fbdf75bd589e699a3cf3cc638c8e0e8b652ae5252d0054c6e8e3df5db69deae25ff3fc533cf8c0ddac5fbf9aa1a17eaf9b7544a72e5fcabdbffd3ef7fcf23b2c9ad7edda75de76dd15cc68aa17cb4b26133cfbcc638c8f8f89652ae5151d02502a8bd9b6cdd0d000070eece1c0fe3dc4e3ceb6c075dba279dd7cf4fd6fe7ca4bcecbc8f50aa3113efbb1f772ed3b3f2c96198b4df2b7271f60e1a293a8a8a816cb552ad3b400502a0b8d8c0cb17fdf6e0e1cd8c3e4e484d7cd39ae250be6f0895bdfc5c5e79f91f16376df78f9057ce3bf7ecaa34fae16cb4c24123cf3f4a3cc9db784fafa66b15ca532490b00a5b2c4f0f020bdbd7be93db0376bbaa0e7cdeee413b7be8bcb2f3a27e30ffec30cc3e02b9fbe9595175c8725781aa56559ac79fe29fa0e1ea07bf60242a1b058b65299a00580523e65db1603037df4f6eee360ef3e623ed89277aa962e9cc387df7b23975f740e8180f7538d569cb0909b6f7c035ffdceff8867efdbb78b818183cc9eb3889a1ab9f9064ab94d0b00a57c24994c30d07f30f5d03fb8df779bf41ccf692b96f2cfb7bc8d57bfea54cfdef88fe6ff7decbddcf5d78759bf69ab78762c36c9ea671fa7b2aa86ceceb9949555885f4329695a0028e5b1d19161fafa0ed0d77f80a1c17edf6cc53b1daf39fb343efcde1b5975f232af9b725485d108fffd8dcf70ea85d7914cbab3b5ef40ff419eec7f80caca1a66cc9849754dbd2f7a40943a122d0094cab04422c1407fefa1877eaf2f4edb4b472814e4f28bcee5d6f7bc85a50be778dd9c2959be6c019ffef0cdfcd3a7bee2ea7506060e3230709050284c6d6d0375f54d5456d66831a07c450b00252a994c3031314e3c1e235210a5a8b824ef6f7ac96482c1c13e06fafb181cec637474382bdff20f2b2f2be1c66b2fe73d6f7be3b40fe9f1830fdd7c034f3fb79e9fddf647d7af954c26d8bb77277bf7eec4300294969651565641695905d1681191489468344a20107cc9efb36d8b442241221e279e88110e175058584430a8b76c25477f9a94880307f6b2a5673d7d7d075e32d33a140a535fdfc4acae791417977ad8c2ccc9b507fe61edadcdfce33baee52d6f7cade3bdfabd641806dfffda27d9b0791bcf3cbf3e63d7b56d8be1e1418687078ff8ef038100814010d34c1ef1e72510085051514d6b6b2755d5b2bb26aafca405807224994cf0f4538fb26fdfaea3fefbddbbb7b367cf0eda3b66d3d636cb7793c39cb06d9bb1b111868706181a1a60787880b1b151af9b25ead4e54bb9e59dd7f1dad7bc2aedd3f9fca6a830caef7ef235565dfc66b6efdce3757380d4b2c2632d53b42c8bfefe5efafb7ba9ad6b64eedc2584427a0b57e9d39f1e9536d34cf2f0437f666868e0b8bfd6b66db6f4ac677c6c8479f3fd3b51ec78262727181d1d627868f0d0037f10d34c7add2c7125c5455c73c585bcf386ab583c7fb6d7cd71454b73037ffad57738e3921bd8b3cf7fa7231e4bef81bdc4262758ba6c25c160f0f8bf41a923d00240a5edd9671f9fd2c3ffc5f6eddb4d6969052dad1d2eb54a866d5b8c8d8d323a3acce8c81023a3c38c8e0cfbf2401d490be6cee29d6fbe9a6bafbc90b2d212af9be3ba59edaddcf3cbef70e6a56fa1b76f7a3fcb5e1b1e1e64c3fad5cc9bbfd4eba6a82ca505804acbc0c04176efda9ed6efddba75230d8d3308870b845b357d9665313131c6f8d82863e3a3a9ff1c1b616c6c4474d7383f8b1414f0ba8bcee69d375cedeb657c6e9937bb93fb7ef7035ef3fa77f9663860aaf6eddb45f38c9994eb11c52a0d5a00e4968c0dd06edbba29eddf9b4c26d8b76f172d2d99ed05989c1c6770b09fd1d161c6c746191f1f6562623c2726e8a563c98239dcf0c64bb9e6f20ba9aecaef8d6be67677f0f09d3fe682d7bf8b67d76cf0ba39d3b267f7f6a9150032536f7263128802b400c83551a701535db277e0c05e47d7e9eb3b90b1026070a08f2d5b363038d89791ebf959755505d75c7e2137bcf152962cc88eb5fb99d2d450cbfdb7ff8037bcfd56eefcd3035e3767cafafa0e4ce9d7094dbe757c8f51fea105406e29721a6018c72f0092c984e3636727c6c71dfdfea9eae959cf8eed9bf3f62d1f201c0e71de992b79f31b2ee592f3cfa4a0400fad399ab2d212eef8df6ff0f9afff808ffebfafbbb663a0a4783c46329938ee6144420540a14488f2072d00728be32f672070fc9b443cee7c225c2626d3f56c5ec7f6ed9b5dbf8e1f8542415eb56a05575d7a1e975d70365595e55e37296b1886c1adef790ba7ae58ca3537fd133b7639ebedca04d334a7500088f4de6b019043b400c82d8e7b000253ba49387f9b2e2e8af27fdff9046632c9e8f804a3a36390a79b4f00002000494441540c0d8f3030344a5fff20fd03231cec1f66606884fec131068646a695dfdfdf9b770fff6030c0192b4fe4aa4bcfe7f28bcfa526cfc7f59d3a6dc552d63cf81b3efa6f5fe71bfff5534c33bb27850af50038bec728ffd00220b738aece33b5d5a86118d4d6d54def37d936b66d63db169665128f4d92884fd2dfdb4722f1f7218940d0e0926b6e166eb13f050201569dbcecd043ff1cea6babbd6e524e29292ee22b9fb9956bafbc889b3ef029fef6ec5aaf9b9436a1efb6f600e4102d00724701027f9fa1b08fc7870d03c33030081008860885234039e555f560252019032bcedf9e5dcb3a178e7cf58b5028c8a9cb9772f9c5e770f945e7d2d4a0dbc2baedc425f379e29e9ff2cbdbefe1e39ffb16eb366ef1ba49d326b46b60080803d9754eb53a222d00728748657ebc7144df0a84a1200c5692071f7fc6ebd688abadaee4d5679fc685e7aee2fcb34ea5a23c3fce55f013c330b8f292f378dd85e7f03fbffc3dfffeed1ff966c9e05426b90af6ee15a205404ed0022077387e0d0c0402d9bfad6820c4969d535b16e5678661b064c16c2e386715179e7b3a2b4e5898f7a72afa453018e0faab2fe6faab2fe681479fe21bdffb29bfb9f3cf2412fede123a180c6218016cdbf15c861a6058a049ca635a00e48e194e03fcb0339f846c3d20a5a4b888b34f5ff1c243bfb9719a732454c6ad3a7919ab4e5e465fff20b7fde12ffce2b777f397071ff76d31100e871d2fe12575afc9be3110f50ad979a75447e2b800884472638f8fa6867aaf9b302585d1082b972fe1acd39673d66927b17ce94242a12cef81c953d55515bcf59ad7f1d66b5ec7c0e030f73ef404f73ef424f73ef404cfafdfec9b6da5c30505520580ca015a00e40e2d000e396de572af9b7044918202569cb0f08507fec9272e2252901bbd2eeaef2a2bcab8ecc2b3b9ecc2b301181a1e65cd86cdac59dfc3f3eb36b379eb0ef6eeef657f6f1f070ef66774b3a1828208634c6f49ed1168019023b400c81d2d4e0322d1dc58e1b3fc8425cc9fdbcd9a751b3d6d476949312b4e58c829272ee6f4534ee0d4154b298c463c6d93cabcf2b212569eb48495272d79c5bfb36d9beaee550c0c666648bda040e4e74f0b801ca10540ee70fca58ce6480f8061187cfa5f3ec4656fb831a3d7ecee6ce3e4131771ca898b59b97c09f3ba3b090675e29e3a3ae3d0d2d64c8914887cc7b500c8115a00e40ec75fcac2c2628976f8c26b2f7a35efbcf17abefdbd1fb9923fa3a99ea50be7b074e15c962f5bc0c9272ccafb13f594ff45657af9b400c8115a00e48e76a70145c52512edf08d6f7ce9d3048341bef19f3f483b23180cd039b385a50be71e7ae0cf61e9a2b9d456ebf9eb2afb440b4576f2757caf51fea005406e68051c3f918a8a72a7070052fb1a7cfd8b9fe2d5e79ec9473ff9799e59bde6a8bf365250405b4b23f3e7cc626e577bea3fbb3b98dbdd4e34a2e3f62a3714ca1400354013b047224c79470b80dcb0d8698061183957001c76e1f96773e1f967f3dc9af5dc7fff7decddbb8f48a480f6d66666b636d3deda4c53436d46c76295f242342a7696cf62b400c87a5a00e406c70540345a482090db6bd017ce9fc3c239332131ee755394f2443018241a2d647272c269d462e00f024d521ed229cab961a9d380b2b23c99c066e47691a3d4f108cdf571fcd2a1bca705406e70fc652c2dcd930200ede657f9adb858e420292d0072801600d9af0ce8701a525a562ed0946ca00580ca6fc545223d00dd80d88402e50d2d00b2df62049e6aa5a5f952001cffd854a5725989cc773d082c900852ded10220fb9de934201008e65101a0547e2b2929933a5afa0c8910e51d2d00b2dfd94e032a2a2af5ac79a5f2442010909a07e0f8dea3bca577fdec56049cec34a4a2a25aa0294aa96c512ab3ea6715a0bb6465312d00b29bc817b0a2a24aa0294aa96c21b4ec57e4054479470b80ec26d20557555d2b11a394ca1282bd7eaf920a5299a7054076735c00141515e7d429804aa9e32b2a2a262273fcb7ce03c8625a0064af6a6089e390ea3a81a628a5b24db9ccd0df72527b91a82ca40540f67a2d027f7f5a0028959f2a658601c2c0c512412af3b400c85e6f9008a9a96d9088514a65992ab9e2ff6aa92095595a0064a73a0436e1282bab903a1f5c2995650a0b8ba4e6ff9c0fe852a22ca4054076ba1a81a39cebea1a059aa294ca5642438005c0a512412ab3b400c84e574984d46a01a0548e48ef8c8bea1a1d06c8675a00649f1660a5d39070b880aa2a5dffaf543eabacac211874dc9908a9e5803512412a73b400c83e5723f0f7d6d0d0acfbff2b95e70281003535f5125121e00a89209539fa04c82e0670a344506353ab448c52ca17d23f11bc566e25d0bba58254666801905d5e0dcc761a120e8725bff44a29cfa537070052f3000281a044231600a74b04a9ccd00220bbdc2c11d2d03043bbff9552000483216a6a45860140e81ea532439f02d9a38bd47a5bc766b4b44bc428a5724443c30ca9a8d7929aa8acb2801600d9e36604febea2d142ddfe5729f512d5d5751414383e591c529301df2911a4dca70540762805de2411d4d2d28161a43f614829e53f76fa530000300c83bafa2699c6c0db0091a30695bbb400c80e6f41e8c4ad16edfe574a1d4193dccaa01ae05aa930e51e2d00fc2f0a7c5022a8b6b681e292528928a5948f4874ea959494515e5ee93c28e5a380c89882728f1600fe7733d02c1134736697448c522a473535b74945b5016f950a53eed002c0df4a810f490445a385d43788d411594ee73fa8dce3740ec061f5f54d84c3619930f808502815a6e46901e06fef45687fedb699b374f21fe8f35fa96308048292bd004de8ee80bea605807f5500b74804058341edfe574a4dc98c19ed921b85dd8ad00466254f0b00fffa10203223a7a5b5436a8d6f0ed01f79a58e2512894a2e09ac01fe512a4cc9d2bba13fb501ef9108320c838e0ec7c707e40e1d0250eab85a5b3b25e33e88d04466254b0b007ffa2a502c11d4d8d84271b12efd7b81ad158052c753525226754c30a426337f452a4cc9d102c07f5e035c2a15d6d53d5f2a2a37e8f35fa9296997ed39bc02b848325039a70580bf1401df940a6b6a6aa5acac422a2e876815a0d4f19496964b9f1bf20d847a36950c2d00fce55f0091bd7a0dc3a07bf60289a8dc63e88fbd525321dc0bd0067c58325039a37742ff9807bc4f2aacb9b98dd2d272a9b8dca205805253525656416d5da364e40781b992812a7d7a27f40703f83620b20557201060f69c451251b9493744526aca3a3be7486e225640ea5ea75f421fd002c01f6e044e970a9bd9de4d51910eb51d95f600283565454525922705029c41ea9ea73ca67742ef35009f930a0b870be8ea9a271597a3f4c75ea9e9686fef26180c49467e9ed456c1ca437a27f4ded710daf10f60f6ec85baebdff1680f8052d352108932b35d743bf10ae03f2503d5f4e99dd05b1701574a859596964b7f497393dc3ee74af984d07180c7d0d2d24151518964e445c02592816a7af44ee81dd135ff000b179ea827fe4d8511f4ba054a659d4020e0c6d2e22f0351e95035355a0078e70380d8cc9ae6e636aa6b4437edc861860e03289586aaaa5aeaea4487ee3b48dd0b9507f42ee88d6652a7fd89081714307fc132a9b8e392e865b02cf7bb2c8f497b01944f98a6e93823933d7fddb317100a89ac583eecc308be0ca9a9d302c01bff86e09698f3e72f2512c95c2f9a21f0f61c8bc7045ae280ce03503e118f271c67487c27a7aaa02022bdd2a808f8ac64a09a1abd0b66de49c0b552613535f5b4b47448c54d89c4db46229114688903da03a07c2226500004325cd03636b55259592319793590b96e4c056801e0852f22f4e71e0c0659b478b944d4b40404de362ccbf2b608d00240f9403269625996e39c4c17000073e62e221814fb1e05d05e808cd30220b3ce4570c7bfeed90b282e165d96332581a0cc8f4d3c1117c9498b21baa989526989c565be03991c0238acb0b098f676d1c382ce05ce910c54c7a60540667d422aa8acac82ce4e6fced408064322c300a3a36302ad4993616811a03c373a362e92e3450f00404b6b87f4a1639f910c53c7a60540e6bc06384522c8300c162f59eee99a7f8959c07dfd03022d7140766b53a5a6adaf7fd0714628e4ddcfb16118cc99bb58f25eb49cd4bd5265801600996120f8f6dfd6368b8a8a6aa9b8b448dc740ef6795c00680f80f2d8418102201c2e106849fa4a4bcb696c6a918cfc9864983a3a2d0032e30252b3ff1d0b870b983d67a14494e37638e5790f40400b00e52d891e00af0b0080ce8eb9927b039c426a3e80729916009921b6d35557f77c5f1cf623d186837dfd022d71c008e86a00e5a95ce80180d466641d1da213023f2219a68e4c0b00f79d009c2911545c5c4a7b7bb744946391a8f38d87f6ecdd27d01287b417407968cfbe038e33fc50000034cf68a3b0506c7fb33348dd3b958bb40070dffba482e6ce5becd96cdf9793d87970dbf65d022d712828baa5a952d3b26dc71ec7197e29000c234047a7682f80d8bd531d993f9e26b9ab05a1e37ecbcb2b696c149d68e3482452e83863db8e9d022d7128104e4dd154ca035b77ec769c21d11b27a5bebe597259e095c00ca930f54a5a00b8eb6640e415d30f13ff5eacb0b0c871c6d6ed3e280030524580521e9028000aa3cebf8b923a3ae748458581774b85a957d202c03d11e00689a08aca6aeaeb9b25a2c4141539df8170d7eebdde9f090060f8a30b55e5974422c9eebdfb1de744058a7149d5d57594955548c5bd05d02fa84bb40070cf6580c86919b367fbebed1fa0a8c8f9641fd334d9d4b345a0350ee98640ca031b7bb6639acecf0190e88d9336536eb2721da97ba972811600ee799b444859792575758d1251a22291a8c86640cfad592fd01a878c20047439a0caace7d66d729c110a8525d7df8ba9a9a9a7a4b44c2aeeed5241eaa5b40070c72ce02c89a04eb9f13471c5c5a58e33563fbf4ea0250202deefada0f2cb736b373acef0e3dbff6182c7949f05744985a9bfd302c01d372230b73c1a2da4a9a955a039ee9098edeb9b022058802e075099b47aadf31e80e212e745b85beaeb9ba496281ac0751241eaa5b400901700ae91086a6feff6cdbaff23919808b87a8d4f0a0023a09b02a98c5a2dd003505222d6cd2e2e10084abec05c8356e8e2fcfb74c95ea722b07635180cd2d6364ba0396eb1890aecfab563e76ef608cc841611d4610095197bf6f5b263d75ec7397e2e00009a67cc943a29b003a1d354d5df690120ef6a8990c6c616c205fe5dfd9248242811ea7e7cf8b12745721c0b86d1970c95090f3ef694488edf0b8068b4909a9a7aa9b86ba582548a1600b282c01512417e7efbb76d9b783c41345a2852a43cf4e81302ad92601c9a0ba094bb1e7cf469c719e182025f1c0c763c3366b44b455d4eea1eab84680120eb4cc071b95b5252465575adf3d6b8241e8f03360065a5ce37fcf04f010084fcb3adaaca5d0f3ff18ce30c89ef5e265456d5505cec7cbe10a93d014e950852295a00c8ba5c22a4b5ad5322c6159669924c265ef8efa565ce57023cb37a0d23a3a38e734418419d0ca85c35343ccab36b3638ce292faf12684d66d437886de9af9b0209d20240d6054e030cc3a0b9b94da22dae8827e22ff9ef15e5d58e331389247fbef741c73962b41740b9e84ff73f4a32693acea9a8c8a202a0be492aea3274a28e182d00e42c041c3fb9abaa6a89469d9fb4e78664328969bef4c6555e5125b254f10f77ffd571869840416a59a0522ef8c39f9c17bb8611a0546ebf7dd71516164b9d12d8062c9208525a004872fcf60ff8f8eddf261e8fbde27f0d06839495553a4ebff3eebf38ce1015d45e00e58ebbef7dd87146695939c16076cd87ab93eb05384f2a28df69012047a4fbbfb1a945a22de262f138b66d1ff1df5556393ff368d7eebdac59e77c631431a108dad3a8a4ad5ebb919dbbf739cea9c8a2f1ffc3eaeac40a80f3a582f29d1600322a80954e43aaabeb7cb9acc7b24c9289c451ff7d65a5c8a187fce6f63f88e4c83020eccfa11895bd6ebb53a6a7cbcfab848ea6b0b048ea98e0d300e7bb90292d00849c0a389e3a5e5fdf2cd01479b1d82bbbfe5facbcbc82a0c091ba3ffff5ed8e334405233a174089faf96fef729c110c06a9a8703ef9d60b7532f7b80870ba4450bed3bb9b8c55122175f5fe3bf63791486059c73eb3dc30022233929f5bb39e751b9c1f9022c7d0b9004accf3eb36b3667d8fe39c8aca1a5f9f11722c82bb026a0120203b7f8afcc7f10f637171a9efb6f5b46d9b44e2d86fff875556c97449feec577eeb05886a2f8012f1b3dbfe2892539d85ddff871515154bad721279e9ca777a6773ae0838c169881fdffee3b1184799f7f70ab5b53295fdfffdf2b72239620c745f00e5986ddb8205409d488e5784e60c9d08e8241d87b400706e05e07803f99a9a0681a6c8314d93a4999cf2af2f2c2c165997bc61530f0f3cfc98e31c51c1686a8740a5d274ff237f63d3961d8e738a4b4a29143885d34b159522f31722c07289a07ca605807322475456092ca593143fcec4bf23a9175ae6f3bdfffea9488ea87091d72d5059ecbb3ffe95484e7d9d3f270a4f87d4aa21b400704c0b00e7963a0d282babf0d5f2bf443c8e651f7be2df91486df4f18bdfdcc1c0e0904896984038f5516a9a068746f8cdefff2c925557e7bfa1c2e98a460ba57a311c0fbde63b2d009c735c0054094da093605bd62bf6fb9faa68b490b272e7bb024e4c4cf293fffbb5e31c71e162747320355d3ffec5ed8c4f4c3ace29292da348e6543dcf09f5786a01e0901600ce54001d4e43fcb4a947fc181bfe4c85d430c037bff3c3e32e3fcc3823a01302d5b45896c537be2733a4950bddff8709cd03e824750f5669d202c099a508bc12fae5542fcbb25e72d46f3aeaea9b300ce76fc91b36f570fb1fee719c234e2704aa69b8fdaefbd8d8b3dd718e6118d437886da5ebb9d2129183810c60b14450bed202c099254e0342a130c5c5a5126d712c114fafebffc5229128e54205cd97bef61d911c518601053a14a0a6e68bdffca1484e65650dd168ee4c442d2c2a26101029a4e74984e42b2d009ce9761a505ee17ccc5c82695ad35af6772ccdcd3345721e78f8311e7de229912c5146e8d061414a1ddd134f3fcf838f3d2d92d5d4dc2a92e3178661505c22f2e2335722245f6901e04c97d3807281497312e253dcf16f2aeaea1a2888c88c957feedfbf2592232e58a44301ea983efdef323d58e18202dfed13224168e7532d001cd002c019c70580d0e9588e98c92496698ae5194680e626993796dffefe2efef6f46a912c510687560528f54a4f3cfd3cb7df759f485663434bd6eefd7f2c25da03e0b9dcfba9ca9c426086d390e262eff7ff4f249d8ffdbf5c53731b86c01efab66df32f9ff9a2408b5c10084148772355aff42f9ffd26f654f7d13e8e5cebfe3f4ca807a009d0a53969d202207db310f8f313aa82d3669a26a629bfdc2e1289525b27d36d79e75d7fe1e1c79e14c912178aa60a01a50e79e8f1a7f9e35f1e12c9aaa9a9a7a82837d6febf9c500160006d1241f9480b80f4392ecbc3e102cf77004c385cf6772c3366cc14cbfac8273e279625cb8070899e18a85ef091cf7c5d2cabb5ad532ccb6fc2e102c261c7c7a800cc9408c9477ad74a9fe345b942b360d3665b16665266e6ff915454548b1d717cef038ff0ebdffd41244b9c118082dc7c4b53d3f3cbdbefe1be87657aabcaca2aa8a810d930c7b722329385b507204d5a00a4cf710150e4f1a95e7117dffe0f6b9b394b2ceb831ff914939372ab1544192108eb7c807c36198bf1c18f7f492cafb53577dffe0f132a001ccfc5ca575a00a4cf7101108d7af7c0b06d4826dc7bfb3facaeae496ca3a32ddb76f0956f7d4f24cb15c1423d30288f7de95b3f62dbce3d22598585c5d4e6c0c13fc7235400d44b84e4232d00d2e7b8008878580024cd0420334bf9580cc3a0bdc3f17e492ff8b72f7c9d5dbbf78ae5890b97a47a03545ed9b97b1f9ffdea7f89e5cd6cef12d952dbef84f60ba99308c9475a00a4cf71d5e9650f40d2e1a13fd3515bdb2836176064749477bfef232259ae300c2828d5498179e69d1ffc34a363e322594545253434e447afb6500f80160069d2bb54fa1c9f66e15501605956464fda330c83f676b95e80dfdd79373ffff5ed6279e20e17017a5e405ef8bfdffc91dfdf73bf585e7b47775ebcfd835801e09fe354b38c1600e9733cb02db40466da9c9ef8978edaba464a4ae5363d7acf07ff85fe8141b13c7146f0504f80d70d516eeaeb1fe41ffff9b36279c525a5d4091da99d0d840a00ef7753cb525a00a4cff10f5d28e4cd58b19b4bff8ea5bd7db658d6fe03bdbcf7d68f8be5b9221082902e0fcc65effde8e73970b05f2cafa3634edebcfd03048322f7407f1ca79a85b400484f10707c36672894f919e3a66962096d513a5db5b50d5456caad6bfef14f7fc54f7f719b589e2b82057a66408efae5edf7f0935fdc2196575959436d6dee1dfa732c42671c1492ba27ab69d202203d650874ee86c31e14001ebdfd1fd6d5bd40f40de75db7fc333b76ee16cb73453002e1dc39cb5dc1f69d7b78db2dff2a966718065dddf3c5f2b2453020f2dc36d05e80b46801901ec7fbf71a864140e6877f5a92a6b705404949193366b48be50d0e0d73dddbde8329789aa12b825108694f402e304d8bebdef5cf0c0e8d88653635b58aad94c92681a0d823480f044a831600e971fce7267152de7499962976429913ed1ddda26720dcffd0637cea735f15cb734d280221ed09c8769ff8c2b779e0d1a7c4f242a1301d9d73c4f2b289e031c73a0490062d00d2e3f887cd8b793e5e77ff1f160a85e99c257b8cf7a73ef7157e7fd79f45335d118aea704016bbfdaefbf8cc97bf2b9ad9d139c7b315415e338c80d490a0160069d002203d020540e6ffe89349ff74933736b6881e74625916d7bef566366fd92696e99a6054970866a1cd5b7770fdbbff59740f8db2b24a9a9bf3fb2c1ba15e002d00d2a005407a048600249a3175b66d61db99dbfc672ababae78b4e081c1c1ae68a6bdfcef8f88458a66b0261088bcc25551930363ec1ebde748be8b87f201060eebcc579b5ecef48845e86b40048831600e971fc8dcdf450bc9fdefe0f2b2d2da76d669768e6b3cfade59ab7de9cd19d0ed31608e9b6c159c0342ddef88e5b796edd26d1dcb6b6596207656533cb12b937c52542f28dde79d233e93440e8877ecacc0c5f6faadadbbb282dab10cdbced8e3ff2be0f7f4234d33581101494a5760e54be74cb473fcfeffe78af686671718978f19b8d6cdb962ad6b50048831600e971dcc76c59564667e45b3e5d26671801e6cf5b2abe24f2abdffa2fbef6edef8b66bac60840a44c8f12f6a12fffc78ff9faf7fe5734d3300ce6ce5b2239033e6b9972cb92635241f9447f02d32332c82cf8c37fecebf864f9dfd1141597304b785500c0fb3efc097ef5db3bc573dd71e800215d21e01bbff8dddd7ce0e35f12cfede898435959a5786e3612dcbf23f3079ce4002d00d23309387ea2666af31acb87e3ff2f37a3a59daa2ad943bd4cd3e48d6f79377fb8fbafa2b9ae0a46a1a0049d1ce8addfdf733fd7bef3c3e273492a2bab696deb14cdcc6642f7400b90398b39cf6801901e1b817900993a95cfcc860971c0dc794bc4cf4788c7135c7eeddbb8f7814744735d1528383424a0f302bcf0d7071fe7cab7bc9f785cf6fb190a85993b6f69decffa7f31a1a1c9115245809a262d00d237e0342016cbccb055a6271ca62b12893277ee62f1dc8989492ebef2cd3cf2f8dfc4b35d6304a1a01c42855eb724af3cf2c4b35c72ed7b989894ff6ece9db7846854ff3e5f4c6818d4c7e782fb9b1600e93be834201e77dc89705ca9f5fffe1dff7fb9daba4666ba303b7a746c8cf32fbd86fb1e7c543cdb55a1c2434b05f5add16df73ef404e75f7513a363f2bdc96d6db3f2eea4bfa948244426ef0f4984e4232d00d2d7eb34201e77bf07c0f787e41c417bc76caaabebc47347464779cdebaee58ff7dc2b9eedaa4038d51b10c8cfed6233e1ce3f3dc005af7f1723a363e2d995553579bbd7fff14cc644e653f74b84e4232d00d2e7b8072013430059b121cecb1886c1fc05cb282a923f3d6f6262924b5f7f03bffedd1fc4b35d6504529303c3453a3f50d82f6fbf87cbdef45e57bafda3d14216cc3f41c7fd8f223629d20bba4f22241f6901903ec73d009313ee4f5ccdc602005213a6162e3a896030249e1d8f27b8eafa9bf8d677ff5b3cdb75c1e8a18d83f4ab2be11bdffb29af7fdb07c527fc416aabdf050b4f245ca03d3747333929d203b05722241fe95d247dfb9d068c8f8f4ab4e398b2b50000282e2e65defca5ae649ba6c9bbdff7113ef0914f65df9f9111827029da15903ecbb278dfc7bec0cd1ffe7f98a6fcdfbf6118cc9bbf9432e15d2e738d5001a03d0069d202207ddb9d068c8fcb8f37be986ddb593501f0486a6b1be8e898ed5afe97bef69f5c75fd4d4c4cb83f2153542008e112af5b91952626635cf9d60ff0e5fff8b16bd7e8ec9c4b5d5d936bf9b922263307407b00d2a40540fab6390d989870b700b07c76fa5fba66b677d3d2d2e15afeaf7e7b272bcfb994addb77b8760d5704c310d46565d3b173f73ecebcf4067e7dc79f5cbb465353ab6ef63305b66d118b8914dedb2442f2911600e9dbea34c0344da92eb023cabaaeed6398d5358ffafa66d7f29f59bd86934ebf90bbff7c9f6bd7704538aa4b04a7e8aebf3eccd2575dc5e34f3defda35aa6bea993d67916bf9b924169b94eaa1dc2211928fb40048df1e040ea01819716f09ab9d4305c0e10354dc581e78585fff00175c7e3dfff6c5af67d1d08901213d3fe0586cdbe6335ffe2e17bee15df4f5bbb7674c4545150b16e88cffa91a1d1d91889920752f5669d002207d16e0b8cf7864d8bd1b52f63cc4a6e6f0aceaf272f70e52314d938f7ce273bcfab26bd9bbef806bd711158ca013028f6ccfbe5ecebfea263efa6f5f7765b2df61a565152c5abc826050b76f9eaa5199979fad089ccb92afb4007066bdd38061377b0072640ec08b058341162d5e417149a9abd7b9fbcff7b1e8e473f8edefef72f53a62827a94f0cbdd76e75f587cc6e5dc73afbbe740149794b264c90a4221f925abb94ca8f773934448bed202c019c78389aef60058b9591887c361962c3999e2627767c11fecebe7b5af7f2b37fde33f3132eafe924d4782bad6fcb091d131def1fe4f72d99bdecb4117bbfc018a8a8a59baf414c261fdf39fae9191618918f72674e4012d009c715e008c0cb93659cfcab12180178b44a22c5b762aa5a5e5ae5feb3fbfff13162c3f9bdfdff567d7af953643bb9e01eeb8fb3ee69f7619dff9d12f5dbf56b22512a00000200049444154717129cb96ada4a020e2fab5724d22916072526423342d001cd002c099354e034cd364d8855e002b47dffe5f2c5c50c0d265a7505e5ee5fab576ecdccd4557bc89abaebf8903bd8e7781966704c8e77900fb7bfbb8fedd1fe1e26b6e66e76ef7f785292d2d67d9092b2988445dbf562e121aff07784e2a281f6901e0cc7ac0f1799603032e3c507270fcff4842a1304b969e4c55556d46aef78bdfdcc1dc13cee49bdff921c9a4c851a6428cbc5c0e984c9a7cfd7bffcbdc9597f2e39fdf9e916b565454b1749976fb3b31322a5200c4818d1241f94a0b006762c03aa72103037d024d79a9dc7fffffbbd4c4c0e5193b6eb57f60907f78ff4759b2f23cfef4d70732724df54a77fff561169f7905eff9f067191814194f3eaeeaea3a162f39995048275d3a313c24d2ebf92c207f88431ed102c0b9c79c060cf4bbd103904f25c0df97083634cec8d835d7acdbc8b997bc814baf7e0bcfafdd90b1eb1e559efc9d3fbf6e33975c7b33e75f75136b37f464ecba4d4dad2c5abc5c97fa3964dbb654afe7131221f94c0b00e71e751a303e3e2a7e2e40aeed0130158661306fde52babae767743396dfdd79378b4f3997abaebf890d9b32f7407a299b5ceff7d9ba6337ef78ff275972d615dc7e5766776c6c6fef66cedcc5bac98f80d191211289b84494e397af7ca70580738e0b008083bdb21397f26306c091b5b474b070d189ae1c257c349665f18bdfdcc1fc935ec59b6fba25f385806566f67a19b461f336de7cf347e95a7e21dff9d12f5dddd0e7e5028100f3172ca3ddc503a9f24dbf5c8fa7f60038a4e5ac7301a01f70b41eada9b995134e3855a645403c1e97aab2b3d6d8e808ab573fcec484c872a3690904025cf4ea73f8c03fbe83552b57b87f4173121299ffffe9a6071e7d8a2f7ef387dc71f7fd9e9c6b11894459b0f0848cac32c9274f3ff588c410401f50477ebfeb38a63d00ce590874451decdd9f97ddf66e2a2e29e5c493565159599df16b5b96c5efeebc9bd3cfbf9c15675ec44f7f711bb1988b0599991bc55e2c1ee7a7bffe032bce7f23a75ffc667ef7c77b3d79f857545471d2f2d3f5e12fcc344d8686fa25a2ee471ffe8e690f808c5b81cf3a0d5975fa795454c83cace2f11889844e9085d496c81b37ae61f7ae6d9eb6a3baaa92ebde703937bee98dcc9fdb2d176c5b107377c73bb7ad59dfc3f77ef22b7efc8b3b5c3db0672a5a5a3a98d53517c3d0f72369fd7dbd3cf38cc8a8e97b81af4a04e5332d00649c003ce934a4ab6b1e73e62e16688e160047d27b602febd73feb8b3f97952b4ee40d575eca15afbd88867a877b182426c074ef5869b7ecdddfcb2f6fbf879ffefa0f3cf2c4b35e37875028c4ec398b5c3d763adf6ddeb4861d3b444eef5d426a19a072400b001901e000e0e8f5bda4a48cb35e75a14883e2b11889a4f70f3abf89c52659bbe66977365f4a433018e4f4535770f5e597f0da8bcea7be6e9ac5806d416c886c5901b0bfb78fdffcfecffcecb6bbb8ff91bf79d2bd7f2465e595cc9fbf8cc2423d5ad94d0f3ff42726271d17ab07817a7408c0312d00e4fc1cb8d269c859675d48496999e3c6c4e231923e78d3f5ab9d3bb7d0b3799d6f1e4087cd9bd3cdc5af398773ce5ac519a79d42387c9c950cf111b0fcfbf76c9a16cf3cbf9e3fddf728b7df751f8f3cf9acaffecc0dc3a0b5b5938eced9dae5efb2c1c17e9efadb4312513f01ae9308ca775a00c8793bf09f4e43e6cc594457f77cc78dd11e80e31b191962cdf37f13df83414a654539a79e7c12a79e7212a79d7212272e5d4c34faa28367cc1824fcd5f6c9588c279f59cb838f3ec5438f3fc3838f3dc5e0d088d7cd3aa2c2c222e6cd5b4a79854ef4cb840d1b9e939a87730df0bf1241f94e0b0039cdc04e1cfe9996969673e65917386e8c2e039c1ad334e9e959c7ee5ddb7cbf0a23122960e9a2052c5e388f45f367b370760b0be77451515eea497b068746786edd269e5bbb89d56b37f2ec9a0d3cbd7a3db1b8bf7fee0cc3a0a5a59df68e39baab5f86d8b6c5830fdc23714f324975ffcbef9f9e87b40090f528e078d1f7aad3cfa7c2e15b49221e27ae05c0948d8c0cb161fd6a574e66745b53432dedad33686f6ba6bdb59999ad4d3437d653535591fa5457525c5438adccb1f1090ef60d70b07f9083fd83ecdebb9f6d3bf6b075c76eb66edfcdd61dbbd8b3afd7a5ff47ee29292d63ee9cc594965578dd94bc72f0e07e563ffbb844d4c380dc8629792e735ba5e587db10280076eddceab80050d3535a5ace09279ec69edddbe9e9594f328b864ff6eceb65cfbe5e1e7afce9a3fe9a682442616184b2d212828100a15090d29262004646c748264d4ccb6278649489891893b158a69a9f11c160909933bb696debd4ed7c3db07fff6ea9a85f4b0529ed0190d685c0f194050511ce3defb50402e94f4a4a2412c4e3b97513cf944422414fcf3af6ecdeee75539480baba266675cd231a9d5e2f8892619a260f3e7037a6e9f8f86c1b6807f48b294407c064f50357018e16769ba649797925a5a5e9ef2e6c5b16a699bbfbc3bb29180c5253534f45653563a3235a4865a9b2b20a162c3c81d6d64e3dbed743fbf6eda2f7c05e89a8c7812f4904a9142d00e4d501673a0d89c763b4b4b4a7fdfb2d6ccca4e38a3baf151616d1dcdc467149196363c33aa9324b44a3457475cfa7bb7b01d1a8aeebf7dadab54f93909918fa15e011892095a24300f23a814d08fcd99e79d60569f70298a629b1e1863ac4b66df6eddbc5d62d1b999cccad43777245241265e6cc2e1a9b5a1d0d9f2939fdfdbd3cf3b4c8d6bf16d006ec92085329da03206f003817689508abaf6f4aebf719a0fb0008320c83d2d27266b4cc241a2964646448624c5309081714d0dedecdfc05cb282fafd2497e3eb271c3f34c4c88ec55f127e09b1241eaefb44c76c78f244276edda9a7eb7b3de045d6118019a9adb3869f9e95e3725ef151515337bce224e3df51cdada661108e8fb8c9f8c8f8fd2df2fb654f4bfa582d4dfe9324077fc8cd47895a369c7c964926ddb36d3d5356fdabf57df82dca55dccde292d2da7a5a583fa8666fd39f7b19d3bb74a6dae350cfc462248bd941600ee18027e0bbcde69d0969ef57474ccd61dcb7cc6e79b06e69c6030485d5d13cdcd6d9495577add1c751cc964827d7b774ac5fd0cd089372ed002c03ddf42a00088c7636cdfbe998e8ed9024d525274fc3f33e675b56206caa96f68d6a57c5964d7ae6d92cb90bf2515a45e4afb31ddf30042e755f7f4ac9ff6096a7edfd73edb6901e09e19f555dcf2a60b78f2179fe1eeef7f82e61933f5e19f4592c9043b77f448c53d043c2315a65e4a7b00dcf54de03b4e432627c6d9b1bd8799ed5d53fe3d96ed9f23577391eeb120abb1b6822bce5bc155af3999954bba09045263fb7d23fae79c6d76eedc4a42ee28729df9ef222d00dcf53fc0e700c783961b373ecf8c967642a1a9fd959909bd71ba2926b03b60655931ad8d353cb7690796955f3d368180c1d2b93379cdaa25bc66d5624e5edcf5c243ffc52261eda4cc268944829d3bb648c5ed057e2515a65e490b00778d03ff057cc069502c36c9969ef574cf5e70dc5f6bdb3609eda276d5f8d8a8e38c954bbbb9e3db1fe4e0c008f73db18ebf3cb686bf3eb696755bc40e4ef19596866a4e3f710ee79dba88f34f5b447df5f137b98a16e8e4d76cb27ddb46c983b4be06e8f69b2ed202c07d5f066e06224e837a7ad6d33673169148f498bf2e9188eb3475978d8f3b2f00da67a48e8ca8a92ce5f2f39673f979cb01d8db3bc85f1f5bc37d4faee3a9b5db58b379171393d9751f0c06032c98d5c26927cc66e5922e569d38879686ea69e78402100e054924f55c0bbf9b981867d7ae6d527123c07f4885a923d302c07d7b486d62f176a741c964828d1b9e67e1a2138ffa6b4cd3ccaaa36cb3d598400f40c78cba23feef8db515bcf1a25379e345a963cf4dd362e3f6bdacdeb0836737ec60f5a1cfce7d7d8edb20a1aeaa8c85ddad2c9addcac2ee161675b732afb399c2688140bacdc2590d3cb53e377b457249cfe675d39eac7c0cdf0506a5c2d491690190199f07de8ac0d6cbdbb76fa6b5ad93f223ac85b64c93586c525ffe5d669a494646861ce774b4d44fe9d7058301e6763433b7a399ab5f73ca0bfffbe0c8383bf7f6b163ef4176ef1f60f781feffdfde7d8759559d8b1fffeebdcf39d3fb003343ef75e8204d408a0276458c5862e28d89c6ae496e34628f4663ee8df16a8abf24ea35c6c4863756ec5d034893de19981918a697d3cfef8f8d62a1cd9cb5f73ee7ecf7f33cf3f03c03bc6be91cf67af72aef6257e57e76efada3a26a3f15d5b5343677fc3e088f6150949f7de02b87e2821c7a9416d1bb5b677a77eb44efae9de9d5b5133959479e918ad7e881a5920024b8fafa5af6eedda32a5c10b3909ab0982400f6d88259cc6261bc8162b118ab572d65caf1b3bff6fd70384c20e08f37bc3806f5f5b5c4149cb238dc0cc0b1cacfc9243f2793f201dd0ffb6762b118f54dad3436b7d1dceac71f3067879a5bfd5f4eabe764a5e3310c0c432737cb2c5e59989f4d7e4e62dca437a44fb1d35d1047108bc5d8b861b5ca907f0694551112872709807deec62c0c14f7b6e6baba1a76eddc4af71e7d884423848241954537c451d4d5d6c41d23cde7a57fcf1205bd39324dd328c8cda22037cbf2b6ac525294e37417c411ecdab595e6e64655e102c05daa828923933336f65903fc4d55b0b56b57d0d8588fbfad4d067f9bd5d454c51d63dcb03ea4a749719bc3d274f064427a01f985c5783d721a201105027eb66ddda832e41f912b7f6d230980bd16a1e8584b301860fdfa552a428976686ca8a3b535feeb4d8f1f3b48416f528d06860f7cb9905608de4cd00cd27c1e86f4b17eb644b4dffa752b5556c56cc39c2915369104c05edb803fa80a565db59b7d7b2b558513c7a0b24acdcbc9d4f1e52017d999741ff8b221a3d01cfc0ddfb7fedf8c1e7af87d0ec2199595bbd8bf7fafca90f76316ff11369104c07e77629e715562c386d5e6b97f61b948244c7555fcbbd10d4367e2f831905e04be1c30d2c04dd7da6abaf9dfeccb81f44248cb05239d236544b38e1bf8e5d5bfc16080a6a6069a9b1be5c8ab4382013f9b377dae326435e669296123d90468bfbdc0af81db54040b06036cdcb086a1c346ab08278ea0a262bb9201676cf900f2720e6cca33d2cc2f80680822218806219a62951c750fe85ef3ed5e6fffde87cc740f6d8d55ac58f3f9b796607272f2282deb4e59594f745dde69ecb079f33a95f5fe016e45e18b913836920038e33ee062a0b78a60d5d5bb292cea4469a94c935a251a8d28ab717eee29d30ffd1bbaf7c0e09809c4cc24201232138368d8fc5e32d03473c0d70efcf7e89eb86638defe78250bafbe9bcabdb587fcfda6a6069a363450b16b3bc3cac7909d9ddbe1b6c4d1b5b434515dadb42ec35ae0119501c5b19174d9196dc0b52a036edcb05a49753a71681515db092ab800c83074ce3d65da31fc49cd1c3cbd999096071945905e604e9b7b32cd75732d0176c66bbaf956efcd3c30a55f70606923cffc9ee18d6bf0ffd79b9f30fb82ff3cece0ff55adadcd2c5ff6218d8d5240ce4a7babf7a8be6efc2a20c5a6bc92832400ce590cbca42a582412e1f335cb5496e21407a83cea347dc208cabab4bf263e600ef846da81a420d71c6c338a20adc0dc3ce7cd064fc6c16976cd3007e88eee36d474d08d8353f79e0cb38db45cb3cd8c22730ddf976b2625469ad2a464cb8e3d7ce7cabb08b7e3986b381c62cdeaa5aaa7a7c5573434d4a90cf724f086ca80e2d8c91280b3ae0166a2e0a22080e6e646366d5cc3c041c3558413076cdaf4b9b2a34ee79d7a8292380769e6207dd42ad3b10317441d7873fbe61bdc976fe99af995009b127f7acf23b4b4b6bfbaa5dfdfc686f5ab18563ec6825e098515471b81eb550513ed273300ceda04dca332e0eedd3bd8bd7b87ca90ae565353cdde6a3535ceb33333387bee1425b1da4f33dfe835c3fcd23d5ffffae2fb9a9e10837fe5de5a162ff9b0c37f7fefde3d54554a3d192b28dc68b90839f6e72849009cf74b406921ed4d1bd7505f7ff4355371647e7f1bebd67ea62cde0fce9b4b7e6eb6b278a9ec9577fe4d2412df72d6c68d6bf0fb5b15f5487c213d43c91d111f030faa08243a4e1200e70581efa170134c341a65cdeaa5f8fd1dbf09ceed62b1289faf59a66c2dd9e7f570dd7fcc5712cb0d366c8dffed3d1c0eb1f6f3cf945cdc240e2a2cec146f8800f07d406a983b4c1280c4b00cc5453082c100ab567daab24ca7abac5fbf5ae966a70bce9c49b712b9d5ee58f9036a8a5bd5d7d7b26eed4a25b184a94b97323c9eb8eeb1b80d58a7a83b220e9200248edb31cfc32ad3dcd4c8ea554be564403b6dd9b29eca3d3b95c5d3758d9ffef05c65f1dca0305fdd0d80555515aaabd6b99ac7e3a5779f011dfdeb9f62d6411109401280c411002e38f0ab32b5b5fb58bf6e85ca90296de7ce2decd8be4969ccf34f9fc9c03edd94c64c7513460d561a6fe7ceadecd8b159694c37ebdebd0f5dba94b5f7af5500672167fe1346025412115f5185590e738ecaa0cdcd4d4422110a8be25ebb4b695bb6ac67dbd60d4a63e6e564f1c223b7939d99a1346eaaeb5a52cc237f7fb943c7000fa7aeb606348d82820ed661105fd3a9532939199e96bdfbf6f98ee18f2f03e602bb2cee966807490012cfa7c06860a0caa00d0d7568ba4e7ebe3cfcbe29168bb27edd4a2a2ab6298f7ddf8d3f60c6a451cae3a63a8fc7201a8bf1fafbcb95c6adafdb4f6b5b0bc5c55dbebc5c48744c8fb2c2b60be64fe9fddc8b6f3f0f74077af2ed59e50dc0cdc015c07e9bbb288e42fe0524a6626005d05575e0befd06d3b3673fd5619396dfdfc6e76b96d3d0a0fed8e4a8a1fdf8f7e207310c5969eb884030c498532fe7f38deaeb5ae4e515327cf838bcbe63797915df94979d113d71f2b0a997fd74d1075ff97601500e74019a31077f351768084bc80c40626ac59c32bb00c5fb34ea6a6b303c1ef2f20a55864d4a353555ac5cf1c9b76e975341d7359efdfd2df428ebac3cb65b780c8331e503f8cbd3afaaae3d4f20d04655f56e3232b2c8ca92da0ced91e633987ddce0cbaeb8f1b6e7bef15b7e6007e666e6cd80d29ac1423d490012d70e2cd80f00e6c640c3e3252faf4075e8a41008f8d9b07e155bb7acb7ec84c4a2ab2ee48233675a12db4dba9514d3d4dcc687cb951e9001201209b3b77a0f2d2d4de4171461185219fd68745d63ce94a1f75d73f35d4a2b980a67480290d83e06fa00235407aeaddd470c282870cfd9f46834caae5d5b59b37a194d4d0d96b53363d2481eb9e73a745d56d854983e6104afbeb3943dd5d62c21b7b4345359b913c330c8cece45d364c9e6704e9a3ce46f37dc72cf654ef743a8214fa8c4970ebc038cb72278d76ebd183060584a6f888a4422ecd9b3839d3bb6a8bcc8e4903a17e5f3d98b0f77fcc63f71483bf7ec65d4c997515bdf64693b5e9f8f6e5d7bd1bd479f788bdda49c13c6f77fe7e6bb7f33dde97e0875640620f185815780f301e58b954d8df5b4b536535c5c9272494063633d3b766c66fdba15ecdb5765795544c3d059fcc7db183eb88fa5edb8515e4e1683fbf5e01f2fbef3ad8b0c558a4622d4d7ef67f7ee1d8442413c5e2f6969e9d6359824268decfdd96df7fef744a7fb21d4920420393402ef010b01e5af252d2d4d3434d4515c5c826124ef472272e0e15db967171b36ae66c7f6cd3436d6db5609f1c1dbae60c129d36c69cb8d06f6e94e4e5626afbdb7ccf2b6a2d1280d0d75ecd9b393caca0a02013f86c7c0e74b4bb944f968268ee8b5c69b5b34faedb7dfb630f5124e70d72739f99d0a3c0b58b25b2933338be123c693999998bba2a3d12891489870384c381c2218f0d3d2da4c6b6b0bad2d4db60ef6df74dbb517b1e8aa0b1c69db6d7e74d36ff9c3df5e74a46d4dd3c9caca2627278f9c9c3c3232b3484b4bc7e74b43d7750cc348a93d04e386f5da306672d5d0050bfe2917f7a420490092cfa5c01fac0aeef17819563e46c58d5f47140a0669696d26e06fc31f682310f01308f8098742844241c2e110e17098582c96f0171a5d75f119fcf696cb9dee866b442251165e7d37ff78f11da7bb72589aa67d79aac0300cbc5e9ff9e5337f4d4f4b273d23938cf44cd23332f1f9d21ceef1b78d1fd663dde8c97bcb65f04f5d920024a7db31ab6b5942d334faf71f4ab7eebde38e158b45696e36dfce9b9a1a686d69a2a5a5995048cd6d6f4ebbe08c993c7aff4f65c7bfcd42e1300b7e7c27cfbff6a1d35d51c2e3f19295954376760ed939796467e792939387ae3b339b3069449fd5c3274c1eb560c10219fc53983cb5929306fc1e7336c032a5a5dd19386878bb1e42914898fafa5aeaea6aa8afaba5b9b921656f23fce1c293f99fdbaf944a7f0e0986c27ce7cabb78eed50f8efe879390aeebe4e4e493975f407e5e21f90545b69c4c9834b2f78777deffc064cb1b128e93042079e9c0ff032eb6b2919c9c3cca878f233dfdf097d9b4b43451b3af9afdfbab6968a8535eb52dd1689ac6edd77d975f5cb1d0e9aeb85e2412e5f29b1fe08f4fbee474572ca7691a797985141575a6a8a833d939b94ae3ebbac68953063df1d35bee95cd2c2e91bc5bbe450cf817d017186e5523c16080aaea0a7273f3c9c8c8fcf2fbcd4d8decdcb9850d1b56b37dfb26eaea6af0fbdbacea46c2f07a3c3cf2abebb8eae2339cee8ac01cb44e9d390180773f5ded706face7f7b7515757c3eedd3ba8aaaa201808e0f5fae23eaa98e633987bfc90dfdcb0e8573f52d4559104640620f919c0df80055636a2691a7dfa0c02625455eda6a5c5da822c89ea9aef9fc57fdd2ccfc844f4ec2bef73f10df7d1d492fa89e8376564645152da8db2b21eed4e060a7333a3274e1af8a34b7f72fb9f2cea9e4850320390fc62c062601030d4ca86eaea6aa8abab49990d7c1df1f167eb686c6e61c6a491180e6dd0128736b85f0f4e9f3d89373f5c414d5da3d3ddb155381ca2be6e3f15bbb6d1d8588fc730c8c8cc3a6acd829ea585fe93a60e9c76c9b5b72eb6a9ab22814802901aa298f5014a81310ef725e57dfcd93adefa682573a68d25273bf3e87f41d8a653513e972c98433812e5a3e56b2dad1a98a8da5a5ba8aede43556505d15894ecec1c74fddb8ffae103bb56cf183d70f0f957dcb8de816e8a04200940eaf8624f403630c9e1bea4bc9d7bf6f2b7c56f31b6bc3fbdba9538dd1df1155e8f875953463361d460defd74350d4deaaf7b4e06e17088ba5a73bf40381c223b3b17c3f0a0691ad3c6f47befa4d38b479cb2e026774d9588af910420f5bc86792ff72ca73b92ea9a5bdbf8dfe7df201a8d3175fc70d795884d74fd7a96f1c38527e3f578f8f8b3754422a9791cf568ccb2c6b5ecdebd9d6824cc9c69e50fde71ffff2c78f4d1b7ddf93f447c491280d4f4015005ccc13c2e282c128bc578e79355ac5abf95b9d3c7919ee673ba4be22bbc5e0fd3278ce09c5963d8bd691d1bf6d43bdd25c7c46231eaeb6b79ffe36583810ce0df807b37f408490052d832e053ccfb03e43a338baddfb28b675e7e9f691386d3a5b8c0e9ee88af88eddb4efeaef7993fae8c934776a5a2b695cdd5cd4e77cb4969c034e07bc07e6015e612a27019490052db16e005601e20a392c56aeb9b78ecd925f428ebcc08b91238214437be4b64c7328899b3dda5f9199c37a927a78fe9863f1c65fd9e462251d78e7d39c019c0c9c01aa0c2d9ee08bb490290faf661d6099804f470b82f292f148ef0dcab1f505d53c7ec29a3f124f1f5ca492d1420f2d962a2757b0ef9db5df2d2396d74572e99de972e79e954d6fbd9d718b0b99309a30c7336a033e6b5e3b22ce012f274728756cc44e05c5c58fcc9d0358e1bdc954be68ea4b6d1cfde7aeb77852f5dbd91d7de5bc64953c792979365797be2a058431591cf5e20166c3dea9fcd4ef730b17f313f9ad98f534777a5283b8d467f88ea06bf0d3d4d281a301eb800d8046c74b63bc20eae1b0c5c2803f81570052ef9797b3d3a437b7562ec8052668ceac58963fb50946bde65d0e20ff1c3dfbcc4136facb1a52fc505793cf1dbffe4c4e3a53c831da23b5710d9b19c780b0054d4b6f2fa9a6a3ed8b88f4fb6ec674365a3db6a0afc05b81a7067c94f9770c580e062a381c781214e7744a5ac742f3eaf41516e062505d9f42ecda747e75c7a74ce6344dfce8ce8db85749fe788311e5abc8c6b1f5a42306cfd6da7baae71cbd517f28b2bce976b83ad128b1059f52ad1864a4bc2d7b78658b7bb81757b1ad950d9c8f67d2d5437f8a96af053d712a4b12d948a7b09b600e7039f38dd11610d791aa5260db81ef82560fdfda11da46b1abd4bf3e9539a4faf927c7a95e451569443715e0645b99914e566e0317472337d18ba8ed7a3939da1ee98dd27eb7673ce6dcfb26b9f3db550e69d309ec77ff3330af3736c69cf35da1a08af7ce998a6fcadf645221089c668f287084762ec6f0eb2bf29c0fee6007beadbd8beaf851d352d6cdbd7c2f67d2d44137b6a210cdc02dc8d9c1448399200a49e6ce0cfc0394e77e4ab744d6368af4e4c29efcee8fe258ce8db99213d3b9195ee6c7e52d3d0cac2bb9e67c9b26db6b4d7ab5b179e7e681163cafbdbd25eaa8b556f24b2e90362d1e4ac69d31208b3767723ab77d5b37c7b2d1f6eac61edeec6444c0a5e002e021a9cee8850471280d4d20f780e18e674470006762f62eef8be9c38b60f938775233733cde92e1d52241ae3b6c7dee5ceff7ddf9675def4341f0fdc7a393ff8ce3ceb1b4b61b16d4b09ef5ae97437946b680bf1e1c61a5e5f53c52bab2ad9549530cbf09b80b3308f0c8a14200940ea98073c01e43bd5014d837103cb58307d08674e19489f52c7bad2212f7ebc998bee7981da267bae93bd78fe893c74c79564a42766626487cf37eee0a97fbdcdca755ba9dc5b4b415e3683fbf560f694d1cc9d3efed07b26a261629b3f245cbd39eecd7ec960ebde669e5f56c1d39fec62e9b65aa7bbd30c7c0778d1e98e88f84902901a7e003c8c43c73a7b97e473c9bc919c3f7318bd4af29ce88232dbaaea997feb332cdf54654b7b2387f4e5e9876ea66fcf325bda4b141555355cb1e841162ff9f0b07f6640ef6e3c7ce755cc9834f2e037fd4db0f903220d7b89464236f434b16cdfd7c2131f6ee7afef6e63478d63971c4580ab80879cea8050431280e4772be6261d5be99ac6195306f2c35346316b4c6ff414ba08c71f0c73e5ef5ee5919756d8d25e7e6e368fdeff134e9b35d196f69cf67f6f7ccc45d7dd4b7de3d1cbf1eabac6af6ffc21d75e7216d4ee826dff86689890bfd9156fff87138dc5787d4d357f7c6b33ff5abec7a93d03f7033fc5bc8e5c2421290494bc0ce0f798bbfd6d939de14955c174000018b649444154e3d25346f1c44d67f0a35347d3b7ac20e56ec1f3183aa74d1a40cf2e79bcb66c2b618b6f91f307823cf5af770804434c9f3022658f0a4622516efecd5ff9f1a207f1078eadd85c2c06afbdb78cbe3961867bab0f94f48d110db9bb589da669f4ed92cd82e37a70dec49e4463b06e7723217b6f3c9c04f402fe0f3921909452f34993fabcc053c09976359895eee58a33c6f29373277e5954c70d3edb5cc5fc5b9f616ba53db7c8cd983492271fb891ce45c9b57fe268f6d53670de55bfe48d0f3eebd0df2fc84a63dd7fcfa74b5e06c462e60c80f89a9aa600f7bfb49e875fdf446bd0fafa165ff13466bd0077676549486600928f17f83be66e5ccbf93c06579c318ea76f3d9bd3270f24332d61cb0a58a2b4309b8b660fe7f3ed356cacb07e03d6b65d55fcfd85b798387a30dd4b3b59de9e1d3e5abe9659e7ff8c95ebb67638863f1421dde761c6b032d034622e5cff3f9acc340fb3869570f1b43e04c35156eca8b76b69600866d1b16731eb06882421094072f1605eec33df8ec64e9dd89fe7ef3887f3670d232bddbdf7dc67a479386fc6507c5e837756eeb07ce9b9b1b995c79f7b9dfcdc2c8e1b39c8dac62cf6bb479f67e1d57753770cebfd475351dbc2d5f3cc13aeb16884584c969e0f253bddc39ce1a59c33be07dbf635db75f5f1006004e66c80fc6092842c01240f03b3acef795637d4bb249f87af99cb49e3e44adb6f7a7df93616def53cfbeaeda93af79d53a7f3a77bae253b33b9965d9a5bdbb8f4e7ffcd932fbca5346edd5f2e223fcb472c1625ec776c177c5279796525573db6ccae53034f612e07d8ba06213a46660092c7239895b82c63e81ad79c7d1c4fdf7a36837b145bd954d2ea535ac0793386f2d1dadd54ecb3be40cb9a8ddb59bce423664e1a457161721cb15cbf6517b32ffc4fdefa48fd298a8ba7f7a73837fdcb8da7b1a88c3347d3bf2487ef4feb436b30c2b26db556cf600d03ba63560e14094e1280e4b008b8ceca06fa9615f0afbbcee5927923f17ae4637124b959695c746239f5f54d7cbab1daf2f6f6d536f0d8334be8d7ab2b43fbf7b4bcbd78fcf3a57739f5929bd95d556349fc1b4e2b273fcb2c9ca41be6854f92041c9dcfa373d2f052660eedc2dbebf652df6ae91e8a5198cb956f5ad988889f3ce913df79c0efb070b9e6c2d9e5bc70e702fa961558d544728b619e478b45211a814000a3ad9979c34b195896c72b2b2a2c3f7e150c85f9e74bef52b9773f274d1d8b61e896b6d75ee170841beffb0bd7def17b02416b06979c0c2fbf3c6fdcd76a4ee88607ddf07ee35f8786ac6e1e5af7a24c2e9eda87dae620cbb7d759d9d454a01a586a6523223ef2af24b1cd005e062cd9819795eee54fd79fcc7933865a113eb1c5806818221173508f44201a3d30c87fe5d763f0f9ae3acebeff7536ecb1e79e94296387f1d4833751d6a5c896f68e664ff57ecebde22ede5f6a6d89f8d3c6f664f14f6777e06fc688c56210fbe2d7e8d77e75eb0cc2131f6ce7c77f5d6ae591c1107032b0c4aa06447c2401485cfd817f03962cfcf6eb5ac0b3b7cda7bc77672bc22796580cc2a1035f618884cc015fa1a6b610df7ff85d9efed89e5b054b3a15f2e4033f67fa8411b6b47738ef7cb28aef5cf94baaf6597f44f2d59be672e288ae96c48ec5a2c4a25162b18879c22062161c4a752b77d6b3e0810fd8b6cfb29302f5c03860b3550d888e932580c494899935f7b022f8acd1bd5972df427a76498e4d65ed168b4128088136686d81962608f8cdef45c29694904df31a9c33a10fb9995ede5c5369f9f9ebe6d6369e78fe4d32d2d398347a88edd51863b118bffed3d37cf7fafb686cb6fe44c459c7f5e2c633471efd0f7690a66968ba8eae9b4b0a86d78b6e78d074ddbce52a45938192bc742e98dc8ba55b6bd96ecd298174e004e031cc190191402401484c8f00275a11f87b7346f0f75f9c49567a8a15f48946cc41beb5195a1a21e837dff86dbc275ed360e2802e9c30b494575656d0ecb7f679178dc558f2fe7256aedbcadce9e3484fb3a7564343530b0bafbe9bdffdf5795b0acd8ce859c8d3d7cd2233cd63795b0769689a8ea61b6642e0f1a1eb1e73ce34c5ee20c8f0199c3ba1273bf7b7b26a9725152fbb00bd8167ac082e3a4e1280c47329f00b2b02dffadda9fcd7e5b33152a5d6fc97837e13b4349b6ff809b09edbb35336e71fdf8fa55b6ad861ddd4ea97d66fd9c5332fbfcfb409c3e9526ced46ced51bb631ebfc9ff1c1b2cf2d6de70b530797f0f28d7328ca71feca644dd7cd4d871edfc1130829920c18bac669a3bb118dc6786fc33e2b9a28076a3097354582900420b18cc2aca4a5f45547d3e0fecb66f1f3f326a90ceb9c50d07cd36f6d8460d0d6b7fc63959deee582e3fbe10f45f8c886a382b5f54d3cf6ec127a947566c4606b0a383dfedceb9c71e9ad54d758ba7b1c303fb3d79f5acee3574c4fc8d92a4d339301c3eb4337ccc768b25726d434983ea40b59e91edef8dc92cfec09c0f380251986683f490012471ae68e7fa517c3eb9ac6c3d7cce5ca33c6a90c6bbf5814fc6dd0526ffe1a49fc92e3baae317b7857ca7b14f2ca8a5d04c2d60e10a17084e75efd80bdfbeb993565341e43cd3fef4030c455b73ec44df7fd8550d8fa1996dc0c2f4f5c7502d7cc1b961437239ac98017dd63262ab1044c48db6362ff623ae7a6f3caaa4ad5a1bdc064e02f48a5c084200940e2b80bc517fc681a3c78e51c2e3b6d8ccab0f68a46a0ad159a1b211448caf5d7c1ddf2397b426fde595bc5de8636cbdb5bba6a23afbdb78c93a68e252f272bae583bf7ec65dec537b178c9878a7a7764c3ba17f0faa2791c3fa8c496f654d234cd9c15f0f8d0d00e7c5693eff30a30b67721c5d96956240125989b9c5f531d58b49f2400896122e6c63fa5d55deef9c10cae9d3f5e6548fb44a3d0d67c60e00f92ac0fd22f14e5a4f3bd13065059d7ca67dbf75bdedeeeeafd3cfedceb0c1fd49b7ebd3a7674eead8f5632e7bb37b2715b85e2de1ddac2297d59fcb31329cdcfb4a53dcb681a9a61a07b7c689a4e2c969c2fbbe3fa149197e9e3b5d555aa431f07bc01ec521d58b48f2400cecb045e0194defd7ae3c2c92cbae8789521ed118b425b0b343598bbf85388c7d0397d5c4f3ae7a6f3c69a3d44a2d626356dfe004fbef0169aa671fcb8f2633e2a188dc6b8e3774f70c9cfeea7b9c5fa190b9f47e7b7df9bc83de78fc7e749ac0a87f1d274c39c11d0b4a45c1a38ae5f11fe50940f37292dedac6126018f204b018e9204c079b70167a80c78eef4213c74f55c6c3e1a1ebf409b39f087824ef7c452e3fa7562eea8ee2c59b59bfa166bff5b633178fbe395fc7bd506e64e1f4f46fa9177d33734b570fe3577f3f0fffecb96d5966e4559bcf8f3399c755c2feb1b73909908788158d2250233867461ebde6656ef525ae9b233e6e0ff8ecaa0a27d926d884835fd8035981b0095983abc07afddbb90346f12e576e120343725c5c63e956a9afc9cffc05bbcb672b72dedf5ead685a71f5ac498f2fe87fcfd65ab3731fff2dbd95e61fda90580d9c3bbf2b7ab4fa03827dd96f612452c162512f4275509627f28c2dc7bdfe6838d4a670202c07060a3caa0e2d825d12891921e0586a80ad6bd532e6ffcfa7c72b39c3f337d4c62b10367f89bcca97f97c94cf370c1f1fdc9483378734da5e5bb1cea1b5b78f49925e464673261d4e0affdde63cf2ee1eccb6ea7a6d6fafb0c340d7e76fa08fe7cf954b213f0889fd5344d43f778cdfd01d1e4487a3d86cebc91653cf5c92e9ada942dcd79300b043da92aa0681f49009c73227087aa60695e83577e751efdbb15aa0a69ad50001aeb20945aebfceda56930655009e3fa75e2951515b45977310b0091489457de59ca961d7b98336d1c916894cb7ef1008b7ef328619b8ef83d79f50cae9c3bf46bb7fab991a69b1b05635f5c3e95e0b2d23c4cea5fcc131f6c57b97f6500f00972578023dcfd2fd0395ee073cc0b7f94f8c3b5f3b8f49451aac2592716338bf8f8adaf1f9f6cb6ed6d62fefd6fb07c9bd269d6c31a39a42f002bd66eb1a5bdd1bd8b79fafa99f4ee9c634b7bc9241a0e110927c731d7875fdfc4d58f2f5719722d3012b92bc0763203e08c1f00df5515eccc2903b9f787335585b34e38044df5e6dbbff89682ac34be3bbd3fd50d6d2cdf66fd51c1aa7d7554edb3beaa1fc0253306f2cc0db3e894ebaef5fe6365de39e021168990e8475ec7f529e2b31df56cac6a5215b21350012c5315501c1b9901b09f0fd800f45211acac2887558ffc80a2dc0c15e1ac13f0434b43a23fdb12c6e3ef6ee6477f7a9fd64072ac111f4ebad7e0b7df9bc8a5b30639dd95a41109fa894612fb65b8a629c0985fbc4a65bdb263a2bb306744e5edc046320360bfcb81f35405fbc72d6731bc4f6755e1acd1da644efb8b6336a26721278f368f0ad6597c54d02a7dbae4f0ea4d7339658c25b75aa72cddf024fc06c1cc340f83ca72f9fb473b5485cc03aa814f55051447270980bd32807f024a16412f3ab19c9f2c98a8229435a25173a35f5092fa8e28c9cfe4bbd306b0b6a28e8d95d6efce57e994313d78f9c639b2dedf41e692804134818f0af62fc9615375336b2a947d3647020f03899bf9a4184900ec7505305f45a0cef959bc70e70232d312f4185524024d75ae3bdbaf5abacfe03b93fbe2f3eabcb3b632e1f78819bac61de78ee5a1ff984c864fe9a596aea3693abaee39502f20317ff0530676e2b1f7b6d1aae6f44a0ee65e80a52a8289a39304c03e06f004a0e4c2f687ae9ecbc4211dabf16eb970c87cf34fb28a67894ad3e0f8c1254c1e58c2cb2b7625ecbe804eb9e93cf793d95c3c7d40f255a14c505fd40c8845c3097942202bcd4351761afff799b2625603808748d48c27c5a456e1edc4761a66d18bb88d1950ca05b387a908a55e28680efe4970ae39d9cc2c2fe3b37bcf64d2c02e4e77e55bc6f62de6d3bb4f6756798226a5494dc3939685a627e6fbda45c7f7626c6f65f54706603e2b850d12f313959a1e46c1ce7f4d83a76f9d4f8fceb9f1f748b550001a1b90e4dd3ab9193e2e9cda9f86d6209f6edee7747700b862ce109eba7626452e2be96b37ddf02464d1204dd3185496c763ef6f5315b22bf01755c1c4e14902608f11c03d2a029d336d30d7cd3f4e4528b582016896c1df0e86ae317754770696e5f1eacadd04c3ce0c0859691efefae369fcecf41118baccf95bee8be58058e225013d8a3259b5b3810d958d2ac2f5049e01f6aa08260e4f12007bdc098c8e3788a16bfce396b3e8949760f7a58742d05c9f906b94a9acbc4721a78fedc99b9f5752d3e4b7b5ed8165792cb9791e33cbcb6c6d571c9809884512eedfdb90ae79fce9ad2daa5e014298d7a40b0bc91e00eba5a368e7ff79338632b847b18a50ea8443e66eff047b18b9c5d0ee05fcfbeed35930b18f6d6d9e36b6271fdf753a43bb2bd9cf2ada4dc3e3cb4cb83d01c3bae571f6f8eeaac25d80f9ec14164aac4f506a3a1bf3c31c175dd3786ad1591427d2db7f247260c39f0cfe4ef2790ce64fe84d5e968f37d7ec216ad1cfc363e8dc77e1787e7bf144327cf2e8709a593a384c222dbb0d29cbe30f6f2ab9d72713f38e80352a828943931900eb5da822c8a993fa33b07b918a506ac4a2b2db3f81681a5c7bf230debc651e6505ea93c4ce7919bc72e31cae3ba55c8ef8250a4dc3f06592483f90c15d73993b5cd9b2d0425581c4a1490260ad4e98d7fec62db136fec5ccddfe095ca5ccada60c2a61c57d67293d8e77fce01256dc7ba6acf727204dd7f0f8d2132a09b866ee4055a14e0292e47ef3e4240980b5cec5bcfa372ea3fa9530757802d5536f6e847072d6a777834eb9e9bc7ce349fce4b4e1718d0b9a06379c5ace9b8be6516ac1ac825043d33d189e34a7bbf1a5e9833b33a247be8a505ee0741581c4a1490260ad535504b9f494512ac2a8e16f336ff61309cd63e8dc7bc1789eb97e16b919edcf417333bc3c7ddd2ceebbf0383c863c26129deef1a21b3ea7bbf1a54ba6f755156a81aa40e2db1267de28f56401fb81b852f3ac742f7bfe7935b9990990e18743d050eb742f443b6daa6c60fe6fde60d58e63fbd90dea9acf33d7cf624837256f71c22eb118e160ab592cc8610d6d217a5eb558c51d0141a018688abf57e29b24b5b7ce2ce21cfc01164c1f9218837f2c0a4dc975239d30f52fcde3e3bb4ee38653cbf11ee16ddee7d1b9e1d47296dd73860cfec948d3307c194ef70280bc0c2f678d537224d0079ca02290f83639cb639deb8031f106b9f7d299f42d4b80f3d6cd8de60c80484a5e43e7c411ddb864e6403ae7a593e63548f77ae89297c1b8bec5fcc78c41fcf9f2a99c7d5c6fbc1e792f48569aa6a1e9fa81e381ce4af7193cf9e10e15a11a80175504125f274b00d6d905748b2740a7fc4cf6fce36ae7d7600301b3d29f10222944826d441d4e024291283dae5accfee6b8370c6f47d1456ae2eb24d5b7463fe21cfc01ce9a32c8f9c13f1a855699fa17229918de749c7ebff31a3a678c8dfb3108e6256af695ba74114900ac31594590d3270f5011263e2d4d104d9c4a63428863a069183ee7f70e9d324a593d0a25cf54f1759200586362bc01d27d1ea68d70f8ec7f30004139f2274432d20d2f9ae171b40fd30777264dcd9e1249002c20098035e24e00a68fe849665adc35843a2e1633dffe851049cbf0a6e1e45240569a8729033ba908250980052401502f17181a6f90d9631ddef3e26f9152bf4224394dd3d13d0ebe4800338796a8083304c85111481c2409807aa35170bc72f250259b673a261a85b656e7da17422863787c680ede15307980922bcc7560988a40e2204900d41b1c6f808c340fa3fa2bc99a3ba6b559aef8152255681abad7b90d81a37b1792ee55527266b88a20e2204900d41b146f80b1034af1791caad1140943a0cd99b6851096d00d2f9aeecc3325cda333ba97926266e52a8288832401502fee190047dffedb9a9d6b5b086119dde3dc6541a3d42400b204a0982400eac59d000cefd359453fda2f1c32abfe0921528e6e78d074671ef9c3d4dc2da1ec8a4161920440ad6c20eeca17e5bd1d4a0064e39f1029cda9598061ddf354842943c1056be2204900d4ea868243b7837b28d935db3e91a814fd1122c5e986174db3ffb13fa82c5745181de8a92290304902a05669bc018af332c9c974204bf7b7d8dfa610c2764ed405c8cbf05298a5e4b9260980429200a815f7eebd5e254aa6cada27168380bcfd0be1064e2d03f4ea94a5228cb2cb05842400aac59f007451b259a67d027e8845ed6f5708e108ddb03f09e859ac240170607d34754902a05659bc014a8bb255f4a37d02b2f94f0837716219a0243f43459822154184491200b5e2ce4e0b73d255f4e3d845c2100edbdba610c2519aaedb5e18a8285bc9ac83cc00282409805a718fdec579992afa71ecfc52f54f0837d26dbe2ab8285bc909be42154184491200b5e24e000aec9e01084ae11f21dc4837ec5d062850730ac0e607646a930440adb83f9c696a2ecd3836e1a05cf92b845b699aadcb00691e25c38d73f58c539024006ac59d00d87a09901cfd13c2d5ec5c0648f32a196ea412a0429200a8157f0260e70c4030685f5b428884a3d9b80ce0951980842309805a71a7d3865d977544c232fd2f84cb699a665b69608f9a679bbd3b17539c24006e256fff42084033ec3d0e28128724006e1592ddff4208d075fb8b0289c42009801bc58050c8e95e08211280390310f725a622094902e04691106616208410666540e13ef25377a3b0bcfd0b210eb2bb2cb0480c9200b8514836000a210e92190077929fba1b45e4f89f10e220990170274900dc268659034008210ed034d904e8469200b84d44d6ff8510df64efbd0022314802e03632fd2f843804bb2a028ac4213f71b791e97f21c4a1c83280eb4802e036d1a8d33d104224203909e03ef213779ba8cc000821be4d9600dc477ee26e1391190021c4a1c870e036f213779b98240042886fd374d903e0369200b84d4cee00104208210980bb44e508a010e208e42480ab4802e026f2f62f8438024dae0576154900dc44c67f21c491c80c80ab4802e0263203208410e20049005c4512002184102649008410421c204b006e220980104288036496d04d2401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2852401104208215c481200218410c2853c4e7720c544e20d100eb18b98d1aaa233df6264b651985369496c2144d2d39b6b4b098732ac881df5b66602dde30c1356d11721acb01888c5f935c8f65e0b2184f50613fff3f179db7b9dc2640940ad3571fefd1660bb827e082144a2d986f98c8b47bccf58212c339ef8b2dba7edefb21042d8e619e27b468eb3bfcb421cbbd7e9d8073b0a4c70a0bf420861977198cfba8e3c23df74a0bf42b4cb50a091f67fb87fe744678510c266ff43fb9f8f8d987b08844878f330d7ba8ef5c3bd18f03ad2532184b097177881637f3eb600731de9a9101d341a58c9913fd8adc0adc8664c2184bb18c06d401b477e46ae044639d44721e2a203e7004f015b013fb017f8185844fc676285102299f5006e013ec17c36fa319f954f01f39197234bfd7f32e5fd8e59d56fc10000000049454e44ae426082	0999999999	Sanjapamba	t	F	2025-10-03 00:00:00	0	\N	f	2025-11-15 11:37:16.687015	4	\N	\N	\N	\N	\N	\N
3	lector	$2b$12$tcQF4hUDeClgJES9./M3w.rxWH6env2mrLMlw5HBjGpTPj83a/Q.C	Juan Jose	Ushca Saca	0685854585	juan@gamil.com	2025-10-21 21:55:28.835417	\\x89504e470d0a1a0a0000000d4948445200000200000002000806000000f478d4fa0000000473424954080808087c086488000000097048597300000ec400000ec401952b0e1b0000001974455874536f667477617265007777772e696e6b73636170652e6f72679bee3c1a0000200049444154789cecdd799854d59dfff1f7a9ea0d68a077e86e9abd51c17d0137165134266aa29364b22f1393986526c66c93cccc2f99cc923d9add244e268999c93ad9344edc50c005dc50082eecd0d0ddf44eb3f656dfdf1f17276880aeaebe55e756d5e7f53cfda058f7dc8f58d6f9d639e79e03222222222222222222222222222222222222222222222222222222222222221215ce77001119de8e1e2b2f1c6412096a8851658e3207652428738e328332a014188f310647093001a30047d9cb9a9b08c45ef67b0960ef4b7ec7e8c13100ecc3388ce310b0efc84f8f193d2e468f418f337a48d0418cf6be38ad33ca5d4f3afe1c44243c2a00443cdab6cd4a0ac631a5c03105c7548306600a8e068cc9c024a00628f29b74c4fa8076a0d5a0d5c12e829f9dced8194bb0abb7975d8d8daecf6f4c91fca5024024cd9a9a6c8c2be6a4789cd90963963366e3980dcc02a690bfff1f1a4151b019c76633b638c7e6c4209bad9f8d0d0dee90ef8022b92c5f3f784442d7d46463e225ccc531d7c13c60aec15c60067f39e42e279600b639d860f02cb001e3d9befd3c3b63863bec3b9c482e5001209282ce4e9bd0e7381de31c602e09e6e1381728f69d2dc70d021b810d663c0b3ce98a79b46e82ebf09c4b24eba8001019869915b6747086732c305840f033c7772ef93f465014ac71b0c68c35b5553ce39c1bf41d4c24ca540088bc4c57974dec1be2621c8bccb808c7d9c018dfb964440e613ce91c0f936065519c872a2b5dafef502251a20240f25ed35eab880fb018580c2c024e07e27e5349c88680a7315699e3c1c102564e2b73ddbe4389f8a40240f28e9915b4747086392e73701941c75fe83b9764540258ebe0be04dc77b09b557a2451f28d0a00c90b2ddd363d31c455ce7125c662609cef4c1229fb71ac70c65d16e70f75e56e87ef4022e9a60240729299c55a3a38cbe06ae7b80a381bbddf25598ead18771adc5157c9835a5028b9481f889233366db2e2d2895c6a8eeb8057e3a8f29d4972423bc6ef5c9c5f779573ff3ce7fa7d071209830a00c96adbb659495129cb9ce375c03504fbdc8ba44b0f70af833be3097e5d53e3f6fb0e24922a15009275cc2cdedcc9250ede06bc0618ef3b93e4a543c09d66dc5e57c51f9d7303be03898c840a00c91acded760e8eb7017f4d70488e485474017f30f8715d25f73be7cc772091e1a80090486beeb6692ec1db0dde8e31d3771e91246c017e688e1fd557ba26df61448e47058044ceb66d56523281ab13c6db1c5c8936e591ec94c07814f8716c88ff9a3cd91df01d48e4682a0024325abbecd4a1043738780b5acc27b9a5c7c1ed386eadad74cffa0e23022a00c4b30d6645155dbcda8cf70097a2f7a4e4be2731be377498db1b1adc21df61247fe9c356bcd8d96e75058e0f02ef026a7ce711f1a00db86dd0f8d6d46ad7ec3b8ce41f150092514d5d767adcf800c6db8012df794422a01ff8792cc6972657b8f5bec348fe50012019d1dc65175b824f3878157adf891c9bf1b0c117eaaab8538f124abae98358d2e6a8f9fd8f01e7f9ce23922d9cb1cee05b7dfbf9f18c19eeb0ef3c929b540048e83a3b6d421fbc13e3234083ef3c2259acd58cef268af87ac344d7e53b8ce4161500129ab6369b3ce8f8048eeb8152df794472c83e8cefc7137c71d224b7c77718c90d2a0064d476f55aa5ebe36f9de326b42fbf483a1d046e8b0ff1ef2a0464b4540048cadadb6d7cbfe3fd0e3e8936ee11c9a4fd0ebed55fc017a695b96edf61243ba90090116b6bb3d281181f70f0f74099ef3c22796c9f836f17c7f85c4585dbeb3b8c6417150092b4d6561b9728e47a8c4fa2d3f844a2a4d38c6f96c4f86a65a5ebf51d46b2830a00195653938d898fe5068cbf47bbf68944d91e1c9fefebe5563d3e28c351012027b4bbddae76f0351c337c671191a4ed72f00f932bb95d1b0ac9f1a80090636a6eb7b389710bc642df594424656b628e1b2757bad5be8348f4a800909768eeb52afaf927e00340dc771e1119b504f05f05093e5e53e35a7d8791e8500120009859614b17efc7f82c30c1771e1109dd0133be7cb087cf3536ba3edf61c43f150012ccf33b6e0666f9ce2222e9e560338e4fd556ba5fface227ea900c863ad5d76da50825b1c2cf59d454432ee5ee7f8706da5dbe03b88f8a102200f6ddb662545a5fcbd737c1228f29d4744bc1974f095c3fbf88c1e1bcc3f2a00f24c739b2d24c6f780937d671191c8d81283f74cae72cb7d0791cc51019027baba6ce2e1049f053e08c47ce71191c831e0274385dca8a387f3830a803c706491dfb78129beb38848e4b53ac7dfd656ba5ff90e22e9a5022087b5b5d9e4c118df005eeb3b8b886417833bcdf1be29956e97ef2c921e1a0ace4166e65a3aec6d833136a0ce5f4452e0e0aa98f1a7e64efb9099a9afc8411a01c831cddd368d217e082cf11c45447284c1721cefa8af744dbeb3487854d5e590964e7b2d433c853a7f11099183a5ce58dfdc6e6ff69d45c2a311801cd0d96913fae04b18eff19d454472de2ffbe2bc6746b9ebf11d4446470540966bedb005063f3198ed3b8b88e48dedc4786b5d857bc87710499da600b2949915eceeb04f2460953a7f11c9b0e92478a0a5c33e6f6685bec3486a340290855aba6dba0d723b8e8b7d671191bcb76628c15b1a6adc66df416464340290655a3aed7536c45a75fe2212110be2319e6c6e37ad41ca321a01c812adad362e51c8f731dee83b8b88c871dc4e3f37d4d5b983be83c8f054006481a6369b1d8ff16be034df5944444ec419eb6209ae9b34c96df19d454e4c530011d7d26eaf8ac7780c75fe229205cc71fa509ca79a3bec35beb3c889a90088283373bb3bec13e6f83d50ee3b8f88c8084c007e7de42901f53311a5298008eaecb4097dc68f8157fbce2222322a8ebb06e2bc655a99ebf61d455e4a0540c4ecda6367c40af835c64cdf594444c2e060f3608cbf6aa870eb7c67913fd3d04c8434b7db9b63711e51e72f22b9c460763cc19a960e7b87ef2cf2672a0022c0cc0a5a3aec1b387e028cf59d4744240d4a0cfeb3b9dd6e36b3b8ef30a22900efdadaac7430cecf305ee53b8b884886dc53ec785d65a5ebf51d249fa900f06867bbd51538ee00cef69d454424939cb12e11e3aafa4ad7e43b4bbe5201e0496b979d9648702730d5771611111f1c3427125c555fe3d6face928fb406c083dd9db62c916015eafc45248f19d4b9182b5bdaec95beb3e423150019b6bbd3fec6197f0026face22221201a516e377cded7683ef20f9460540869899dbdd6e9f71c67f003a3f5b44e4cf0a707ca7b9c3bea69d0333476b003260d3262b1e57ce0f8037f9ce22221271bf1a3ac4db1a1adc21df41729d0a8034dbd66d65c583dc89e322df594444b282636589e39a8a0ab7d777945ca602208d9af65a457c80ff05e6fbce222292659ea2882bea26b80edf4172950a8034696bb3c98331ee41c7f88a88a4eab941e3b2a9d5aed977905ca402200d9abb6c2a09ee031a7d671111c96ac6b67882cb264d725b7d47c9355a6d19b2d61e9bc1100fa2ce5f4464f41c3386e23cd0d466fa4c0d99460042d4dc61a738b8cfa0ce771611911cb3271663d9e40ab7de77905ca111809034b7dbd9182bd5f98b88a4c5a44482152d1da645d52151011082960e3b0fc7bd38aa7c671111c961e506f7ecee323d561d024d018c526b872d4dc0ef8171beb348feea1b84f603477ef643d721d8d707fbfb61ff915ffb87e0607ff0fac144700d40511c0a8f9cce3ea6104a0aa0b408c6154369314c2c868ab1503d16aac6417569708d8847079c71756db57bc077906ca60260147675da0531e31ea0d47716c90ffd43b06b2f3475c3cedee0d75d7ba1b72fb339cac640c344985a06f513a1a12cf8fb028d294ae61c24c12bea6adc2adf41b2950a8014ed6ab33363319603e5beb348eeea39042fb4c3a64ed8d4013bba836fef51541883199530a7121aaba0b11a2614fb4e25396e2fc66575d5ee09df41b2910a8014b476d9a989040f0295beb3486e1948c0c63658bf0736b4c2b66edf8946a77e229c5507a74d82936a344220696074b8184b6a2bdd06df51b28d0a80116a6ab3d9f1182b815adf5924371cec872776c3e33b61435b30cc9f8bc614c0197530bf01ceacd33a0209559b198beaabdd0bbe836413150023b0bbd31a9cb11298ee3b8b64b7c383f0d46e787407ac6f8deeb07eba14c5e1ac7a387f2a9c5d0b711503327a4d2ecea2da72b7dd77906ca10220497bf6d8a4a1382b80937c6791ecb56b2f3cb41d1ed80a0732bc702faac615c18206b8b411a695f94e23d9ccc1e602635175b56bf19d251ba800484273af55d1cf83c03cdf5924fbf40f059dfef2cdb03dcbe7f4d36d76255c3e279826d07a0149d19f12452c9932c175fa0e12752a0086d1d565130f27b81f38c77716c92ebd7db0722bfc7163b09a5f925756024b67c3e58dc15e042223e2787a20ced269654e25f709a80038816ddbaca4b894fb7068d729495ac701f8fdb3b06a5bb0aa5f5257140f0a81ab4e098a0291a439561ee8e2f2c646a7c9b6e35001701c66e65a3ab91d78b3ef2c921d7afbe0aee7e1ee17d4f187ad20068b66c075a7069b108924c38c5fd455f106e79cf9ce12452a008ea3a5c33e6ff009df3924fa0ef4c16f9f85fb36a9e34fb7a2385c3107ae991b6c5b2c92847fadab72ffe43b4414a9003886dd9df62e67dce63b8744db5002566c835fadcbfc56bcf9aeb418ae9d0bcbe6404c9f62321ce37d75d5ee56df31a246ffebbc4c73a7bd02e30ea0c0771689aef5adf093b5b07bafef24f9ada10cde7a36ccadf19d44226e00c7557595ee1edf41a24405c0518e6cf1fb1030d1771689a6de3ef8efb5c1637d121d0ba6c23bce81f17a62408e6f5f6288855326b9677c07890a150047ec6cb7ba02c76aa0c1771689a6353be1874f06c7ec4af48c2b86bf3e1d96cef29d44226c77c271fe944ab7cb779028500100b4b7dbf881182b31cef49d45a2a7fb107cff3158a7bdc5b2c2597570fd7c98a8c706e5d89e2a48b0b8a6c6edf71dc4b7bc2f00cc2cdedac96f0caef69d45a2e7895d70dbe3b05fdffab3ca846278d77c38a7de77128924e37f6babb8c63937e83b8a4f795f00b474d8370c3ee83b8744cbe141b87d2dacd8e23b898cc6d259f096b375f2a01c83714b5db5fbb0ef183ee57501d0dc6e6fc6f113df39245a9a7be19687825f25fb3594c18d17c1a4f1be9348d43878476d95fb91ef1cbee46d01d0d465a7c7133c0a8cf59d45a2e3a9dd70eb6a3838e03b8984694c01bc7b4170c890c8510e59828bea6bdc5adf417cc8cb0260478f95170ef238a0f5c20240c2e017ebe00fcf81f60ccd4d0eb87a2ebcee347079f9c927c7e260f3e138e7cd28773dbeb3645ade1db86966b1c201fe0b75fe7244df20dcbc0aee54e79fd38ce090a65b1e0e8e68160130985d34c4ed669677fd61defd0bb774f2cf38aef49d43a2a1fb30fcebfdb0b6d97712c9942777c167ee85ae83be93485438b8aab58b7ff09d23d3f26a206c77bb5ded1cbf250f0b1ff94b4d7be1cb2ba1f380ef24e243d538f8e82298a27d3f25907009aeaead7177f90e922979530034b559633cc6634099ef2ce2dfd62ef8e20a3ddf9fefc6150545406395ef241211ddf121ce9b34c9e5c503c0795100b4b6dab84401ab81537d6711ff9e6f87afac84435ae92f4049017c7821cc9be43b89448133d6d90017d4d5b99c9f24ca8ba1f04421df479dbf106ce7fbc507d5f9cb9f1d1e0c0a426df52c00e6389d22beed3b4726e47c01d0d261efc078a3ef1ce2dfba16f8ea2aad0097bfd43f14bc37d6b7fa4e2211f1f6e6767b93ef10e996d353007bf6d8cca1386b8109beb3885f1bdbe10b2b8247fe448ea7280e1f5b02a754fb4e2211b0d7c539b3b6dc6df71d245d727604c0cc0a12717e823affbcb7b913bea4ce5f92d03f045f5d192c1295bc37d106f98999e5ec4912395b003477f04f0617f8ce217e35ed0d3aff43eafc2549870682274476eff59d44bc735cd4d2c9277dc748979c9c02d8dd6517b9042b809caddc6478dd87e19fef850e3de72f29a81e079f5e066525be9388678331c7c2c9956eb5ef2061cbb91180b6362b8d25f821eafcf35aff10dcb24a9dbfa4aefd007c455347020509f8aff676cbb9f32473ae00188cf11d83d9be73883f09836f3c0c5b3a7d27916cb7ad1bbeb31a4c8744e43763e6a0e316df31c2965305404ba7bd16788bef1ce2d72fd6696f7f09cf13bbe097eb7da710df0cfe6677a7fdb5ef1c61ca99026057a74d31e37bbe73885f4fee0e8ef41509d31dcfc2e3bb7ca710df9c716b73974df59d232c39510098998b19b703e5beb3883f2dfbe0d6d53ad257c267c0f7564373afef24e259994bf00333cb8905f4395100b474f01e6089ef1ce2cfe141b87995b6f895f4393408df78443b49e63b834b9bbb7887ef1c61c8fa02a0bddd6a717cce770ef1ebf6b5fa7626e9d7d4033f5deb3b85f8e68c9b77b65b9def1ca395f505c080e35b68e83faf3db10b56e4c5e19d1205f76dd6225361621c6ef61d62b4b2ba0068eeb4bf02aef59d43fce93904b73dee3b85e41303bebf06f61ef69d447c728ed73777d86b7ce7188dac2d00baba6c22c6d77ce710bfbef718eceff39d42f24d6f1ffc870a4f816f6febb632df215295b505c0e121be0cd4fbce21feacdaa633dcc59fa776c3ea9dbe538867b54543fc9bef10a9caca02a0a5dd16e37897ef1ce2cfbe3ef8e9d3be5348befbd193c17b51f297831b9abbec62df3952917505c0a64d566c8e5bc9d1838c24393f7a32188615f1695f1ffc7c9def14e2598c04b76ddb6659776c54d61500a5e5fc3370b2ef1ce2cffa560dbd4a74acd802cfb7fb4e219e9d545ccaa77c8718a9ac2a005abbec34838ff8ce21fe0c25e0bff51cb64488013f7e3238844af298e3ef5b3a6daeef18239155054022c1578002df39c49ffb3643d35edf29445e6a670facdaea3b85785688f175df2146226b0a80e60ebb0e58e63b87f873a01f7eb3c1770a9163fbf93a6d459def0c2e6d6db7ab7ce748565614001bcc8a80cffbce217efd76839ef997e8eaed833b741265de4b386ed9b4c98a7de74846561400e59ddc0434face21fe741f86fb37fb4e217262776fd4d329c2ac71157cc077886444be00d8b3c726019ff49d43fcfafd9f740a9b445fdf20fc41a300627cbaadcd26fb8e319cc8170089389f0326f8ce21fe741e8007b4c04ab2c4bd9b744e80306130ce677c87184ea40b80dd6d7696c1db7de710bf7ef72c0c267ca710494eff10dcf9bcef14e29df1eee6763bc7778c13897401e0e27c8d886794f4eaed8387b6fb4e213232f76fd282552186e3cbbe439c48643bd7ddedf6068c85be73885ff76ed2dcbf649ffe217850d356024b8e3cc21e49912c009a9a6c8c737cc1770ef16b2001cbb5f25fb2d4dd1b35752580e34b517d2c309205407c2cef03a6face217eaddaa6c55492bdba0fc1634dbe538877c6ccb1e5bcdb778c63895c01d0da6ae3303eee3b87f8a76fff92edeedde83b814481834f3537db58df395e2e720540a280bf0526f9ce217e6ded82edddbe53888ccea64ed8a5b32b046a29e606df215e2e5205405b9b950237f9ce21fe3db8c577029170acd462400148f0c9f6761bef3bc6d12255000cc5f90850ed3b87f8d537088feef49d42241cabb66b31a0008eaa01c7077dc7385a640a806ddd5666c6877ce710ff9edcad53d52477eceb83b5cdbe5348447c7c5bb795f90ef1a2c81400c5437c0c28f79d43fc7b7487ef0422e15aa3112d09949524a2f3453712054073af55017feb3b87f877b01fd6b7fa4e2112aea77607535b22667cb869af55f8ce011129006c804f00915a1c217e3cb14bf3a5927bfa87e09916df29242226c607f888ef10108102a0adcd263be3fdbe7348343cae8d53244769532039ca875a5badc67708ef05c0a0e3e340e4364890cc1b48c08636df2944d2e399168d6ec9ff196705fe4701bc16003b7aac1c17cd2d1225f39edba3837f24771d1a802d9dbe53485418bcafabcb26facce0b500281ce406a0d46706898e67b4f84f72dc3abdc7e5cfc6f70d71bdcf00de0a00332b04cdfdcb9fadd3b3d292e3d66b21a01cc51c371ee90bbdf05600b476f266608aaffb4bb4f41c82967dbe5388a4d7b66ed8dfe73b8544c894960e5eefebe61e4700b8d1d7bd257a9e6ff79d4024fdcc606387ef1412250e3e6e66cec7bdbd1400cd9d76058e337cdc5ba269931647499ed8a402408e628ed37777b2d4c7bdfd8c0098ffc71f245a36690440f2840a0079b998a73e31e305406b979d065c96e9fb4a74f50fc1ce1edf294432636b97f6039097715cd9d465a767fab6192f0012093e0a7899ef9068dab5571f88923ffa8760f75edf29246a0a3c1c1294d1026067bbd5016fc8e43d25fa7676fb4e2092594d2a00e4650cdedcde6eb599bc67460b8002c70781a24cde53a24f1f86926ff49e9763281e7099dd1b276305c006b322e05d99ba9f640fcdff4bbed9adf7bc1cdbf599dc18286305407907af05bc9f7e24d1a3f950c9373bf59e97639bdcdcc19599ba5926a700de97c17b4996e81b845eed8c2679a6fb6070faa5c85fc8e001791929005a3a6d2e8e8b32712fc92e6d077c2710c93c033af5de976370706573974dcdc4bd325200248c0fa047ffe4183af4212879aa5def7d39b6b833de9e891ba5bd00686ab2310ede9ceefb48766adfef3b81881f2a00e478cc789799a5bd7f4efb0de2255c074c4cf77d243b751df29d40c40f8d7ec9094c6be96259ba6f92f602c039de99ee7b48f6daa7058092a7742cb09c90a57f31605a0b80e66e9b6670493aef21d94d1f8292aff6f7fb4e2011f7ea74ef0c98d602c025787bbaef21d96d9f3e04254f69f44b8651d0ef786b3a6f90b6ced9cc9c9199958c92bd340220f94a2300321c17ec0c98b627e8d25600b4747311c6cc74b52fb9e1f0a0ef04227e1c1cf09d40b240e39e4ee6a7abf1f48d00247863bada96dc3138e43b81881f7aef4b3212f0a674b59d9602c0cc0a1cbc361d6d4b6e19d476a892a7f4de9724bdc1cc0ad2d1705a0a80d60eae4007ff4812f42128f96a402300929c9a962e96a6a3e1f48c00b8f40d59486e510120f94aef7d4996597aa6d4432f009a9b6d2cf0eab0db151111c9470eaedbb6cd4ac26e37fc118062ae04c685deaee4a402ed1221794aef7d19810945a5e16f0d1cfe5bd0b82ef4362567e94350f25561dc7702c926cef15761b719eac7efa64d560cbc2acc3625b7a900907c55a8f7be8cccab37981585d960a86fc1d2322e4327ffc90814e85b90e4a9b8defb323265e55d2c09b3c1706bd0340c51486e2b49cbd3ad22d13756ef7d19b950fbd8d00a00338b1b5c15567b921fc617fb4e20e247a9defb3252c6abcd2cb47e3bb4865abab900a80eab3dc90ffa10947ca5e2575230694f27e785d558785300092dfe9391530120f9aa34d4e55c922f12165e5f1be61a80ab436c4bf2c4787d084a9e52f12b2971e14db58752003477db34605e186d497ea918e33b81881fe5637d27902c75e6ae4e9b124643a1140036c43561b423f9a7bad47702113f6a5400486a5c2ca429f7500a00e7784518ed48fea9d2a6d192a754fc4aca42ea73475d006c302bc258144618c93f352a00240f3954fccaa82c35b3c2d13632ea02a0a2830b01d5b29292e20298a0c5509267ca4aa0483b014aea2634778dfe71c0511700e6c23fa148f24b4399ef04229955aff7bc8c5682cb47db44186b005400c8a84cd187a1e499a93a314546c985f0e57b5405c08e1e2b07ce1e6d08c96f5327f84e2092591af59210ccefeab2519592a32a000a07b904d04c968c4a43b9ef042299355505808c5ec1a1a1d12dc01fed148056ffcba84d9908053a1b5df2443c0e759a029030c45838bacb474705808c5a511ca6691440f2c4cc722854c12b2170c6e2d15c9ff2dbf0c8dcc3e9a3b9b9c88b1aab7c2710c98c93f45e97f09cddde6ee353bd38e502a07f888568fe5f4232471f8a92271a7568ba84a76020c605a95e9c7201606e74730f22479ba30f45c9030e8d7649c82cf5be38f502002e4ef55a91972b2b813a3d0e28396e4a9976be94d0a5dc17a754001cd983f8ac546f2a722ca7d7fa4e20925e7a8f4b1a9c676605a95c985201d0d2c119804e7297509da10f47c9717a8f4b1a8cdbddcea9a95c98da0880e3fc54ae133991536a82c381447251718116bb4a7ac452ec93532a001c2c48e53a91132988c1dc1adf2944d2e3d4c9daf04ad2c35c6a7d72aa05804600242de64ff59d40243dced77b5bd224d53e79c405c0b66e2b339895cacd4486736ebd764993dc5318833335ff2fe973522a07038df8a3b66490b3081e671509dd9842384d1f949263ceaa0fdedb2269e20e0f8e7c67de11170016d3e37f925e1a2a955cb3a0c17702c97929f4cd231f6c351500925ee74e81b145be538884636c61300220924e96c2de3ca9ccb6aa0090b42a8ac3051a05901c71d1f4e03d2d924e2e852fe7232a009a9a6c0c70d2486f223252976a99a9e488257a2f4b2638e66eda6423da687a440540bc84b980b66a91b49b5a0ed3cb7da710199d991530adcc770ac91385632670f2482e185101e01cf346964724759736fa4e20323a1ac9924c7231e68ee4f5235d0330a2c6454663e1f4e09440916c34a1182e9ce13b85e413e75400488e2888c1d2d9be5388a4e68a39dad44a322e7d0580690a4032ec8a461d1024d9a7280e97aa7895cc1b511f9d7401d0dc6c6331a68f388ec8288c2b0ea60244b2c99259503aa2f5d822a19835922701922e001205cc19c9eb45c272f5293a454db247610cae1ad15a6c91d0148caf24e9e5d3497facc6e368404bbca81c07976835b56489cb1aa162acef1492af8612c91fd697740160a60240fcb9669e765393e82b2e80ab4ef19d42f2596c047d75f203aba62380c59ff212b84c25a844dcb24698a84757c52373691801c0690440fc7af53c18af85551251138ae11a3d282dfea5610460048d8aa4c3b822b8ee34df29448eed75670427ff897815f608c0b66d5602e8404bf1eed259d0a0bdd52562a695c162edfa2751604c33b3a44ad1a40a8082714c01dca842898420e6e02d67fa4e21f2670e78cbd9c17b532402e22d3dd425f3c2e40a0047c3e8f2888467de64b8709aef1422818533e0941adf29448e32c0d4645e96dc1a00150012316f3b3b587425e2d3f862788346a4246a92ecb3932a000c1500122da5c5f0a6b37ca7907cf7f67354884a04398d00488ebb783a9c5eeb3b85e4abb3eae0fca43e6645322bd92fedc93e063865145944d2e6bd0bb4f18a64de846278d77cdf29448e2d166a0160e87b9644d2c412f89bf37ca7907ce280772f8032159e1251069393795db223009346914524adcea987a5daa85a32e4b2c660f85f24c292eab3872d00cccc018580b8940000200049444154d5a38e2392466f3e0bea27fa4e21b9aea10cdea855ff127d493d983a6c01b0ab9772a068d47144d2a8b8006eba585bb14afa8c2d821b2fd6a99492154a3a3b6dc2702f1ab600880f68f85fb2c3a4f170c3f9dab252c2e780f7cc8749a5be938824e7e0d0f07df7f06b00121afe97ec71763d5cad13d92464af3915ced5b3509245e205611400711500925d5e7b5a50088884e1bc2970dd3cdf294446c612540ef79ae1170182ce5e93ac1273f0c10ba171d8b7bfc889cdac3832ada47925c932b124faee610b8058420580649fa2387c7891e66c2575d5a5f09145c10253916c632e8402c0400f5749569a500c372d8471daab5d46687c317c6c91769994ece5c21801704954112251553f113e7549f008974832c614c2c71643ddb00f5189449725317aaf350092f3a69505dfe64a34942bc3288a07c3fe332b7c2711199d50a60000d5c192f51aabe043174341b29b5f4bde298cc14716c2c97aee4972804b62fa3e998fc3b1216411f1eeb4c9f089251a0990bf5414879b16c1bca48e5011c902c698e15e327c01602a0024779c52031f5f1cccf38a40b07df4df2f090a44919c111bbeef1ebe00702a0024b7cca9864f2d0d567a4b7e1b57041f5f12bc2744724a125fde35052079694639fce352a81ee73b89f852330e3e7d19ccd68651929b5400881c4ffd44f8ece5faf6978f6655c2a797e9513fc969211400492c2410c956e38be19397c0f9537d27914c39770afcc3526df223396fd80260f8f5d00e2d97929c5618830f5c101c27fcfb0d60be03495a38e035f3e0ba53b5b7bfe48561fbf7641e888a87104424d29c83d79d06b3abe03b8fc2c17edf89244c630ae1bd0b74a4afe49561fbee64d600a80090bc71562d7c76194cd1091839a3a10cfef50a75fe927786edbb871d086beeb03e403ba94b5ee91f829f3f03f76cd4944036bb783abcf35c9de82779e9705d953be11abe640a8041340a20796a5d0b7c6f0df41cf69d4446624231bc7b019c55e73b898837037555ee845fde93290012c9bc4e2457f51c86dbd6c0d32dbe934832ceaa83ebe76b95bfe4bd445d953be19777150022495ab3137ef424f4f6f94e22c732a118de78162c9cee3b894824845200680a40e48803fdc1da8007b6686d40942c980aef3847db3b8b1c259429002d021479990d7be0276ba1a9c77792fc36ad0cde727670c89388bc44288b000f82760314793933786807fc74ada60532adb418ae9d0bcbe6404c139422c7b2bfaeca8d3fd10b922900f601a5a14512c93107fbe1f7cfc23d9b82c707257d8a0b6059235c333738c657448e6b6f5d952b3bd10b9229007a006d8b22328cde3eb8ebf960ef001502e18ac761f174b8f63428d7ea7e916474d555b9139e75994c01d006e8bc349124751d843b9e83155b55088c5671012c9e09579f02e59a88141989b6ba2a37e9442f48a600d80934841649244f1c1c80555be1cee7a1fb90ef34d96542315cd608973706f3fd223262dbebaadc8c13bd20990d320f86144624af8c2d842b4e82a58df0f03658be05b676f94e156d332be0d25970d10c2848e6a41211399e61fb6e1500226956188325b3829fdd7b61d57678702becd793034050289d3f152e9d0dd3ca7da711c919211400c641ed0328128efa89f086338233e99fda0dab77c233cd3090f09d2cb38ae270466db081cfd9f5c1df8b48885c180540128d88c8c814c5836fbde74f8543034131f0d82ed8d00a87077da74b8f9202387532cc6f80b3ea618c4ee813499f84a60044226f4c215c343df8194ac0964e78aa392806b67767f796c335e382cefeec3a38a946f3fa2219e31876e9713205c0de10a2884812e23198531dfc7046b0b7c0964ed8d6052f74c0c6b6e84e17c4633075e291fc5570caa46035bf88649e8361372a4fa600d06ee7229e4c280e8eb77df15cfb8104ecda0b4dddd0d40b3b7ba0b907ba0f673657d998603dc3d4326838f26bfdc460c1a388f86716420160468fd322409148288cc18cf2e0e768fd43d0be1fda0f06bf761f0a460ff6bff8d30ffd8370681012164c35bcb8d6a0a420f8f61e73c1bc7c71018c2b0a9ebf1f5f04e34ba07c2c548f0b86f4ab4bd5d18b449d8b855000b8183d593d092992078ae2c137f07a6dda2d22243702306c1d6f9a02101111c92ac9ac0118b60070495411222222121d09a37bb8d70c3f9397a033943422222292197186dd787cf82900c79e70d28888884826140cd03adc6b862d00fa0b54008888886493588cb6e15e93d4037ecd1d7618d0961e222222d177a8aeca8d1dee45c93ecddb3eca302222229219498ddc275b00681a404444243b0c3bfc0fc916006ef8c504222222e29f0b7504c0681a551a111111c9941dc9bc28d929001500222222592091649fad02404444249724396a9f5401e03405202222921de2ec4ce665491500b1840a001111916ce0c29c02e8ed65179018552211111149b7c1da729a93796152054063a3eb03768f2a92888888a49763a7736e30999726bb081060738a7144444424132cf9be3af902c0d8925218111111c9081bc197f5e40b00a70240444424cadc08faeaa40b00e7340520222212659648c308c0d0209b528b2322222299108ba5610460e0202f0043292512111191741bdcdf958611801933dc61607b2a8944444424ed361f796c3f2923790c10071b469e474444443260447df4880a00836747964544444432c246d6478fa800400580888848248df44bfac80a00d314808888481425e2692c000ef4b0011818512211111149b7fede729e1fc905232a008eac2e1cd10d44444424ed36cc73ae7f24178c740d00c0da14ae11111191347129f4cd232f009c0a001111912849a45000148cf4029760adb9915e2522a932837dfdb0bf0f0ef4c3fe237fbdbfffc8dff741df10f40fc1c17e181882be41383808830938fcb2553b03475e7bb49202881ffd75c0c1b823bf575200630aa1b020f8eb9242288a41693194161df5531cfc8c2f86b18569ff631191a3c532500014c558db6718a03240649412065d07a1ed00741e84ee83d07338f8bd177fed3d1c74e4e97478f02f7fef40d2fb89fda5c218948f81b2b1503e16ca4ba0720c4c1c035563a1a614cac6a4debe88bc849518eb477a514a9d787387bd00cc49e55a917c3398803dfb60772fb4ed3ff27300daf7079d7eba3bf7a82a8c41cd78a8190bd5e3a1661c4c1a0f751382bf76fa8a2192ac67ebaadcbc915e34e211802356a30240e42506134127dfdc0bbbf642cb915fdbf6e76f277f220309d8bd37f8a1e5a5ffac30067513a16e3c4c9918fc75c3449854aac240e4e55cd0278f584a05808335066f4be55a915c3034042dfb615b376ceffaf3af2f9f5b97d40c24604777f073b49202a81d0ff513614639cca880e9155014f79353240acc5893ca75a94d01b4db39389e48e55a916c63167c93dfdc059bda617327b4ec0b7e5ffc8bc7a161023456c2ecaae06752a9ef5422993314e38c860ab76ea4d7a554009859614b273dc0d854ae1789b243834147bfa9133675c0964e38a4fd2fb3cac412985d098d55c1cfac4a284865d71391e8db575b49b9736ec4e38f29cfa635b7db2a1c17a77abd4854f40f051dfe0b1dc1cff3edc110bfe48ea278305530a70a4e9b0427d5a82090dc60b0bcbeca5d9acab5a92e02c4391e36540048f6194a04dfea9f6985e7da606ba716e9e5bafe21d8d81efcdcf91c1417c049d530b7064e9f0c0de57aae59b293331e4ef9da542f6c69b3575a8c3fa47abd4826f5f6c1737b606d73f07360443b664bae9b500ca74c8233ebe0ec3a1857e43b914872cc71797da5bb37956b532e003a3b6d429fd10568fdad448e117ccb7f72173cd3023b7b7c27926c118f050b0acfa88373ea837d0944226ab0d0a8a8ae76fb52b97854a35ecd1df62470f668da10094bc2607307ac6982c77705bbe8898c56cd3838ab1e16344063b5a60a243a0c56d757b90b52bd3ee5350047eebe02a70240fc194cc033cdf0d82e785a43fb92066d07e0ee8dc14fc5d86054607e039c5cad4d89c4af18ac1ccdf5a31d01b816f8f568da101929b3e0f1bc354df0c80ed8378a3deb4552553e262804343220bec48cab2757bb3b53bd7e54efd96ddd56563c44075a072019b0ad1b1eda066b760607e5884445d5b8606460d10c9856ee3b8de489c192185515156e6faa0d8cba686deeb035c0fcd1b623722cdd87e0e1edf0c016d8b3df771a91e1d54f8485d361f1cce0686491b4301eaaab760b47d3c4e8d60004ee45058084683011acde7f683bac6b0d9edb17c916bbf7c2cf9e815fad8773a6c0c5d383bd06e2da784842e462a4f4e8df4bda186d032dedb6d81c0f8eb61d919dddc137fd47766a319fe4968ab1b078062c990995e37ca7915c90705c38a5d23d3a9a36465d006c302b2aefa413d0f11b32624343f0c46e58be1536b4fa4e23925ecec1dc49b074269cd70031ad1c94d4f4d45652ed9c1b1c4d23a1bcfd7677d81d0eae0aa32dc90f3d8760f916b86f53b04b9f48be99540a97ccd25a0149c96feaaadc75a36d249402a0a5c3de6ff0ad30da92dcf65c3bfcf1f9603bde848ed315a1280e174e872be7040b084586e578775da5bb6df4cd846077a73538634758ed496e3183a75be0f71b82237645e4d8e654c3d5a7046712e8c3548ec386a0a1a1caed1e6d43a1bdc75adaed19739c1e567b92fd0e0dc0caad70d746e83ce03b8d48f6985a069735c2c21950a8a707e4a59ea8ab72e785d150188f0102608e3b410580049bf4fceff3b07c331c1ad5121591fcb4b3077ef038fce64ff0ca9360e9ece0086311b3f04ee10d6d046057a75d10331e09ab3dc93e5d07e10fcf078ff2f50ff94e23923bc617c3b246b8628e8e2ace770ee6d756b9c7436a2b1c66166fe9a405a80eab4dc90eed07e08f2f04dff807b4698f48da8c29804533e1eab95056e23b8d78d05a5b49bd732e944fda50d79934b7dbf7715c1f669b125d6d07e037eb838d7bb45b9f48e69414c0a58d70f5c950aa4708f3c9ad7555ee7d6135166e01d069afc0f8df30db94e87971a8fffecdc1b6bd22e2474941b058f09a5360aca606729ec1b2fa2a775f58ed855a009859614b277b009d879583f6f5051dff3d1b35c72f1225e38a83d180cbe704fb0a484eeaacad64f26877ff3b5ae88f9a3677d8edc05bc26e57fc393800773e07776f843eadea1789acf212b8665eb0c360811e1fcc290e7e505be5de15729be16aeeb0d700bf09bb5dc9bca104acd806ffb31ef61ef69d46449235793cbcee345830d57712098b4bf0aada1a7757a86d86d9184053938d898f610f303eecb6257336b4c24fd642d35edf494424558d95f0a6b3a0b1ca771219a59e03dd4c6e6c74a19e9c9296dd26350d90bdb675c37faf85e7da7c271191303860fe5478c3e950ad335bb3523a86ff8fb41bbe962ebbd212843a5421e9b5f730fc7c1dacda0a3aa34724f714c6e0aab9c159035a28985dc25efdffa2b414006656d0d2c92e60523ada97f0bc38cfff8b75b05fc7f28ae4bc8ab1f0bad361e174df492449adb5954c71ce85feec555ad6893ae7060d7e958eb6253ccfb7c33fde13ec39aece5f243f741d84efae86cf3d00bbb5c627fa8c9fa5a3f387349e38b9bbd32e74c6c3e96a5f52d7732858e0b77aa7ef2422e2533c0e57ce816be7e9b0a1a872b0a0b6ca3d96a6b6d3c3cc5c4b279b8059e9ba878c8c010f6d0f3aff03fac62f2247948f81779c03e74cf19d445ee685ba2a7772ba1a4fdb5611ce39037e98aef66564f6ec83cf2d0f86fed4f98bc8d1ba0fc1cd0fc1371e815e7d3e4486336e4b6bfbe96c7c57a74d8919db01ad39f56430119cd4f7abf5dab75f448637b608de7046b09b605a3b08194e7f6c9086c9935dda1eca4efb7fdfe60ebb075896eefbc85fdad80eb73d0ecdbdbe938848b6993709fee63c98a4bd037cf9655d957b7d3a6f90f6026077bbbdd139fe3bddf7913f1b4804dbf7def53c24f450bf88a4a8280ed79d0aaf3a199c860332ca1c97d757ba7bd3798fb4ff273db23570335096ee7b096cee84efadd1b77e1109cf9c6a78ef028d0664d0f6da4a6639e7d23a719bf6f3a21a1adc21073f49f77df2dd60027efd27f8ec7deafc45245c1bdbe11fef86e55bb4536886fc47ba3b7fc8d01a8fe60e3b05d890a9fbe59b1ddd70eb6a1ddc2322e977461d5c3f3f387a58d262c81c33ea2b5d53ba6f94b10eb9b9d356602ccad4fdf28101f7bc003f7d462bfc452473c617c3bbe7c3d9f5be93e41e0777d456b96b3271afb44f01bcc812dc9aa97be583de3ef8ca0ab87dad3a7f11c9ac7d7df0d555c1c8637f5a36a9cd5f09e3fb99ba57c646003698159577b2131d10346aeb5be17baba1fbb0ef242292efea26c0072f80a9e5be93e484d6da4a1a9c738399b859c64600e639d70ffc47a6ee978b0613f0e3a7e08b0faaf317916868ee854fdf0bf76ef29d2427dc96a9ce1f32bc286fcf1e9b3414673ba0e52323d47920d8a67373a7ef242222c7764e7df0b8e0d822df49b2525fa131a3badab564ea86191b01009834c9ed31f85926ef990bd636c3a7ee56e72f22d1f6e46ef8a77b6167b7ef2459c8b83d939d3f78782cafb5cb4e4d2458e7e3ded9662801bf7b167eb3014c0fdf8a4896288c05e7095c7192ef2459c39ce3d4da4af76c266feaa5136eeeb03f0257f8b877b6e8ed836f3d021bf6f84e2222929a8ba7c33bcf85e202df49a2cde0cefa2a7775a6efeba500d8dd69cb9c718f8f7b67838dedf0b58761af16fa8948969b5a061fbe18aab58df07139e392da6af760c6ef9be91bbea8b9c39e02cef275ffa85abe057ef4140ce9d95a11c911a5c5f0b717c0bcc9be9344d2937555ee5c1f37cee822c097b9d9e3bd236728013f7b067ef0b83a7f11c92dfbfbe00b2be0cee77c27891e33bee2ebdede4600ccacb0a5932d4083af0c51b1af0fbef1303cdbe63b8988487a5d382d384ba028ee3b4924ecaaad64a6736ec0c7cdbd8d0038e7060cbee9ebfe51b1a31bfef11e75fe22921f1ed9019f5baecdcc00707cd557e71fdcdea3ce4e9bd067ec0426facce1cbba9660739f43defef38b88f85136063eb608a6e5ef16c2bd2531a65654386fe7b8fa5c034065a5ebc5f2737be0e55be02babd4f98b487eea3904ff727fb0d1593e72f01d9f9dff910c7eb5b458b515b215c88b87441206ffb516eedee83b8988887f31076f3d1b9635fa4e9251fb6383cc9a3cd9799dfcf53a0200505bebda1d7cdb778e4c383c0837af52e72f22f2a284c18f9e84db9fcaab1d4f6ff1ddf9430446000076f55a65ac9fadc004df59d2a5e7307c6945b0e84f4444fed27953e0fd17065b09e7b0bd4385cc6c98e8ba7c0789c41ff39409ae13f8baef1ce9d2be3f98eb52e72f22727c8fef822f3e000773786d94737c250a9d3f44640400a0abcb261e4eb00dc8a935a14d7be10b0f060b5e444464780d13e1e34ba07c8cef24a1eb2c76ccacac74bdbe8340444600002a2adc5ee7726b77c0e7dae05fee53e72f2232124d7be1b3f7c39e7dbe9384cbe04b51e9fc21422300006d6d563a18630b50e33bcb683db91bbef9300c247c271111c94e134be0638b617a6e8c0bb71724985953e3f6fb0ef2a2c88c0000d4d4b8fd86bf7d91c3b2622b7ced2175fe2222a3b1f730fcdb7278a1dd77921038fe3d4a9d3f446c0400a0b5d5c6250ad8024cf29d2515f76f861f3e99578fb38888a455511c6e5a08a766ef69822d438798d5d0e02235211ca9110080c993dd011c9ff79d23157f781e7ef8843a7f119130f50fc197570653abd9c8c1bf46adf387081600007dbddc0a6cf79d6324ee7c0e7efa34a8ef171109df6002befe48f0a86096d9b2bf3b9a5bde47b2009831c31d768e8ffbce91acfff913fcec19df29444472dbd0507074fa43db7d27499ec1471a1b5d9fef1cc712b93500476beeb00781c5be739cc84f9f0e86fe45442433620edebb002e9aee3bc989192cafaf7297face713c911c01785122c18dc090ef1cc7f3cbf5eafc4544322d61f0dd35f0c80edf494e68281ee346df214e24d205c0941af734c67fface712cbffe13fc6e83ef142222f9296170eb6a5813d122c0e0bb932bdc7adf394e24d2530000adad569328602330d1779617ddf502fcf75adf294444a420067f77119c5def3bc94b7453c49cba09aec377901389f40800c0e4c9aecd19ffea3bc78bfea8ce5f4424320613f0b547606d8bef242ff199a877fe90052300001bcc8aca3b590fccf199e3de4dc1b9d52222122d4571f8e86298eb7f23f9e76b2b39dd3917f9330d233f020030cfb97e333ee633c3a33be1c74ff94c202222c7d33f0437af84ad9e0fda75316eca86ce1fb2a40000a8af76bf07eef671ef3fb5c277576b873f1191283b34085f5a01cdbecedb73fca1b6c2fdafa7bb8f58d6140000cef11120a395d5a60eb8f9a1609e494444a26d5f1f7cfe41e83890f15bf75b828f64fcaea3905505406da5db007c2953f76bea812faf82bec14cdd51444446abeb207cee41e8cde0fe7b667caebedabd90b93b8e5e5615000007baf92cf05cbaefd37600bef8201c88e4068e222272227bf6c1575766ec0bdc0bfdfbb3ef10bbac2b001a1b5d1f096e208de7ee1ce8832f3d08dd87d37507111149b7cd9dc1d90143e99dc24d10e3fa19335cd6f51859570000d4d5b89538be978eb687868213a75af6a5a3751111c9a4a75b8263dad3c5c1b7eb2adc43e9bb43fa64650100500c1f07423d18d280ef3f0e1bf684d9aa8888f8f4c0d66007d7b039682e8ef18fe1b79c19595b005456bade98f1be30dbfce5baec3a6652444492f3d3b5e11f1e9480f75754b8bde1b69a39595b00004cae767702ff13465b2bb6c2ef9f0da3251111891a03bebf2678b43b0ccef1b3fa2af7bb705af323ab0b008082041f04ba47d3c6863df09f699c23121111ff061270f32a68df3feaa6ba6283d13eea3719595f00d4d4b8568c4fa47a7dfb01f8e623dae84744241ff4f6c19756c2a1516c29e7e0a649935cd6af16cbfa0200a0b68adb0c968ff4ba4383c173a2fbf4acbf8848de68ee855bd7a4bcbdfbbd932bf971c891bcc88902c03967e6783b90f4311066f09d47a1296b976f888848aa9edc05bfde30e2cbba8971bd732e274e86c9890200604aa5db85e33dc9befe97ebe1a9dde94c24222251f6db3fc19a113c19e01c37d455b89de94b945939530000d455baff017e34dcebd6ec803bb4e25f4424af19f0bdc7616732cbc88ddb6a2bdd2fd29d299372aa0080ff7b2a60d3f1fe79d3dee03f784e8cdf8888c8a8f40dc2571f82fd275e0bb6a5106eca50a48cc9b902a0a6c6ed77f0668e716cf0e1c1605f689dee2722222fea3800df5d7ddc45818331787375b5cbb90de273ae0000a8ad728f3bc7bfbdfcf7bfff58b0fa534444e4686b5be08e639f33fbff2657b935198e9311395900004caee05f80152ffefd1f5f803539b374434444c2f6cbf5b0bef5a8df70acaaade48bde02a559ce1600ceb944ac807702bd9b3ae0a7eb7c27121191287bf1f1f0ee4300f410e3adceb921cfb1d226670b0080c9656e5bdf001ffaf6a3c131bf22222227d2db07df7a04cc785f5db90bf9f8a068c9e902006046adfbe119b5acf59d434444b243dd049ea8af763ff39d23dd72be000058328f8b4eada5c7770e111189b6b9d5f45e5dc712df3932212f0a800b1bdca1f3a7b3b86a2c3af24744448ea9622c898b6771c91967b803beb364425e1400006f3ac7ad5b3c9b0f15e4cdbfb1888824ab200697cde6c6379ceb9ef29d2553f2aa3bfcc022f7cd2533b8cb770e111189964533f8dd0d8bdc377ce7c824e73b40a69999bbf1d7ec58df4283ef2c2222e2df69b5ecbae53aa6e6ca297fc9caab1100088e0ebea881f9532772e29d9f454424e74d9940df450d9c976f9d3fe4610100f0faf9ae75c94cae195fac33814444f2d58412ecf2d9bceaf5f35debf0afce3d79590000bce32277cf5527f3cff1b8ef2422229269f1182c6be4b36fb9d0ddef3b8b2f79b706e0e5be78af2dffe30b5ce23b87888864ce2b4fe6de8f5ee62ef79dc3a7bc2f00cc2cfe89dfb1f9895d4cf79d454444d26fc11476fcfbab9995cbfbfc27236fa7005ee49c1bba602267cdaa4007058b88e4b85915ec9b3f8d33f3bdf3071500005c7b89ebb97216e7d58d67c077161111498fc9a50c2c6ae4bc6bcf72da1a1e1500ffe7ba056ee3c2e95c35be444f068888e49ad222ece2995cfbd6f3dc0bbeb344850a80a3bc77b1bbe7d259bcaf484f068888e48ca2382c9dcd8def5fe4fee03b4b94a8007899bfbbc47d77e96cbee3f27e79a48848f6730e2e9dcd376f5ceabeee3b4bd4a89b3b8ecfdc65f7afdcca52df39444424758b6672cf675ee9aef09d238a54001c8799b97fb8833faddec95cdf59444464e4ce6b60d3e7afe1a47cdce637199a02380ee79c2d3b8d73cead678fef2c2222323267d4b1e715a773ba3affe35301700297cc70872f3f997927d7b0d77716111149ce2935f45c7112732f99e10efbce12652a008671d929ae73c9744e9e5ece01df594444e4c4a69571f0e2e99cfe8a79aecb7796a853019084d7cf77ad97cce0ccfa093a42584424aa268fa77f513de7bc71be6bf29d251ba80048d25b2f749bcf6ae0e2aa71da2d5044246aaa4b195c388385efbcc43def3b4bb650013002375de29eb8743a4b2bc792f77b488b884445c5588696cce08af72d728ff9ce924df418600abefb905d72ef46eeed3a88f60c1411f1a87c0c89cb4fe6caf75ee4eef19d25db68042005efbdd83d70d94cae2d2b21e13b8b8848be1a5f8c2d9bc95fabf34f8d460046e13f1eb5d7dfb1819ff51ed69fa38848268d2fc1ae3a8977bc7ba1fbb1ef2cd94a2300a3f0ae0bdc2fae98c37b4b8b7582a08848a68c2fc1ae3e89ebd5f98f8ebeb986e0bbabec7577bfc0cf7a0eaba0121149a7f125d82b66f3f6f72d71b7fbce92ed540084e49b0fdab5cb37f32b15012222e931b184c4158dbce986c5eee7beb3e402150021fae64abb74c566eeeed4d3012222a12a1fcbd0a5b379f5fb17b93ff8ce922b540084ece6e576d1a33b78a0e30085beb38888e4828a310c2e9cc5e51f5ae21ef09d2597a8004883af3f60e73fba93157bf651e43b8b884836ab29a5fffce95c7ce312f7b8ef2cb94605409adcfe909db47c3b4fede861acef2c2222d9a8a18c43e736b0e06f17bbf5beb3e422150069f4a347acfed126366c6c67a2ef2c2222d9647615fbe6cfe1b4ebcf763b7c67c9552a00d26ce55356fd3fdbd8b0be856adf594444b2c1bc49b45f3e83b9579feb3a7c67c9652a0032e0174d36e6b12779faa95dccf19d454424cace9bc2e6d74de18c73cf75077d67c9752a0032c4ccdca7ee60f9633b59a26d0345445eca018b66f2e8ffbb928b9c73fa98cc006d5a9321ce39fbdc35ee92cb1bf976a1fed44544fe4f410c2e9bcd0f3efd4a77a13affccd10880075f596e7fb76233b7ec81a1091200000ac249444154efd79fbf88e4b7b1c5d8d2597ce2a6a5ee4bbeb3e41b75409e7ce341bbf2e1edfcae6dbf360c1291fc543996c10ba7f2ba0f5fe67eeb3b4b3e5201e0d17757d8698f36f1e8ce1ec6f9ce22229249d3ca39705e0317be7f915be73b4bbe5201e0d98fd658e5dadd3cbdae9929beb3888864c29975349f3f9d335f7fb66bf79d259fa9008800338b7fe53eeebe7b13970e257ca71111498f9883853358f9ffae64a9736ec8779e7ca7f5e811e09c1bfae83277d92be7f0b971456805ac88e49c9242ecf293f8e2a75fe916abf38f068d0044ccd757d8e58f6ee7f77bf651ec3b8b884818aa4be9bf683aaffdbb25ee0edf59e4cf540044d0d71fb0297fdac3e39b3b98ec3b8b88c8689c5c4debbcc9ccffc062d7e43b8bbc940a8088fa8c598cbbf8edc33bb85aeb024424dbc41ccc6fe0e165e35972c9256ed0771ef94b2a0022eee607eca3ab36f3859e3eadd71091ec30a198c405d3f8d4272e775ff09d458e4f054016f8cfc7ecccd55b58b1a99309beb388889cc8cc0af62f98cab2775fec56fbce2227a602204bfcee211bff58178faedec93c3d26202251e38005d35877662917bdfe12b7df771e199e0a802c73cb03f62f2bb7f0a99ec39a12109168185f8c2d9ec1576fbacc7dd47716499e0a802cf4a3c7edac47b772dfc6762a7c671191fc36bb8abd0b2673e5bb96b8477d679191510190a57e61165f7f27bf5cddc4b57a4a4044322d1e8373ea59f1da7a969d7bae1bf09d47464e054096fbf2fdf6d6c79bb8ad7d3f45beb388487e98348e810ba6f39ebfbbc4fdd07716499d0a801cf0ef7759f5ff6fefde9fa2bcee30803f67afec725d963b8880309528a2a2a8418d444d52632769a6b54dd3a835e9d814d3ea3469d3994e3ad699346d63ad8936346947c7da4b9ca6d3196d9236a8a508ea48102f046d5484456059605d58581676f7f407679ad6b6891a96b397e7f3173c3fecfbee33e7f27d7b4771f85c174a7840908882450028cbc6c5996958bab642f4aace439f0c0b4004f9698ddc5adf8eef393d3c204844132b2906814579d8feec0af16dd5596862b00044983fbe278b4f75e2dd933664abce42449161663aec7333b17cfd62d1a23a0b4d1c168008b5bd46be507f15dfe1754122ba53f146c86505a8de7c2faa8410dc618c302c00116c77ad2cbee8c0a1f33d28509d8588c24b69163aa76760d5c6bbc539d55928385800a2c0cec3f2b9061bb639dcd0a9ce4244a1cd1a0b7ff914bcf0ec0af1bcea2c145c2c0051e2b72764fad95efcb9d186b20017f288e8265a0d302713e7a75971dfc6a5a25b751e0a3e168028b3b356ae6bb2e155db7598546721a2d0909d006ff9146c7eba5254abce42938705200a1d6890a616270e347662b587f3bb88a296490f54e4a126077878edfd6258751e9a5c2c0051ec7727e592c66bf87d7317b2b82b40143d04805999b8563e056b1e2d170daaf3901a2c00845db5b2ea940d3fe1b60051e4cb4e8077612e9eaf5a267eac3a0ba9c50240006e6c0b9ceec39e73dd583332cedf0551a4311b20cb7370707a09beb8668af0a8ce43eaf1454fff61479d2cb03b71a0a913653e7e659028ec6935c0ac0c7c90138f87b6ac14adaaf350e86001a0ff69778d7ce082137bdeb72383e70388c2d3a752d13f230beb372d11875467a1d0c302401f69f751f94c5317b6b53911a33a0b11dd9adc4478e7e7e28755f788adaab350e86201a08fd5d0204df52378b5f11a1e730c719a2051a84a8d876f7e167e7dd70a3cb54a08afea3c14da5800e896fda2519a1d7dd875a61b6bfb87a1559d87886eb09810989b8d3fcd8cc3fa87168b21d579283cb000d06d3b54272d4d6e549feec4e75c5e7e6d90489538036469160e17a7e0cb5f5a28ecaaf350786101a03bf6b31a99dee3c6be965eac1c1ee36f8968b2c41a21e766a22e37098f3eb15874a9ce43e1892f6dfac45eaf91e9d7bc78fd6c0f1ebceee18a0051b0c4c740ce48434396158f6daa10edaaf350786301a00973b859663739f0ab931d5839c022403461926fecf11fb92b1b1b1e2e1136d5792832b000d0843bd828539a1dd87dbe1b8f3846786b80e84ea5c6c3579689b74bd3f1e4fda5a257751e8a2c2c001434478f4a5dfd18bedfe1c4d397fa90a83a0f51b8c849c048612af62f998e6f56e68b51d5792832b100d0a478b9566e68ebc7d6f33dc8f173c430d17f1102989e8a81e20cbc58b5042f0921388493828a058026d52b87e5bded83d8deda8b520f3f3a4404931e28c9446b91159b9fa8107f559d87a2075fc0a4c4d15699d7dc8d9dcdd7f0699b0b7ad57988265b7a3c7c33527164461abefed979e2b2ea3c147d5800482929a5a6ba0e1baff4e399733d2818f3ab4e44143c5a2d509c06fb340b5efb4625b60921c65567a2e8c5024021e3e523b2d4eec68b9707b0bcd7cd55018a1ce971f015a7e158be05df7a7c9168529d87086001a010f4efab022d76148cfa542722ba7d062d509482ee422b7e39ab123fa81482bf640a292c0014d2de3c250b2e0ee0476d0378f04a3f4c3c164da14c00c84f86a73019070b2c786ecd02d1a63a13d1ffc3024061637f835cdeeec2772ff56369fb756e1150e8c84c80bfc88ae6022b5e7a7c01dee0153e0a072c001476a494dabd27b0a1630055177a51621fe6d8619a7cc966040a9371616a32767d6d095e1342f0082b851516000a6b47db64ccd92bf86a971bebaf3a51ea7043ab3a1345aeb458040a53d09a9d843d2b32b0aba84878556722ba532c001431a494fabd27b0becb8527db9d9873b91f7aaec3d2279591005f9e05e75362b16f4b255e113ccc47118205802256759d7ca0cb854d3d6e54b43991e4e7022ddd029d06c8b762382701278b5251fd8532bc2984e0006b8a382c001415de69918557fb50651bc467fee1407eff08cf0dd08752cc08e459d0911a8bbf4cb560c79af9e2a2ea4c44c1c6024051474aa9dd558b47fa86b1d6eec6c28eeb4819e53cb6a812a307f22d7065c4e3bd5c0b7e336f01f6cf10624c752ea2c9c4024051afc526938fb563ddc03056dbdd98fd411f923d2c0411c5a005722d70a5c6a2c56ac0db73aca8ae9c27fa54e72252890580e826ef34c8e4f747b1ceedc5aabe21ccb60dc2ea1ae5b3124e124d903909e84b35e34ca21987a659b16ff52ce1549d8b2894f0a546f431a494dabdc7b1d23e84cf3b3d58647723bf7b1031e33c161612f41a202b119e3433ae5a63519f92883f7ca51c35bc974ff4d1580088ee40dd5969691dc2eade2154bac7306b6814f936172c6e2f9fa96032e9808c448ca49ad16136e06cbc01c7cba6e18da579a25b7536a270c39715d104794b4a63c731dce7f2e29e612fe60e7a30cde9415aef3062bcbc397e5b6274405a1c469362d01b6fc2a5383d4e2798f0b7a98bf1ee2ac1e13b441381058028c8de92d2d8731ccb1c6e5478c65132328e02b717992e2f12fb8761188bd2856a8316b09a319668822bde882e931e57cc3a9c4b8c45fd94bb51cb3f7aa2e062012052484aa9ff7903660f8f60deb80f33bc01e48d8e21c7eb47ca901709ee7198063dd0855b4930688104137c717a78128c18d4ebe030ebd1a917b81a63448bd980534f2dc6194ed52352870580280cecf8bbcc3468307ddc8b426f00d93e3fd2477d481b0f20d9e7435240c2ec0dc0ec0f20c61f80d63b0ee3b884d6ef87c62fa1f5fa3f7cd60312e2e6b907663d00817f4d4e366a20b51af8751a04741af88d7a78b51af8b51a8c1a3518110223061dae1bb5e8d709388c7af46875e834ea71652c800b5b96724f9e8888888888888888888888888888888888888888888888888888888888888888e856fd134b6fd6ce2df2ca400000000049454e44ae426082	0937363720	Sanjapamba	t	M	2013-01-30 00:00:00	1	\N	f	2025-12-07 16:46:02.54069	3	\N	\N	\N	\N	\N	\N
19	bryan	$2b$12$Ud5qBolrAip3rfUnwT9Bg.Dd5klW.R0h1t2R.Fct25vPo1DNdMqlO	Bryan	Charco	0600606069	bryan@gmail.com	2025-11-28 18:15:50.74027	\N	0998804603	San Andres	t	M	2011-02-02 00:00:00	0	\N	f	2026-01-02 21:18:18.240478	4	\N	\N	\N	\N	\N	\N
17	carla	$2b$12$Au.DTU7QDnsbtCmcAlduG.Zu2yrnTXWU2wfbR6bkRDiGvIWyqCOs6	Carla	Rios	1101122993	carla.rios@example.com	2025-11-15 20:00:31.944542	\N	0976655443	Ambato	t	F	2000-10-25 00:00:00	0	\N	f	2025-12-30 19:44:26.362154	3	\N	\N	\N	\N	\N	\N
18	carmelina	$2b$12$SbYVrNG7N9TMrV8xu9EIoeSZw5x68SGNagEAHvF0vU6xeFvd.VwgG	Carmelina	Cayambe C	0605336528	carmelina@gmail.com	2025-11-17 22:57:59.694995	\N	0999999999	Sanjapamba	t	F	2009-03-13 00:00:00	0	\N	f	2026-01-04 18:25:52.489139	1	\N	\N	\N	\N	\N	\N
15	sofia	$2b$12$PqaR6HScYCEbzkDUJsY/Yu6rDH0sABL.vFnuZjr9j1xHpvrWSo.1i	Sofia	Hernandez	1105566778	sofia.h@example.com	2025-11-15 20:00:31.484393	\N	0981122334	Cuenca	t	F	2002-01-19 00:00:00	0	\N	f	2025-12-17 10:12:53.422959	4	\N	\N	\N	\N	\N	\N
14	diego	$2b$12$j8Ma6Xnh.0OukrlpkloV1On01TOaxo.OPXJqk.DAvyeoqCseKDIGW	Diego	Martinez	1103344556	diego.m@example.com	2025-11-15 20:00:31.258584	\N	0998877665	Guayaquil	t	M	1994-08-30 00:00:00	0	\N	f	2025-12-30 15:58:46.863181	5	\N	\N	\N	\N	\N	\N
4	cliente	$2b$12$coKNi8uzNrTYkiyIt9W5SefXLrEmN/ZI2M6tMoOy37lPrYquFX0Oq	Miguel	Charco	1200112232	alexcharco31@gmail.com	2025-10-21 22:01:31.950863	\N	0923838232	Sanjapamba	t	M	1998-02-28 00:00:00	0	\N	f	2026-01-07 11:19:49.870551	2	452b8a1d31e4fd6b095320d47b49e6e2056eaf9b17e4079e84645e0af7f8613c	2026-01-04 04:21:12.410018	2026-01-04 12:21:12.410018	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-04 04:21:23.363367
13	ana	$2b$12$Ql3FtZaKsBRt./HltP0M8.YXLAm324kkHLI/F5wlPuft.nHgnbkle	Ana	Lopez	1102456789	ana.lopez@example.com	2025-11-15 20:00:31.013544	\N	0987651111	Quito	t	F	1999-04-12 00:00:00	0	\N	f	2026-01-08 13:30:18.501028	4	\N	\N	\N	\N	\N	\N
20	jose	$2b$12$0a7p3m8INcObcSPofUeraORLAUtq.6LXWu/DnfD1pgoM6iBNI0Q3i	Jose J	Acan	0704030495	joseja@gmail.com	2025-12-30 17:11:36.06087	\N	0999999999	Sanjapamba	t	M	2014-02-28 00:00:00	0	\N	f	2026-01-06 15:05:57.04277	1	\N	\N	\N	\N	\N	\N
10	andy	$2b$12$xUDmACSTMKqaY6frK22tA.kktDWLIpm48GMtnMEDXFKC5RYC/7glG	Andy J	Paca Paca	0560569586	alexcharco31@gmail.com	2025-10-30 19:16:42.814879	\N	0999999999	Sanjapamba SA	t	M	2004-12-25 00:00:00	0	\N	f	2025-11-06 11:19:54.774489	4	\N	\N	\N	\N	\N	\N
6	alex	$2b$12$laQe6S8b29ueHJ3GAVBSXOCz8lXHv0jov.eGXa5LBRzZL1kng04QC	Alex Mauricio	Charco	1208484820	alexcharco31@gmail.com	2025-10-23 08:37:33.330367	\\x89504e470d0a1a0a0000000d4948445200000200000002000806000000f478d4fa0000000473424954080808087c086488000000097048597300000ec400000ec401952b0e1b0000001974455874536f667477617265007777772e696e6b73636170652e6f72679bee3c1a0000200049444154789cecdd779c5d55b9fff1cf39677a2f299399f45e2021408024400041aa0ad20441141114b988a2f2131b5ee52a162c5745d40b8a2082f46a201008e995f4903669934ca627534e3ffbf7c74e3440cacc9cb5cf3ee5fb7ebdf62b214c9ef54032673f7bedb59ee541449c9605540183816aa0061874c8cf0b813c20ffc09577e0d772dc4836054581fd077e1e043a81e60f5cbb815a60db81ab31d1498a241b8fdb0988a499fec0f1c0a4033f4e04c603b96e26251fd20eac035602ab80d5077ebecfcda44412490580487cc603e7006703d3b10b00494d31602d3017987fe0c76d6e2624e2241500223d3304f828f60dff6ceca97d495f9b817f01af026f015dae662362900a0091631b0a5c015c094c41df37992a00bc013c093c8f5e17488ad30799c8e10d05aec2bee99fec6e2a928402c04ce01fc07307fe5944445294173817fb092f0258ba7475e36a031ec45ef829222229a41ff02dec055f6edf4c74a5f635177bd6c887888824ad71c0dfb0f78ebb7de3d0955ed756e076a0081111491ae381c7b11bc8b87da3d095de570bf03da018111171cd78e011f47e5f57e2af66e01ea004111149981ae051f4c4afcbfd6b2ff045b4464044c451d9c057b0fbc4bbfdc1af4bd7a1d77ae0024444c4b88b808db8ff41af4bd7d1ae67b00f86121191380d065ec0fd0f765dbaba7bed076ec3ee43212222bdf019eca62c6e7fa0ebd2d59b6b2ef6d6541111e9a6bec0d3b8ff01ae4b57bc971fb80bcd064802e82c0049759f00fe88ddcd2fa979bd3e0a0a0bc9cf2b202fbf80fc03575e5e013eaf8facac2cbc3e1f3e9f0f9f2f0baf57f780eeb02c8b48240c40341a25140a1eb84204037efcfe2ebaba3af0fb3be9eaeac4b22c9733ee9699c067817a97f39034a6024052552ef06be016b713399c9c9c5c4a4bcb292d2da7a4b49cd292720a8b8af178f42de7a6582c467bfb3ef6ef6f63fffe36da5a9b696b6b21168bba9ddae134621701afb89c87a4297d1a492aaa019e024e733b9183b2b2b2e9d3a73f7dfaf6a76fdf2a8a8ad4ef2555c46231dada5a686969a4b1610f2d2d8dc46231b7d33a2806fc10f8ef033f1731460580a49ad3817f02556e275258544c75f560faf5aba6bcbc524ff769221289d0d454cfdefa3af6ecd945381c723b25809781eb8156b71391f4a14f2c4925b702bfc26ef0e38abcbc7caa6b8650533384b2b20ab7d2900489c5623436d6b3bb6e3b7bf6ec241a75f555c166e063c006379390f4a1024052810ff83d70b31b837b3c1e060c18c4d0a1a3a8a8ecab27fd0c150e87a9abdbc68eed5bd8b7cfb507f116e093c0db6e2520e9439f6492ec72b14feebb2cd1036767e73064c808860e1b4d7e7e41a2879724d6dadac496cd1ba8afdfe5c6ae8220f079e0b1440f2ce945058024b312e039e0ec440e9a9f5fc8a851e3193868283e5f5622879614d3d9d9c1d62d1bd8b1634ba2170e5ad8fd027e96c84125bda80090645581bdf029612bfd7372721931722cc3878fc1ebd5616dd27d7e7f175bb6ac67fbb6cd892e04ee03fe5f220794f4a1024092d160e07560742206cbcecef9f78d5f4ffc128fcece0ed6af7b973d7b762672d85f027762cf0a88749b0a00493655c03bc0c8440c3664c848c68d9b44764e4e2286930cd1dcd4c09ab5cbd99fb8c5820f005f464580f480e639259954006f908003518a8b4b9972ca190c1d360a9f4fdf06625641412143868c20272737518d85a600c5c06b4e0f24e9439f7c922c0ab05b9e9eece4205eaf8f51a32770e289d3282828727228c9701e8f87f2f24a060d1a4e5767071d1dfb9d1e722af6acee5b4e0f24e941058024833cec057f673a394869693953a79d4d75f560ede59784c9cacaa6a66608f9f9053437ed757a36e02ca00358e0e420921e540088db7cd87dfd2f70729061c34773d2c9a7939b9be7e4302247545a5a4155d5205a5a1a0906034e0e751e76b7c0b54e0e22a94f0580b8ed3ee046a782e7e4e472d249d3193e7c8c9efac5755e8f877efdab8945634e7613f4009760770bdce1d42092faf489286eba1e78c4a9e0e5e57d3879cae9e4e5e53b3584488f747575febb736043c36ed6af5b49341a716ab866ec75019b9c1a40529b0a0071cba9d88b951c9993afae1ecc09934fd30a7f491a9170986028f8be5febec6c67d5ca25f8fd9d4e0dbb01fb7bcdf11588927af4e9286e1800ccc2def667dcb0e1a39934e914bc5eaf13e1457accb262877def9f93934b55550dfbf7b51208f89d18ba0f301e78c289e092da540048a2e562ef551e6b3ab0d7eb65d209a7306ad404bdef972462110c04881de1d0209fcf47ffaa1a3abb3ae8eaec702281b1400098eb4470495d2a0024d17e0c5c693aa8d7eb63ca2967525d3dd87468915eb32c8b402070ccad7f1e8f977efd06100a06686fdfe7442a67631700b54e0497d4a4c72449a43380d9182e3cbd5e2f274f399dfefd6b4c8615894b3416251808f4f8b8e0cd9bd6b263c7562752aa0326612f0e14d10c80244c39f6013f652683fa7c3e4e397506fdfa559b0c2bd22b9605b158845028483814ea558c8aca7ec4ac18fbda5a0c674709f6191b4f9a0e2ca949330092287f07ae3119d0e7b3a7fdfbf6ad3219366358968585653fa15a16f683aac5811fd0b932dd6301c42c62568c683486a9ff6f9b37ad63c78e2d46627dc017803f3b1158528b0a004984eb80bf990ce8f1789872ca199af63f06cb8a118bc588c62cac58d45e886659893eb35e7a69c3fa95ecde6dbc974f27701cb0cd7460492d2a00c469fdb0f722979b0c7afcc493193a7494c99029cfb22ca2b128b16894682c86158bf5f8fdb32417cbb258bd7a294d8df5a643bf069c6f3aa8a416ad0110a7fd16bb1b993123468c65d4e8092643a626cb22128b128984098542844221a2910831ddf8d386c7e3a16fdf2a5a5a9b4c9f1f3002d80aac321954528b6600c449d3817730f8f76c40f5204e3a697ac6eef3b72c8b682442241a211a8dba9d8e2448281464e992b904025d26c3366337096a30195452876600c42959c0f380b1157aa5a5e59c72ea8c8cebf06761110947088543844241a2d1a89ef0338ccf974579791feaeb7799fcb32f002a81174c0594d492599fa492485fc6de736c44565616279e342da37afbc7a25142c120feae4e42a120313df167b4a2e212c68e35f62d75d0678129a6834a6ac89c4f5349a42ae0690c1ef433f9c4a95456f633152e89d94ffbc160907024acd5faf23e45452584c361f6ef6f3315d2038c03fe622aa0a40ecd008813ee064a4d051b3a745406b4f8b5088743747575110c058959baf1cbe18d1c359ea2a21293214f07ae321950524366aea412270dc43e7fdcc8d37f496939679c711e5e6f7a4e56599645241c261c09a1d7fad25d9d9ded2c59fc0eb198b1d7425bb06702c2a6024af24bcf4f5571d34f30b4edcfe3f170daa933c8cb2f30112ea95896fdc41f0c06899afb10970c9193934b567616cdcdc616f057003b80e5a6024af2d32b00316930f07953c1468c184749a9d1fe4149211289e0f777110e8751bb5de9ad810387515edec764c8ef621fd72d1942058098f45d20c744a0c2c222468f39ce44a8a4118b460904ba08067b7e429cc8e18c197bbcc96db1460b78497e2a00c4041f76d39f1b4c059c38e994b4d9f2675916c160007fc07fe0b01811330a0a8a183a6cb4c990dfc4eee12119400580f4460ef051e097c05c60df811fb34d041f3868187dfaf43711ca759148047f57179148c4ed54244d0d1e3c82fcfc4253e18600579a0a26c94dbb00a4bb7cc045c067b00f11297664109f8f73ceb924e517fe599645301424aa1bbf244053533dab562e31156e1970b2a96092bc340320c7d207b807fbe8d017802b70e8e60f3074d8e894bff9470f2cf2d3cd5f12a54f9f2a2a2afa9a0a771270b6a96092bc5400c8915400f702b5c0f7b1f7f73b2a3b3b8751a3c63b3d8ca3c2a110012df213178c1c69f47be77693c12439a900900ff262f7f1df8addd1af2851038f1c358eec6c239b0812ceb22c02013fa170c8ed542443151597d0afdf0053e12e018c0593e4a402400e7502b010f82d065bf976475e5e3ec3868d49e490c6c4a251fc7ebf8ee715d70d1b3ec6d451d959d80705491a53012007dd0e2cc2a593c1860d1f9d92dbfe229130fe801f4bbdfb25091416169b9c05f83c5a289ed654004809f6c97dbfc650139f9ef2f9b2183264a41b43c7251cb25bf98a2493c18347980a350298612a98241f150099ad0a780bf8a49b490c1e3c3ce5defd878241bdef97a4545c52467979a5a970579b0a24c9470540e61a0b2c0026bb9984c7e361d870a39dcc1c66110c04084774689a24af41e666012e479d01d3960a80cc3402781318ea721ef4ef5f4361a1636d058c0b040244a2dadf2fc9adb2b21f7979f92642f5453d01d2960a80cc33109845926cf11931729cdb29745b20a095fe921a3c1e0f03aa079b0a7795a940925c5400649612602649f0e40f505d3d988a0aa3c7993a26100ce8e62f2965c08041a6b6045e847603a425150099c303fc15488a567bc5c5a54c9ce8ca8ec31e0b06036aeb2b29272f2f9ff2722305763530d14420492e2a0032c7ddc0a56e27015051d997a9d3ce213b27f957fe0783019de42729ab5fff6a53a12e3015489247ea755e91de38197814970bbea2e212c68d9bc471c79d4456969193831d150e85b4da5f525a5e5e01bb766e3571364536f097f8339264a2ed1de92f07788804fc597b3c1e8a4bca282e2aa1a8a8045f56165959d9e4e6e4525c529a52abfd239188f6f94bcacbcecea6bcbc0fcdcd0df1869a0ae403fef8b39264a10220fdfd3fe078a7827bbd5efaf7afa166e010faf4e99f720d7d0e271a8b110c06dc4e43c4883e7dfa9b280072805380b7e3cf4892850a80f456057cd389c03e5f1643878e64c4c871e4e6e63931842b2c2b4630a0871c491f1595fd4c859a8e0a80b4a20220bd7d1f28341db46ac0408e3bee24f2f30b4c8776956541301034f1be542469e4e71750505044575747bca1a69bc84792870a80f4351cb8c964409fcfc771c79f64f2b091a4120e8788c6b4d75fd24f45655f1305c054ecedc4aa90d384b601a6afdb3058e065e7e43075da39697bf38f46a384b5e84fd2545969858930e5c01013812439a800484f45c0e74c05cbcdcde3f4d3cf33d55424e95896a5457f92d64acb8c1400a08640694505407aba06283311282b2b8b534f9d415151898970492918d47b7f496fb9b979e4e51959b3a302208da800484f9f3215e8f889534c3e3d249d48244c54a7fb4906282931f24ce0d89662493c1500e9a72f70a6894003070e65e0c0a126422525cbb20886f4de5f3243519191465c4971968898a10220fd7c1c038bffb2b373183f61b2817492573014b2f7fe89640043aff1869a0822c9410540fa39cb4490746bf0f341b16894a8fafc4b06293453001461cf324a1a5001907ee26ed6919d9dcdd0a1a34ce492a42c82a1a0db498824545e5e3e1e8f918ffc61268288fb5400a4976a0c7c7356d70c213b3bf94febebad7038422c16733b0d9184f2783ce4e5e59b08a502204da800482fc7990892ee0bff74ca9f64aabc7c2305407f1341c47d2a00d24bdc6dfa0e1e1f9aaec2e1b016fe49c6ca37d30b207d3f20328c0a80f41277015051d1178fc7632297a4635916112dfc930c969d63e4b8ee4a1341c47d2a00d2cbc0780314171b6916929442e1903afe4946cbce560120ffa10220bd14c51ba0b030ee1049c98ac58884f5f42f994d05801c4a05407a298c3780a129c2a4a36d7f22909d6564774ffa3608c930c68e8b95a41077019065e60322a9844321a2d1e831bf2e10f0d3d9b19f682c4a76762ec5c52569f9ff433297d7eb331126d74410719f0a80f4a2199d0f0887c3c7dcf6b767cf4e76d7ed60dfbe96f7fdbac7e3a1a2a22f43878da2d4cc79ea22aef2788d7c44a80048132a00243d5976b7bf48e4c827fd058301d6af7b979696c62384b0686e6ea0b9b981ea9a218c1a351e9f4fdf3292babc660a80f47c4f9881f4692669e5e056bf70387cd415ff81809fe5cbe61108f8bb157777dd765a5b1a19377e3265697c3cb2a437150072284d194bca8b45a384432102fe2ebaba3a09858ebeddcfb22cd6ae59d6ed9bff417e7f172b96cf67f3a6756a252c22294f33009292a291089168e4a853fc47b277ef6ef6ed6bedd5b89665b163c7169a9b1b183f6132c5c5a5bd8a2322e236cd0048cab02c8b702884bfab934030d0ab9b3fd8d3f9f1eaec6c67e992b96cabdda8e64222929234032029211c0e1336d0c92f168bf6fae9ff832c2bc6d6adefd1d0b087b1e326515292be5d144524fd680640925a341ac5efef22140a1a79d20ef8fd5896d9f7f71d1dfb59b6742e1b37aee956bf01119164a00240925630142210f01b5d70e7d461409665b16b672d8b17bd4d6b6b932363888898a40240928e8545c0ef27728c063ebd71aca640f1f2fb3b59b17c01ebd6ae20ecf0582222f1d01a00492a9665e10ff8b11cda6697a80381eaeb77d1d2dac4e85113e8d7bf3a21638a88f4846600246958560cbfbfcbb19b3f90d0a7f25030c09a35cb58b162015d9d1d091b5744a43b54004852b02c8b4020e0f8963abfbfcbd1f887d3dad2c4a2456f1f5824d8bbad8b2222a6a90090a410080412d25dafb3b3ddf1310ec7b262ecda59cbc205b3a9dfb3cb951c44440ea502405c170a0689c512b37daeb3cbdda9f86030c0ba752b58b162019d7a2d20222e520120ae8a4623841dda9af741e1709850309090b18ea5b5a589c58bdee2bdf756130e69b78088249e7601888b2c42a160c246dbd7d69cb0b1bac3b22cea766da37ecf2e060f1ece90a1a34c9dd62622724cfab411d784426162b1c4f5d16f6d4dae02e0a06834426ded46162e7853eb034424615400882b629695f04639ad6dc9dda12f10f0b36edd0a962e9dcbbe7d2d6ea72322694e0580b82292e0f7dee17098ce0e777600f4d4fe7dad2c5b3a8f77572ca4bd7d9fdbe988489ad21a004938cbb208f7f228dfde6a696948b9637b5b5a1a695dd244bf7ed50c1b3e9a828222b753129134a20240122e1a890089bd19efaddf9dd0f14cb12c8bbd7beb6868d84ddfbe031831722cf9f9856ea7252269400580245c38c1ddf02291302d2d0d71c72928c8a7abcb6f20a39eb32c8b8686dd3435d5535d3d84214347929b9be74a2e22921eb4064012cab22c62d1c434fd3968cfee9d46ba0c7ef5cb5f60f62bff64ece89106b2ea9d582cc6ae5db52c98ff06ebd6aea0ababd3b55c4424b5a90090848ab9d00bbfae6e9b91381fbff8a39c75c65456cc9bc9f7bff5357273738cc4ed8d582c467dfd2e162d7ccb2e04d45550447a480580245434ea7cbfff433535ed35f2945cd5bf2f274f9e08405e5e2ef7dcfd3556cc9bc98cd34f8b3b763c2ceb4021b0e82dd6ae594e47c77e57f31191d4a10240122a513dff0faaddfa9e91381fbbf0bc0f75e91b376614b35ff9270f3df00bfa54561819a7b70e2e165cbce86d56ad5c425b92753d1491e4a30240122a9ac0ce7f4d8df5c6f6d15ff5c98f1df6d73d1e0f9fbbee6ade5b31875bbf70033e9fcfc878f1686aaa67f9b2f92c59f20e7bf7d66159899d751191d4a0024012c6c22251dbff62b1189b37af37126be8e0419c3363fa51bfa6a2bc8cdfdd7f2f6b16bfc1f9e7ce30326ebcdaf7b7b176cd72e6cd9d45edd6f708871373e89288a40615009230896cc4b37ddb26ba0c1dfdfbd9ebaeecf6213d63478fe45fcf3ec6137f7d804103ab8d8c1faf5028486ded46e6cf9bc5a68d6bf1fbb573404454004802256a26bab3a39deddb371b89e5f57af9eca7afeaf1efbbea931f63c3b2b7f9ee5d77909f9f1cfbf5a3d1083b776e65e182d9bcbb62218d8df529d71d5144cc51012009e4fccd261a8db266cd5223fbfe012eb9e05c860c1ed8abdf5b5090cf7f7fe7eb6c58f636d75f7379d21cf56b59162d2d8dac5eb584f9f366b1ad7623a160c0edb44424c192e31349c490f736aca2d3e09ef86f7dfdb6b8630c1e54c3237ffc354be7bcc2b9679f61202b7382c1005bb7bec7bc796fb066f5325a5b93fbc4441131470580a48ddada8dd4d7ef3216ef9c19d3396dca89c6e24d9e741cafbff038afbff038274c9c602cae099615a3a161372b962f60dedcd7d9b279bdd60a88a43915009216ea766d33b6e7ffa06fdd19ffd3ffe19c7bf6192c7be7551e7ae0170cac19e0c818f10806036cdfbe9905f3df64c5f2f9ecd9b3936882db378b88f3540048caabdbb58d8d1bd7188d79ce8ce98e4ed77bbd5e3e77ddd56c7a772ebfbaef07f4efd7d7b1b1e2d1dadaccfa75ef32f79dd758bfee5d5a5b9bb47050244db8dfb5444cba19886befd9c041c3282c74e6dc79cbb28844cc9e0550bbf53d63fbfd0ff2f97c3cfbf73f27e4a69c9595c569534ee4d62fdc40bfbe7d58b16a2d9d9d5d8e8fdb539615a3a3633ff57b7651b76b1b7e7f175959d9e4e5e5bb9d9af44028146477ddf678c3b402bf31908eb84c33009292c2e110ab572da1b676a3f1d837dd700d138f1b673ceed11414e4f3955b3fcfc677e770cfdd5fa3b4a438a1e3f744381c6277dd76962f9bc7fc79b3d8bc799db18e8b2292389a01482f193103d0dcdcc0bbef2ea27d7f9b81acdeafa2bc8ca71ffb23858505c66377476e6e2e679d31959b6fbc8e9cec6c56ad594f2018742597ee884422ecdbd7caeebaedecdd5b473014202b2b8b9c9c3c3c1e8fdbe9c9076806400ea50220bda47501100c06d8b4710d9b37af23ead0b1c20fffe17e4e3d79b223b17b223f3f8f73664ce74b9fbb9ae2821c56afdb48973fb9f7ea87c361f6b5b5b07bf70e76efde415757271e8f87bcbc7c1503494205801c4adf95e9652970523c014e9b7a367dfb56194ae7fda2d1288180bfc7bf2f180cb073c756eaeab639ba1afd53577c82c71ffe9d63f17b25ec87a89f2e7f803f3ef2143fffdd5fa8dbd3e076563de2f3655159d9973e7daba8ace847764e8edb2965acf6f67d2c593c27de305b811106d21197a900482f695300c462315a9a1ba8df5b475363bdb1ce7e4752535dc5aa85b3a8282f73749c1e0bb543ec3f87f8044321fefa8f17f8e9ff3ecc966d3b5d4cac773c1e0f45c5a55456f4a5a2b21fa5a5e59a1d4820150072287de7a597942e00fcfe2ef6ef6ba5a5b589c6863d44228939bd2e373787d9affc93a9a7c4f5bfce19c1b6c31ea2108bc578f69537b9fff78f307fc9bb2e246646565616e5e57da8a8ec4765655ff2f2dc597b91295400c8a1b2dc4e40d2473018a0b1b19e8e8efd844321b27372c8c9c9253b3b079fcf87070f81a05d00c4a23102812e02c1008140171dedfb0985dc59ecf6bbfbef4dce9b3fd6114f50f27abd5c7ec9b95c7ec9b92c5cba8a5ffcfeaf3cfbca1b44a3093a71c99048244263633d8d8df500e4e51550565e4179791fcaca2ac8cf2f74394391f4a50240e21608f8d9b07e157575db1c9faa37edb65b3ec7e73f738ddb691c9ed5bdf50ea79d3c917f3ef40bb66edfc5af1f7c8c87fefe2c1d49d84ba03b02812eeaf77451bfc76ee99c9b9b477979256565959496553ab640552413e915407a49f82b80969646962e994b30054f93bbf2b24b78fce1dfe1f325e966984800223dbf91efdbdfc15f9f789e071e7e920d9b6a1d48cc3d5959d9949496515a524e49491925a5e564676b516177e915801c4a05407a496801b06f5f2bf3e7bd91b077f5267decc2f378fab13f919d9dc49360e17688f6feffad6559bcf9ce627efff013bcf0afd94422e9d9cf3f3fbf90d2d2328a4bca282a2aa5b8b884acac6cb7d34a4a2a00e45049fce927c92c168bb162f98294bcf99f7fee0c9e7ce40fc97df3c782387b1d783c1e3e72e6a97ce4cc53d9b57b2f0ffef59ffcf9d167a86f48af237ffdfe4efcfe4eeaebebfefd6b7979f914159552545c42515109c5c5255a4f20f2019a01482f099b01d8b9632befbebb289ea15c71c5a517f3b73ffd86bcbc5cb753393a2b02c1fdc6c346a33166cf5dcc1f1f798ae75e7d9370d899864ac9c8ebf5929f5f48616131f9f9051416165358544c4141213e5f321783e66806400e95197febc5b89d3b53efddf237efb8959ffcf7b75263df79cc991bb3cfe7e5dc19a771ee8cd3d85ddfc85ffef13c0ffffd3936d7ee7064bc64128bc5e8ec6ca7b3b3fd7dbf7eb05b6161610965e515f4ef5f436e6e9e4b598a248e0e03921eb32c8bb6b666b7d3e8b682827cfeeff73fe7be1fde9d1a377f8068c8f121aaabfa72f71d37b171d18bbcf5fc435c7fd5c7282cc8bcd3fd2ccbc2efefa2a9a99ecd9bd6b160fe1b6cdcb886582c3dd74c881ca402407a2c180c38da92d7a4716346b168f64bdc78fda7dc4ea5fbaca863330087e3f1789831ed641ef9ddbdd4af9bcda30ffc988bce3d83acac24dd1de1b0582cc6ae9db52c5d329770d8f9424cc42d2a00a4c75261afbfc7e3e18b9fbf9e25735ee6b8f163dc4ea76762ee2dac2c2a2ce0d3575ccccb8fff8edd6bdee4b73fb99b69534e489d9913833a3af6b3f2ddc5584768c62492ea5400482f586e277054e3c78e66cecca779e0573fa6b020055bcb4693e3f8dfbe95e57cf9f39f62de2b8fb065e92bfccfb76fe7a449e3dd4e2ba1f6ef6f65c78ead6ea721e2082d0294b4515e56ca37bf7a2b5fbbed66727252741fb81585247cf73c6c700ddfbae326be75c74dd4eea8e3999766f1f44bb358b874159695dc0561bc766cdfc2a041c3f17a13f3bc6459164d8df53436eea1fd605bedec6cf2f30be9d3b78afefd6b92b77995a414150092f28a0a0bb9e3cb3771e7edb750565ae2763af14992a7ffa31936b8863b6fbd813b6fbd81ba3d0d3cf3f22c9e79e90dde59b82ce5ce22e88e7038446b6b139595fd1c1fabadad85f736acfad04e855028486767074d4d7bd9ba6503a3464da07f558de3f9487a530120296b60cd00be74d367b8f9739fa64f6585dbe918604124f90b8043d50ce8c77fdd742dff75d3b5b4b4ee63e6ecf9bcf4dadbfcebcd79b4b4ee733b3d63dadbf7395e00ecdd5bc7fa75ef1e738d4d281464eddae57476b6337cc458477392f4a602407acccd19dfecec2cce99319d9b6eb8964b2f399facac34fa2b1c0d92eceb2b8ea6a2bc946b3e7921d77cf242a2d118f397bccbcbafcfe1e5d7e7b066fd66b7d38b8bd32755b6b5b574ebe67fa86ddb369197974f75cd100733937496469f9e923889bd491514e473d61953b9fc131771e9251750515e96d0f113c202227eb7b330c6e7f372c6692772c66927f293efdec18e5d7b98356721b3de5ec81b7316d1d0d4e2768a3de2f33af7ceddb22cdedbb0aa57bb6b366d5a479fbe55e4e42479674b494a2a0024e90cac19c0f113c672fad4539871fa699c72d2e424efdb6f402ce8eed48ac3060f1cc08dd75ec68dd75e866559ac5ab791596fdb05c13b0b97d3d9abdc4628000020004944415495dcc54ff500e7a6ff9b1aeb3ff4cebfbba2d108bb76d6ea5580f44a9a7faa4ab2cacecee2931fbf88fefdfa50d5bf1f03aafa316ac430268c1b93fa0bf97acac23efa3743783c1e264d18c3a40963b8f3d61b0885c22c5eb186b90b973377d10ae62d5e41dbbededd109de0f37979f2c11f5053d5976020c8bef60e1a9bdb68686aa36e6f0b3bea9aa9ddd548edae865ec56f6cdc13577e8d8df52a00a4575400882b8a0a0bf9c75f7eef761ac921eab7b7ff65a89c9c6c4e3f7532a79f3a19b01b4dadd9b09939f397316ff10ade59b89cba3dbdbbb99a70f925e731b0ba3f007905f9e415e4d3bf7fdf0f7fa165118d460806837474fad9dfde454b5b3badfb3a686eeda0b1653f0dcdfbd9d3d04a5d430b91883de5dfd1115fb1d3d9d94e2c164bd83645491f2a0044dc64c532eae9bf3bbc5e2f13c78f66e2f8d1dc76d33500d4ed6960f1f2d52c79772d8b97af66e9bb6bd9b7bfc3f15c4a4b8af8f177bfd2bd2ff678f065655390954d416111fd8ef1d6c08ac58846a3541f7f2e1d71fea7844241f2f232ef1c07898f0a00113745ba48e595ff895233a01f975dfc112ebbf823c08185739bb7b164c51a96bebb8e55eb36b272ed7bb4b6993b4239372787471ff831c3870c3416f3501eaf972caf9788817335d2bd199338430580885b62e1849cfa978e3c1e0f63470d63eca8615c7fd5c7fefdeb3bebea59b56e23abd66e64e5da8dac5ab7914d5bb71389f4ec263bb0ba3f7ffdedbd9c73c629a65317491a2a00445c6141b8d3ed24d2cea09a2a06d55471f17967fefbd742a1305bb6ed64c3a65adedbbc8df7366f63c366fbe71f9c31183b6a189fb9ea63fcd717aea5a83005cf9110e9011500226e0875daefffc5713939d98c1b3d9c71a3877fe8df3534b5d0d0d842381261d8e01aca4a8b5dc850c41d2a0044122d128098a6fe9341bf3e15f4eb930e6da4457a4efb46441229163db0f04f44c45d2a004412c58a4138791adc88486653012092101684daf5de5f4492860a0011c75910da9fd1ddfe4424f96811a088a32c08b6ebe62f224947058088530ebef3d7cd5f4492900a001127c4a2076efe7ae72f22c94905808869d120443ad5e25f44929a0a0011632c08fb21aad3fd4424f9a9001031c18a41b8036211b7331111e916150022f18a450ebcefd79cbf88a40e150022f18885ec53fd74f3179114a30240a4b7a2410877a1d57e22928a540088f446c46f5f2222294aad80457a4a377f1149032a00447a42377f1149132a0044ba4b377f1149232a0044ba231ad4cd5f44d28a0a00916389850facf61711491f2a00448e2616815007daea2722e9460580c8911c6cefab9bbf88a4211500d20b1eb713488c70878ef31591b4a50240e470c25d3ad84744d29a0a00910f8a8674a4af88a43d15002287b262f6e13e2222694e0580c8a1c29d68d19f886402150022074582f69e7f11910ca0024004eca9ff889afd8848e65001200210d1d4bf886416150022b1104435f52f22994505806436cb82b00ef91191cca30240325b340056d4ed2c4444124e0580642e2b061135fc1191cca402403257348016fe8948a652012099c9b2201a743b0b1111d7a800482f7a9cedae88df2e0244a4a77444669a5001905ee27ea11d0967c076382b06313dfd4be6c9c9c93511a6c14410719f0a80f412f72936a170e8985fe3f1c43b8acba2413dfd4b46cac9c9c5e7cb8a37cc2613b988fb5400a4978e7803f8bbe20e91dc2cf4ee5f3296c7e3a1b2b25fbc615e32918bb84f05407ad9196f80d6d6e6637e4d4a3f3cc782f62b00910c3578c8f0787e7b2df0a2a154c4652a00d24b6dbc01dada9a89c58e7e834ce9570051edfb97cc5652524e55d5c0defc560bb81dd0145a9a5001905e36c71b201289b0b7bece442ec9c78a424c5dff44c68e9b486969454f7fdbdd68fa3fada800482fcb4c04d9b973ab8930c947effe4500f07a7d4c3e712a03aa0777e7cbf701d7033f71362b49341500e9652f10f7dd7befdeddec6b6b31904e92891e7b878348a6f07abd8c1b378993a79c41d58081e4e6e67ef0dddf3ae047c008e0d1c467284e5301907ee69908b26eddbb26c2248f68588bff440ea3a4a48cf1e32773dff7bffe5da012180614001380ef02c75e192c29490540fa31b242b7a9692f3bb66f39ecbf4bc95d00313dfd8b1c4975dfb2e0a4a9d93f055a806d80cec8ce002a00d2cfab18e80808b066cd32dadbf77de8d7537217800a0091233a61dcc03f9f7df63d11b7f390c45201907e3a80574c048a46a32c5af8167e7fdc0d06dd158ba4e8b48588f306f62f0b0c1e97fb35b7f390c45301909e1e3415c8efef62c1fcd97476a67087c068069c6f20d20b1e8f87a99386de75d555f7688a2c03a900484fb330d013e0a0cece76de7967268d8df5a6422696a5cf3691c33979fca08d5fbaeb87bf713b0f71870a80f414037e6e3260381462e182d9ac58be80603095f6d35b708cce862299a8aa4f497878ffeab3dcce43dca302207d3d8481d6c01fb46bd73616cc7fd37458e7c4c2d81d4c45e4a0bc9c6cce3c71d4a76ef9f6b7f7b89d8bb8470540fa0a03df772270349a428b85632994ab480264f9bc9c7ffad8ef7df1ae7b9e713b1771970a80f4f62830dbed245ca50240e4dfbc5e0fe79d36f6c1af7cfb7f7ee8762ee23e1500e9cd026e033277159c0eff1101203bcbc785674cf8d537fefbbe2fba9d8b24071500e96f1df06db79370851545efff45a0b4383f76f18ce3bf72e7f77efc55b77391e491e576029210bf00ce003eee762209a5e97f11460de9d736e58421e7dc74fbf756b89d8b2417150099c1026e041602235dce257134fd2f19ac303fc79a3669e4532326e55f77d555dfcbdcd78072442a00324733703eb000e8e7722e09a2fdff9279b2b37c9c387ed0ba11d59557dff48d7bd6b89d8f242f150099652bf66b809940a9cbb938cfd20c80648e92a2bcd87123ab570c195079cb17befebd656ee723c94f0540e659049c03bc867df677fa520740c91053c60ffcdd8481d3be79cb3db774b99d8ba48e543cd855cc9804bc040c7463f0f2b2525a76ae756e002b06c136e7e28b185231ea745adbf6c71b6604f60c9f48b7691b60e65a094c06e6b89d882374fcaf88c851a900c86c4dd80b037f4dda6d98d7f4bf88c8d1a80090007007f05160a7cbb998a319001191a352012007cd02c601f76217058e8a39bd404f0580a48868d4c8f782b6bc488fa90090437502dfc12e04fe8483670804434ef725d12b00490da150d84418c78b76493f2a00e470b6013703c3819f017b4d0f60e8434f24e585c22a00c41d2a00e468ea806f626f15fc38f077ec8e82718bc56244224ef6ead72b00497ee170c4d4ebb0a08920925954004877448017814f03fdb10f168a9bb3b3002a0024f9197a1566a102407a410580f45414980bf8e30dd4d1d9197f3647a2fbbfa4808e4e238dfb82e86fbcf4820a00e9ad96780334b7b49ac843246535351be956a9f7ffd22b2a00a4b7e22e009a9ae30e2192d29a5b8d1400ed268248e6510120bd15f762c0a666cd0048666b34f33d607c978e64061500d25b7a052012a7e616233300f5268248e6510120bd157701b07b8f3eb724b3edd9db64224c83892092795400486fc5fd0a60fb8e3a137988a4acda1dbb4c8451252dbda202407a2bee4797daed3b4ce42192b2b6edd86d228c6600a4575400486f6d8937c0b6ed469e7e445256ad9959b03d268248e6510120bdb529de003beb763bdc0e58247985426176d71b797857252dbda202407a6b0b711eb9178944d8b4a5d6503a22a9e5bd2ddb4c1d05fc9e892092795400486ff981b85f60ae5ab3de402a22a967f5bab827d1c05e8b63e4802ec93c2a00241e717f82ad5ebbc1441e222967f57a2305809efea5d75400483ce2fe04d30c8064aa556b379a08a302407a4d0580c423fe0260ad0a00c94c8666008c541192995400483ce29ebfdfbe63177bccac84164919757b1ad85967a47f8f6600a4d75400483c169908327fd15213614452c63b0b979b0a652c90641e1500128f4620ee7d7cf3162e31908a48ea98b778858930f580da694aafa9009078c53d0b306f810a00c92cf3161929008cccc049e6520120f18afb4368c5aa35b4777498c84524e9b5ed6b67d53a236bf754394b5c540048bc16c61b201c8ef0e6dbf34ce42292f466cd5968aa0360dcdf7b92d9540048bc5600c17883bcfada6c03a98824bf5767cd3511c60296990824994b0580c42b08ac8a37c8bf66bd157f262249ceb22c66ce3632dbb50e6833114832970a0031e1ed78036cdfb18b751bd4d344d2dbaa751ba9db63a4efc5eb2682486653012026bc6a22c8b32ffecb441891a4f5eccb6f9a0a35d35420c95c2a00c48477807df10679f299170da42292bcfef9c26b26c20480392602496653012026848159f10659b566bd5e0348da5ab56e23ebdedb6222d4db4097894092d954008829465e03fcf3d9974c8411493a4f3c6bec1597a6ffc508150062ca2bd85b93e2f28fa75e30900a80917dd622465896c593cf1b99fe07301648329b0a0031650f764f80b86cd8b8d9ccd900960a00491e6fcf5fcae65a236dfb37026b4d041251012026bd6c22c81f1f7e2cfe20311500923cfefce833a6423d612a9088c7ed0424ad8cc36e501297fcfc3cea362ea3bcacb47701626108b5c79b8688116dfbdaa93eee1cfc81b81b66021c876600c410cd008849eb31704089df1fe0b127e278628a86e34d41c498479e7cc1d4cd7f0dbaf98b412a00c4b4474d04f9df3f3c4cac57d3f816c442265210895b2c16e381879f3415ee1fa60289800a0031ef3120ee3bf0c6cd5b79e95fbd682d10096a01a0248de75e79930d9b6a4d8533564988800a0031af1930b2e1f917bf79b067bfc18a41c46f62681123ee7fe06fa6422d0236990a26022a00c419463ef5e6cc5bc4a2a5dddd596841b80303ad08448c58bc7c0df316c7bd33f6a0074c05123948058038e145a0c544a0fbeeff5d37beca82603bc42226861431e247f7f77006ebc85ad0f4bf384005803821083c6c22d0732fcd64c9b29547fe022b02c1fdf68f224962d9ca75bcf49ab1f37afe02e8dd9618a702409cf22bec4382e26259163ff8f1fd87f917310877d94ffe5634de61448cfaf6bdbfc1b28cbc8eb20063530922875201204ed9053c6d22d0cb33df60c1a225f6147f246037f909b6413480def94bb299b778053367cf3715ee0decf6bf22c6a90010271de6d1bd77be7dcf8f21b41f225d76a73f912475f78f7e6332dc6f4d061339940a0071d212e01d138166cf5dccb32fbf61229488639e7c7e2673162c33156e1df6825a1147e82c0071daa5c0b326020d1f3290b5f39e252f37d7443811a3fc8120e3a77d826d3b779b0af969e0efa682897c906600c4692f00ef9908b475fb2e7efda0819302451cf0f3dffdc5e4cd7f2bdafa270ed30c8024c28dc0ff9908545c54c8faf9cf5333a09f89702246ecd8b587f1d32fa5b3cbd86ebd9b813f990a2672389a019044f82b068e090668efe8e4963bffdb44281163feeb5b3f3679f3df053c622a98c891a80090448802df3515ece5d7e7f0cf175e33154e242e8f3ff32a2ffceb2d93217f82dd4c4bc4517a052089341f986a225055bf3eac9bf71ce5652526c289f44a734b1be3a75f4a439391ced760af97391e034db4448e4533009248df3115a8bea1893bbe739fa97022bdf2956fdf67f2e60f7017baf94b82f8dc4e40324a2d300d186122d8cab51b193b6a18c78d1b69229c488ffcf385d7f8de4fba735855b7cd01fe9fc9802247a3570092682761370832f277afbcac84956f3dc5a09a2a13e144ba65dbcedd9c70d615ecdbdf612aa4059c8afdbd2192107a052089b60c435b02015adbf673fdad77138bc54c851439aa6834c6f55ffa96c99b3fc0e3e8e62f09a65700e28679d8bd010a4d04dbbe73375eaf87b3a64f31114ee4a8be7fdfef78f4a9974d86dc8fdd31b3dd645091635101206ef0037b81cb4c059cb36039279f309ed12386980a29f2212fce7c9b2fdff53fa68efa3de84eec53ff44124a6b00c44db3808f980a565e56c292d71f67c4d041a6428afcdba6ad3b38e5a3d7d0b6cfe883fa62ec85b151934145ba430580b8690cb0123076bacfa4096398ffeadf28c8cf33155284ce2e3f532fb88ed5eb37990c1b064e0656990c2ad25d5a04286e7a0f30ba997fe5daf7b8faa66f108d6a51a098118bc5b8ee4bdf327df307f839baf98b8bb40640dcb610f824d0d754c08d5bb6b3bfbd830bce996e2aa464b0dbeffe098f3cf1a2e9b01b816b8188e9c022dda50240dc16c16e80f23920db54d085cb5651515ec2a9274d34155232d0fd0f3cc28f7ef147d361c3c0c7816da6038bf4840a0049060d40277081c9a0afbfb580e3c68e64dce8e126c34a8678f2f999dc72e70f4daff807f836f084e9a0223da5024092c522ec2e81a34d05b42c8be75e7d9313278ed3f640e991d766cfe7aacf7f8348c4f80cfd1ce016ecce7f22aed22e004926fdb0770518edeb9b9f97cb2bfff8bd1a0549b7bcf9ce622ebee6cb0482c64fe46d0326013b4c0716e90ded029064d2007c1ec34f47fe40908f5f773b0b976ac1b51cddfc25eff289eb6f77e2e66f61ffddd6cd5f92865e0148b2d9049401a7990c1a0a8579f2f9994c3be504860eaa36195ad2c45bf39670f135b7d1d1d9e544f89f03bf7122b0486fe9158024a32ce05f18ec127850417e1e4fffe597da2228eff3ea1b73b9fcb35fc51f30fee40f76c7cb0b50b73f49329a01906414035e02ae002a4c060e47223cf5c2eb4c183b42bb030480a75e7c9dab3eff7582c19013e16b81f3b177b9882415150092acfcc06bc0f580d1bebed16894a75e7c9d8ab2524e39f17893a125c5fcf191a7b8f12bdf231c76a41f8f1ffbc97fab13c145e2a50240925913b01ab81ac30b562dcbe2d537e6d2d9e5e7dc334fc5e3d1dbb04c128bc5f8da777fc677fee77f89c51cd991676117afb39c082e62820a0049769bb09fa4ce7322f8fc25efb27afd263e76fe5964676739318424994030c8f5b77e9bff7bec192787f97f80f116822226a9009054301f18024c7622f8864db5cc7c731ee79f3d8db2d2622786902451bba38ef3afbc855973163a39ccaf81ef3a398088092a002455bc048c032638117ccfde46fef6cf9738e1b8318c1836c88921c465b3e72ee682abbec4966d3b9d1ce609e066d4e94f52800a00491516f002700a30c28901fcfe008f3ff30ad959599c7eea64ad0b4813966571ef2fffc48db77fcfa93dfe07bd89bd734527fc494ad0279ca49a426026e0e846fef3cf9ec6c3fffb4306f437764ab1b860777d2337dcf66d66bdede8943fc032e01c60bfd3038998a256c0926a3a818bb03f701d3373f67c269e7939cfbf3adbc961c441cfbdf22693665c9e889bff0aecbdfebaf94b4ad10c80a4aabec0dbd8eb021cf5c5cf5ec54fbfff558a8b0a9d1e4a0cd8dfdec1d7bfff0bfef4b7a71331dc32ec1d2aad89184cc424150092ca0660370b3acee981060f1cc0033ffb0e179d7b86d343491c5e9cf9365fbeeb5e76d6d52762b8a5c047d1cd5f52940a004975e5d83b04a62562b02b3ffe517e7bdfddf4eb63b443b1c4696f6333dfb8e77efef6e48b891a7239f6937f4ba20614314dbb0024d505b0b75e4dc1a1dd01875af7de161efafbb314151470e2c47178bd5a46e3a64824ca6fffef71aebcf14e162d5b9da8616763af43694bd480224ed00c80a48b1ce06fc055891a70ccc8a1dcffc36fe8b5804bde98b388af7ee7a7ac5ebf2991c33e0d5c875d788aa4341500924e7cc01f809b1239e8272e3c9b7befbe9d09631d9f801060f5fa4ddcfda3dff0d26b6f277ae85f00dfc43ead5224e5a9009074e3017e007c8704fefdf67abd7ceab20bf8fe37bec4e8114312356c46d9b0a9961ffcec019e7cfe3562b184de8363c09dc0af1239a888d3540048baba02f80b76e3a084c9caf271dd1597f0ad3b6e522160c8864db5fcf8d77fe6b1a75e261a4df8c377277003f6d4bf485a510120e9ec78e0796058a207f67abd5c74ee197ce5e64f73ee8cd3123d7c5a98bb6805bff9e3633cf3f22c376efc005b80cbb08fa416493b2a0024ddf5019e04ce762b81534f3a9eafdc7c1d9fbce423e4e6e4b895464a0804833cf3d21bfcfa8f8fb278f91a37537915f834dae32f694c058064021f702f70979b4994951673d527cee7d61baf66d284316ea69274366caae52fff789e871e7b96c66657efb916f053e0db40d4cd44449ca6024032c9b5c0ef8152b7139936e504aef9e4855cf1f1f3a8ead7c7ed745cb1676f234fbdf83a7f7ffa15162e5de5763a00cdd83b489e733b119144500120996608f00870a6db8900f87c5ece9c7a32575f7a3e975e740efdfb56ba9d92a3ea1b9a78ee953779e2b999cc59b02cd1abf98f6616f059a0cee53c441246058064220f703bf6546f52bd941f3f66041f3b7f06e79e791a33a69d4c767696db29c5251a8df1ee9a0dcc7a7b212fce7c9b054b5726d34d1f20087c1ff819dadf2f1946058064b293804781b16e277238e565259c7eea64a69f3299e9a74ee6e413c693979beb765a4715080659b2622df316ad60dee27799bb68396dfbdadd4eeb48d6602ff44b8af70f2289a60240325d01701f702b90d48dfd737372983c712c93268c61e2f8d11c3f7e14c78f1b455969b12bf9b4ed6b67f5fa4dac5eb78955eb36b272ed7b2c5fb59e5028ec4a3e3d10c29efdb917b5f4950ca60240c436057b81e0c96e27d253d5557d19367820c386d4306c700d4307575333a03f7d2acae85b594e6545198505f93d8ad9d9e5a7a9b995a696361a9b5bd95ddfc0b61dbba9dd5147edf63ab66edfc59ebd8d0efd17396a2e700bb0ceed4444dca60240e43f7cd837877b81329773312a2f3797fcfc5c4a8a8bf079bd6465f9282eb29b24b6777412894489c662ec6fefc0ef0f1208065dced8b856ec6da07fc6deea272222f221fdb1770ac4b06f16ba52f78a1ef8b3ec8f88884837cd0056e0fe4d4c57efae3780133ff4a72a2222d20d1ee063c04adcbfa1e9eadeb51eb8f2707f982222223de5033e076cc3fd1b9caec35f3b802f1cf8b3121111312a1bb819bb639cdb373c5df6b515f80a9077943f3711111123aa70ffc697e9d7c1463e7ae21711918429c7fd1b60a65eb381cb48f2c64d22c92eb51b8d8bb847379fc4da8fbd9def01d4c44744445c3404f79f84d3fe1a3bbcc68fdd9ca9a89b7f2e22d24d9a0110e91d771af067804155955c76ee14aebce0544e9f72fc0ecf982b1e743b279174a40240a477f4446a50bf8a12aebaf034aeb9681a534f1885c773a04bb965e9ffb38843540088f44e4dbc012a4a8b185855c1ea8d3bb12ccb444e29c3e3f170c2d8215c78c6242e3cf304a64e1a85cf77b8651596665a441ca20240a47746c51b60ea09a378e9816fd0d0b29f3717aee5cd456b7963e11ab6ee6c30915fd2e9535eccd9a78ce7c2334fe0c2332651d5a71be72d5956cf8e3114916e530120d23ba3e30d306c605fc09efefed44553f9d4455301a8ddd5c8ecc56b59b46a33cbd76d63f5c69d0443e178874b28afd7c3b8e1354c9b3c9a69278c66ea09a318336c40cf0359b12c6bd32bb99e5117a5ddf184226e530120d23be3e30d307c60bfc3fefab0817d1936f02c6efce45900842351d66cdac9b2b5b52c5f57cb8af5dbd8b4bd9ee6b68e785330a2bca490f1236b183f6220e3865773dca8419c72fc084a8b0b0c44b7c0139e86bdf75f440c520120d273451838656ed8110a800fcacef23179dc50268f1b0a9cfdef5fdfd7dec5969d7bd9b2b381ad3b1bd8b2732f3bf734b3b7791fcd6d1d34b7b5d3e98fffc1b97f6529557dca1858554175bf726afa9553d3bf826103fb327ec44006f4edc6547e5ca217a20240c4381500223d371dfb4c80b81c7c05d05ba5c5059c387e18278e1f76c4af0904c334b7b5d3dcd641475780ae40e87dffbed31f24148e5054904b7e6e0ec585f91417e691979bfdef9f67f95ceeb41b8d4d77370191f4a40240a4e7ce3ef6971c5d5e6e366387559bc8e598e3d4f4afa0a67f85e36339c6e319e8760a22e948ed4c457aeeb278039c3a7124b939714f22a42f8f17b20a20af1cb28b4b2deb1e7d568918a66f2a919e3915033b00a64f8e3b441af2802f17724b20b702b20bc0e3032865dbf453dcce4e24dda80010e9994f9b0832fde4e3c06322521af0e6404e11e457404eb1fdcf1ffc7fe3895dee4a6e22694c1f4122dd570c6cc73e0ab8d7bc5e0f4dcb9fa6bcb410a221fb8a852053ba017abce0cd065f8efda3a75bcf21db187ade708fc76301fd80814014fbcfa3cdc16c45d29616018a74df1789f3e60f70dae47194971e6871efcbb52f805818a261bb188845e21d26b978b3de7fd3efa1fd1d5d434f1f37fc37c047f9f02b98e5c0c3c01f81d0077faf881c9e0a0091eec903be6622d0d5979c75f87fe1cd3e70732c002cbb088886edc22016b17f2d2578c077e086efc9b66ffe9ede4f36beb57025d77ee5c7ec6968b9ed085f72e281eb36e04a6075af0713c9202a0044bae736a02ade203e9f972b2f3ab31b5fe939a42038c08ada8540ecc08f56d4bedce4f11e78bacfb217ec1dfcd19097de5cc46537df4324daadffce31c03bc079c012634988a429ad011039b61a603df61a80b89c3d75126ffefd67f167f46f16c462078a81d87f8a02cbb2ff19ebc0da825ecc1e78bc079edc0ffce8f11db8c97b81833f3af711b265fb6e265df4453abb023dfdaddb81c940abf9ac44d2876600448eede718b8f9c351a6ff7bcd035e1f70aca7ee0f14021f5c70f8ef297a8f7dc531656fca377ff2e7dedcfc018600bf01ae379b91487a71ffbb5c24b97d0278ce44a0d2e24276cc7f8c92221387e4a4b73d0d2d0c9a762dd1682c9e3097002f1b4a4924eda80f80c8910d061e3215ec966b2fd6cdbf9b5e7d6b49bc377f80ff037a7106b148665001207278d9c03f00234df473b2b3b8fdb3979a089511dedbbad34498fec0631838b849241da90010f9300ff00760aaa9809fbef423d454f531152eed0582c6b6f39f0dfc057dd6897c88be29443eec27c08d2603de70f97926c3a5bd8a32236b2e0fba16f8a9c98022e9400580c8fb7df3c065d49df73e487ba7df74d8b435f5c4f1a643de89037fae22a94c058088cd03fc0f709f13c197addec4e55ffc01a1709ab5f875c819538ea35f6599e9b03f01be87763f8900c7de3c2c920972800781db9d1c64eb8e3dd4eedcc365e74fc79304fbec93597656169665316bee7293613dd86b0246626f0f74b98da288bb540048a6abc1be197c221183adde504b53eb7e2e3a5bc7db1fcb9449637876e65c1a9bf7990e3d11f808f022d0693ab848aa50012099ec63c02bc0d8440eba64e57b1417e633ed24e3efb9d38acfe7e5c4e346f197a75ec3327f54f220e0d3c056e38b299a00002000494441546083e9e022a940058064a27ec09f817b81423712787dee72460ea961e2d8616e0c9f32060ee84b7b879ff9cbd73911be18f814301efb1021cd06484651012099e4e091be4f0027bb9c0b2fbdb990d3268f63c46035ab3b9ab34e9bc4cc394bd9bdb7d9a92126009fc32e0056035aa92919412b91241314019fc7de0a36c8e55cdea7b8309fd98fff9c938e1fe5762a49cccba28e2a3e7afa74f6ef33be1ee083ea81fbb11b41b53b3d98889b5400483a3b1ebba1cf0d40b9cbb91c51ff3ee5cc7bea978c1852ed762a49696fe514c829e6f5575ee6b3577e926834218bf75bb0cf127812589a880145124d0580a4931ce074e002e042e03877d3e9be1143aa99f7d42fe9df2769eb145734969f402cef3fc731fce1d7bfe49ebbbe91e8346a81a7806781e54030d1098838410580a4a23ca00f508dfdfe7602f6d3fe34ece9fe9474d2f1a398fdf8cf292ecc773b95a4d052329670e1876745eefaaf2ff3d73f3de84246008481b5c08a03d746a00e6838f0eff6a3fe0292225400885baa80a1875c83804aa0ef811f2bf9cf0afd62202bd109bae1bcd34fe4a5877e444e7646fce71e515bd13002c5c30efb01158bc5b8edc61b78e61f8f273caf1e88621703005d4013d07ce0c7266017f6ccc2b603577dc233948ca702409c960b9c084cc26ec032117b6abed4cda492d9a72f3d87bfdd7f57c6760bec28a8a2a3643c47fbcf8f44227ce1daab79f585e7139798b3f6016bb07721ac3c70e97583382a333f61c449a5c059d8efe2a7626fb7cb753321a74c39f554962c5ae448ec3bbf70053fbffb66476227b3404e256d9513f174e3a3291c0e73fb4d9fe3d927fe9180cc5c11c45e80381f9807bc855d288818a13e00122f0f30197b1ff5bdc0ff621fbf3a0d184c9a4edddff1f56ff0d0a38f6101f3e6cc311e7fc1f27519d72d3094554c4be509783ddd3ba3cce7f371d1272ea5a9a18195cb97399c9d2bb2b0bf87a663372cfa3a702ef6ebb30ef4da40e2a402407aeb24e00ee08fc05dd8bdd58790e6274c666565f1935fdccfd7bf75371e8f8733669cc59eddbb59b9c2e8a1354066750b8cfaf268ea730a5e6fcffefa783c1ecebbe862f2f3f399fbd66c275a0627132ff6f7d8b9c017b1b7b756636f59dce3625e92a2f40a407a6210f6befaeb81112ee792701595953cfce8df39eb231f79dfaf47a351aebbf20a5e79e945e363e66467f1d2433fe2bcd34f341e3b59c4bc59eced3b0daf37bec9a2d75f79992fdd701d1ded19d9bf6733f037e021ec058622c7a402408e250bb818f802f6fefa8c9c353a69ca141e7af431860e1b7ed87feff7fbf9c4051f65d18205c6c74eef6e815eeafb9e86272bcf48b42d9b36f2c5cf7c9ad52b5618899782a2c0bf803f619f72a9b6c67244693d5d2b7129c69ee2df043c875d0464dccddfebf5f2d56fdec5ccb7e61cf1e60f909f9fcfdf9f7d9ed1e3ccbfb36feff473f18ddf61cbf6ddc663bb6d6fe549c66efe0023468de6e5b7e6f285db6ecfd45d143eecefd5e7b0bf77efc0fe5e16f9908cfc0e91a3aa02be0adc0c94b99c8babc68c1dc76ffef020a74d9bd6adaf0f5ab073c70e2e39eb4cf6d4999f854db76e811fecf267dac2b9ef70e7976e61cba68d8e8d9122da8007815f027b5dce4592880a0039a80ff04de0cb4081cbb9b8eefc8b2ee26f4ffc93dcdceeed608c01c198fdf30d6bd7f2898fcc605f5b9bf1bcd2a55b604bc918c285358e8f130c04f8dcd557f0e6cc7f393e560ae8047e07fc14bb299164b8b4dca2253d528c7de3ff0a9a2afcb74824d2ed9b3f40e490c5e763274ce0af4f3fc7d5175f403010309ad7b2d59bb8fc8b3f48ba6e81fbda3b99bd6025eb37ef201c89505e5ac4c9c78fe6944963f1f9deffa6b1ad6818a1c29a843c7de4e6e561c5620918292514627faf7f09f8157621d0e16a46e22acd00642e2ff059ecbdfb55eea6927c4acbcad856dfd0ad6d6996654fff7f7003dacbcf3dcbcdffbfbdfb0e8fa25aff00fe9ddd4db2e9210508a4d21312122054c52820a8481550441111113b2845844bb18028828805c1de455111eb55b9de9f88f4ae70450402842a1d1252767f7f0c11b2d924bb7bde33333b793fcf73ffb818de9990c9ccbb67cef99ec13749d9bdce286981478e9dc4c467dec0bb9fff8882c28aa17529097530e6ce01b8fb969eb058148f52fe28391c0ea4d5ab2d6534c6040e007814c0db5007b1580d53e3267531006ab0c86750d712fbede639329d2f2cc40d0307223636aedaaf2d85fbdd5f9a344b434c5c1c7ef8e66bf2f3dbb27d17ce9c2b44b74eadc96b7bead7f5bfe3b2fea3b17ced569494b86f724e9c3a8baf7f5a8d5fd6fd866ed75d87a2baad356d5a766cdf86f973e768763c3f130ea00fd449835bc1cb076b1c6e006a9608a813815e841a20c2aa90ddaa355a646757fb75c5a8f8e9ff9f1aad73e07038f0ebcfe64a0b5cb1ee77741f3201274f9ff5e8eb77ed3d889fd66c47bf1b0721202040f2d95df4efafbfc47712f2194ca61ed424cfda007e0650a4efe930ad70035073f480ba2eb82bf8d58f476ad7a9836b7b5c5fedd79554133e7759ee95f8fbe8516c5cbb86e8cc2efa7ef97aa424d44576ba76b94c7fe51dc0d5b73e82e3a7bc7b7d7c60ff7e14171521b7ebd592ceaca2375f998f2d1b6b6c26803714006da1be16dc05609bae67c334c13900e61701e04d005f42cd15373d8bc58290d0d0eabfb01a6b56561fea538aca3ffd5feaf159b3d1cd8366c25b4ea7132326ccc1f7cbe9a388dd397afc24ba0f9980c37ffbf64e7dc1bcb93890bf9ff8ac2ab77e8df8664dc1a161b0da8c33e152b278008ba1260af2a46093e34f82e6d601c0bb002a4fb0f153119191888dab8de89818c427242039b501521a34405a4626d29a67e0bd375ec3bfc63c24740cabd58a3d878e203c22a2d2af297202a51ec6cf179c3b8781d775f7a8b1f0961669810585e7d1f596f158b1ee77a13a131f7f12f78f1d4f7456953b7dea149ad68d85437015c0bd4fcd41afdbefc2bebffe44deffb661ef9fffc39eeddb70306f374e1efb1b278f1ec1e913c789ceda507602180c40ce96974c7735a6adad612c002602980c03ff8cad562b925252919c9a8ac4e414242627a36ebd7aa8151d83e8d858d48a8e86d56a4564641414458162b1202232d2a3da39ed3a089f5f696929d6af5d8bdcce9d2bfd1a6ff69e090e09c13b9f2e41cfceb9d8b19d7684b52c2df0974fe6a06132fdf40e87c389210f3d2dfcf00780b5ab56129c51f536ac5d23fcf00780f49cf6b0050622a5593a529a553ddfe2dc99d3282d51d377cf9c380e4769294e1e3f86537f1fc5a9637fe3e8c17c1cdcb31b07f376e3e09eddc8dffd979197293604b01cc0140033e0d96017f323867d38309f4541fdd4df43ef13b994d56a45d3f474b4ed78395ab46c89e6995968929686e01039994319595908b2db85d7e1af59b5b2ea06c0cb7a51d1d1f870e957b83eb713f950f8a1a3c7d1fdb647a5a4058e7fea557cf2cdcf24b5f6e5ed21a9539d75048d4660901d8d32b33cfefa90b08ba3e6e151eacfa0aab8a3f305e7b07bdbefd8b97513766cda80adab7ec1ae6dbf19a929b0415d2adc0ec0100027f53d1d46891b00736901f5fd5d23bd4f04001a356d862eddaf416ed7abd1a67d872a87d2a9050406a245764be1e1f6d5553c449cf0ed2351fdc424bcffc557e8d3f54af2f5e93bf7e4a3c7b049a469812fbdb314b3167e4c520b0002bd085812b16eb5f8c875e3ac96b00506129c8d7b41c12168da2a074d5be5fcf367e74e9fc2d6552bb0e6c77f63f50fdf62df9f868832ee05600d807e50970c3213e04980e6d10bc00ae8f8f0571405addab4c5d499cf60f5f61d58be692ba63d3d0b9dbb75d7f4e15fa675bbf6c235d6ae5e5de91ef30e8101d1b48c0cbcf5c96708b2d36d8453a62c2db0a8587c23b82f97adc203d35e2438ab8b1a3494bfaba1d3e9c4fad5ab85eba4b511bf86bc15121e81b65dafc1bd3366e3ad35bfe3dd0d7f60e4e34fa359eb369a9f8b8bc6007e85c1461799efb8013087fb017c0a35ea5373c9a90d3061dae358bd7d07befe7905463e381a4929a97a9c4a39addbb613aef1f7d1a3f86be79f6eff9be8206dfbcb3be1a537df81d54abf1af7fbe5eb316cdcac4a9b174facdbb20383ee9f8ed252dae1e88eb9b9a4f5dcd9b5f34f1cfbfba8709df41cf16b48547c4a030cb8ef21bcf8c3af786fe30edc3e711aea26a5e8753a61009600b847af136074b801f06f16a8c13ecf43e34c07abd58aebfbf6c3475f7d8b5f7fdb8e07c74f4062728a96a750ad9cf6349fded6ac723f944cb184a6479fbe7872ce5c824a15bdf7f9328c9db1d0a7bfbb67ff21f41cfe2f9c3957407a4e51d1d1e833e046d29aee504d344c6fabfd084055ea26a7e2963113f1ee863ff0d4275fe3f2ebfb40f120ae9a98156a98d82cf033c4aff10fcf7fd900bc0575bf6fcd84868561f8bdf763c5d66d78f58345c8edd2d5a3bc7c3dc4d74f407cfd04e13a9535005453a2878e1889d1132612552befd9859fe0d9859f78f5774e9c3a831ec326e1c0e163e4e773ffc363111a263f7d7a7d253f336fc4d54b405c3df1eb4706c562419b2edd30ed9d4ff0d69adfd17bf83db087683e00f830d4bc000e94f353c6bc73b3ea0402f808c02d5a1d30243414f78f1d8fb57fecc413cfce4172aa7f440bb46e273e84bba6924f9302a3eb158c9b3c15370f1d4657f01263672cc47b9f2ff3e86b8b8a4b70c3dd8fe1b73fe867ea77e87405468e12cb66f0d4bad5e22300696df41ffef744fd068df0c033cfe3fdcd3b71e303631014ace96edeb701f810ea3d89f9196e00fc8f1dea463efdb43858406020ee7a6014566fdf81898f3f895ad1315a1c960cc53c80dfb66cc1b9b31533ef9d84315a8aa260e6bc17115fafaa4563be713a9d18366e56b569814ea713773e3207cb566c243f070088898bd36423a07367cf62db56f189ea4678ffef8dc898588c98f614dedbb803fdeeba1f36edf65ce80f750e12fd8c5626153700fe2500c0c700aed3e2605774ee821f57adc5b4a7672136aeb616872447b112a0a4a404ebd7adabf0e70a712cca8c29ff9216935b545c823e23a660e586ca0388a6cd7d176f7ffabd94e303c0979f2ec6f4c993a4d52fb371dd5a949488af80486f2b1e26a5875ab5ebe0dea7e6e0f55f3723b74f7fad0edb03c0e700b459e3c9487003e03fac00de07401f28ef2239b5013efcf21b2cfafa3b3449d37ea7394a592d5b2180601db7ecf4bab716be829766cf927a8c7305e7d167c454ecdc935ff1f88bbfc763cfbf2bf5f800f0c2aca7f1f6ab0ba41e832200c8161888c62d5a129c8d7eea376c8cc96f7c88e98b966ab56aa03bd479493c27c04f7003e01f14a8936da4b6f356ab15231f1c8d9fd66dc4951aeed8265390dd8e8c2ccf93dc2ae36e2220d568f68fdf7e8389a31fa429568db2b4c043472f66d7fff8cb06dcf9c81ca12583de7874d40358f6ddb7d2ea53040035cacc42a0848c063db4bbfa5abcf6eb26f41bf9002c12969cbab811c002f03e337e811b00ff30036a0ca734a90d1b61e94f3f63eacc67a4c5f3eaa535c152ae35040f1577b66cdc8811b70c2219b2f654595ae0e9b305d8fac76edc70f76328d6f0f82525251871cb206cd92867aec13a821500e939c65afe27ca1e128a7b67ccc6735fff84f814e913788701784cf64198386e008c6f0400a95ba7dd3c74187e58b516addab49579185d3801b424980878e8e041e4edd95deecf443fe2e4efdb8b5bfbf6c2d93367042b796fdd961de833620a7adc3e09274f579ce028db99d3a7716bdf5ec8dfb797b46edeee5d3872f890709d0c3f5901e0ade66d3b60c1ffad45b741523f4f00c024a88d0033306e008ced1aa8811b5284848662fedbef61f6fc059aaccdd6420980420770c6019c2c054e94008d5bd3dccc57af2cff6e59a4013875f22406f7e98983072abe8fd7cab2151b91977f58b7e31f3c908fc17d7ae2f4a9536435293efd03c0e5eddb213e0088b301515620d4020428e618d70e098fc0f8975ec78457de92bd64703e80ae320fc0c47003605c4da0aeaf95b261536ac346f8eabfbfa0cf40f9a96c329500287000a74a816325c0a912e09c03287200a54e750420212515b175ea0a1fcb751e80c5c7a741717131460cbe8964a99abfdbb6752b860ee887e2a222927a149335636ad741c285286b9b02045b80082b106b03ead880181b1066f5ff86a0ebc0c178e1fb5f502fb5a1ac4394ad5a32c4e664ac226e008c290cea5aff4819c573bb74c5b7bfac445a46868cf2d2153981b3a5c0f152f5815fe0004aaa99bfd682e0f5866b2090af37ff71f7dd839f7e90b7dccedffcf2df9f30fe81fb486a5104006557b174545180400508b7a80d41ed00758420c8e29fcd4083e6997869d94ab4bce22a59878882ba43a9b9261699043700c6a300780d8094f57737de7a1bdefd7c2922a3a2649497a6c8a90eeb1f2f05ce9402e79dde25f16511bcd3ddbc71230a0aca67e37bfb0b347bfa13f8e0ad3784cfc56cde7ff3753cf7d474a11a850505f86df366e173c9f662d2a805ea0841b415a853d60cf8d9c84078542dcc5cfc0dae1f7aa7ac43b400f0aaace2cc77dc0018cf830006ca283c66d264cc5df81a02b44b0813e2803a9c7fbc447de817397c8fdfcd6e271eea525c5c8ccd2e33d7bd790db0f883f7f1cce3d384cfc3ac664e9b82c51fbceff3dfdfbc7103c9ab84163e368b0a2e34033675ee40b805b0fa492760b5d9306af64bb875acb4a0a641e01d040d871b0063690e75c91f2945513075e633183369327569294a2f0cf19f2c5127f451ac4ecf6c9503ab4d7c3ac5ea95bf96fbff9efe02ad5cfe33468fbc53b3b5f6fec8e97462d4883bf0f37f3cdbb7c0d55a979f8d2fac361b325ab616afa3a8f304e26c40ad0ba30246a7280a863e3a15f73f3d575664f3b30032651466bee106c038ec5027fd91a68f582c16cc9cf722463e389ab2ac14454e75e6fec9b2217ec2daf6901034692e3ee7c19789803bb66fc36d03faa1e8fc79e1e39b5d717131ee1c7c13fefcdf76afffeefa35ab858fdfa479068243e976d55300d82f8c0ac4dad4b90246d7e7ce7bf1c0ac79329a003b8077c071c186e10797638d311300e9ac3c4551307dce5c0c193e82b22cb9a20b4bf6ce94aa9ffe65c96a431008e4d20028a83a11f0c8e14318dca7174e1e3f5ef917b1724e1c3b869b7bf7c4d123de2d515cb7527c0220c535529900459d2b106703ec061f11e8356c24ee7f7aae8cd25900c4267b3032dc001843070034d3a02f31f1f12731f4aebba9cb9229813a8bff8c43ee83bf4c16412050fefe7dc8dfbfafdc9f592a39f7c282020ceddf0f79bb77091fb7a6c9dbbd0b83fbf474bb0ba33bfbf7e6916ca4d4b2bdfc0d806c0a50ab6c44c0c08d40efe1f7e09ee9cfca283d0ac065320a33ef7003a0bf20a839ffa43f8b518f3c8afbc68ca32c49a6d4099cbeb0844fbb00daaa977779c393d7000e870377df760b492e7d4db569dd3adc7bfb10381c8e6abf76fd6af1e17f8066b9a8a70214f5d540b4d5b8bbe7dc70f783b86914f97dc402e01500e2bb743121dc00e86f12806694057b0f1888f1538c39dbbcf0c2707fb10e73e1921a3442ad9858e13a151a00375f3365dc187cf3c512e163d574df7cb10453c78fadf6eb280280a2a26390d440fbcc9a208b9a27106e35e6f2c1e1939f44d78183a9cb3607f0087551e61d6e00f4950ee29cff0e9daec0bc57df90358bd767c51726f89dabfec39c348aa2480904721d0158f8c2f358f8c2f3c2c761aa05f3e6e2d517e755f935eb09465ab2dab6d3f5f726cc02c40618efb580a2287878ee2bc8684f3e6aff28d4c453a6136e00f4351b6a5c2689fa894978f5838f1018649c49b64e00671dea90bf16eff9ab431108b471fd7a14b9ac372fbb677ff3c5124c193746f818be4a0d91b3a78302e0f2983a526a7b62cab831f876e9176eff5b715111366fdc207c0c8a6b43940dea6b81082bdd76d31402ed764c7d6b11e2ea2550960d82ba3490e9841b00fd5c0fa03b55b120bb1daf7db00831b1715425859540cde83fafe3a77e5759045b0317161662cba64de5fecca2009bd7aff7f89db52ce31b67627832fd87aa19e939b83ba529795d4f95969662e490c16ee7546cdeb801e70b0b858fd1b27d47e11a54422f440d0718a809a855bb0ea6bcb50801b41f30ae87bae919d3013700fa0800308bb2e093b39f43764e0e654921850e75929f113ef55f2a33a70d2c16f1cbdef535c05e2f67adcb92181c8a69cdb2717d1dba4f6a23539a625ce30ca4848493d5f445d9aa8abd2edb32530cff5bad56346f251e0044c906b5090833d05d3a2da72dee7ee219eab2cf42d2a667ac6a06bab46a94e100c83e4ef5e8d317b70c1b4e554e88f3c20c7f3ddff557252c3c028dd2c4b759b87422e089e3c77153ef5e24fbd08b4a0c0e855551f05256079221fbebea24e0f916ead0788aa4d70bde3872f8106eeeddb35cae02c54a8b86cdd210161e215c478670ab9a266894c180dec3ef41c76b7b52964c07308cb220f30c3700dab3439dfc42a26e7c3dcc7a693e553921a54ee0a4439f19fedea0780d50d60014171763c8a01bf1c7f66dc23545d9ad56c405a9419281160bde6c7939b222a37daed72a32061fe6e4c2a6a8b789baf660d82dfa2f58734d565c4b100044b157844c760b1017a0660818c198790b1153279eb2e4447042a0e6b801d0de480064e3b37316bc8a5ad13154e57c56ec044e3b0087c11ffe00cd64af3dbb77e1e08103b867f81df8ef32dfb2eba9d5b78794fb941866b361514e2e1a857affc9362938145fb4ef8230dbc539aa0a8064038c0200eade0a0f8d1c8143070f605fde1ee17a2d72b45bffef2b2bd457027603dcb5236362f1f0bc059425930048db8e90b967804ba9460901e1dad781b70cc1555777a32ae7b3f31766f9fbc3c31fa049040480db070fc22281ddeba8250557ccb0af630fc6771dbb21de1eec719dc4e0507cd7b11bead92b6ee16e84d700653ef9e03d8c183c88a4165548946c0ad42d8743f41f8841bbabaf4597fe34fffe174c00e0f985ca847103a0ad610048d652c5d5ae83694f934fc6f15a81435de6e74f529b3443786494709d15cb97139c0d9d44370d80150a5243c2b03ab727bac4553f64dbad763d2cef741d9a8645bafdef466a000060d52fe23f83f0c828a434d66f8583b714009116756e80deee99311b9104e15a17d403701b5531563d6e00b463859a814d62f25333751ffa3f5baa3600fec662b1204bc3c857adb86b002c17528aeadb43f07dc7eef8be6377dc543f15f52ff9749f141c8a41090df04d87abf16d876e6eeb9431ca2b004a596dda92ac0cd15a980588d4797260546c1cee9c4aba83f968f0734933bcf4423bbd0134a428d4aa4d5bf41f441ecde99533a5eaf6bdfe2aab6d7b2cffe1df7a9f0629f72300e5efa55de2e2cb8d0414391c08f4e2e167b411000a149342f51262511b8093a5b4db677be39a9b6fc392575fc28e4de2614c5093017b02e01c6d0d70a7a59d87298a288a82c79f9da36b64a9bf3ffc0163a4be5173db0054739d78f3f00780e4601336007e7e2d045b2e2407ea747cc562c17d4f3d47794f22b957b2ea7103a08d16004862c67aded01fad8926b1f9e2ac091efe80baeb9b51f64b689a914952a76203a0c04afc2d528d00507dcfa2a8f687d05bc88526402f19ed2fc3653d7a5395eb042083aa18ab1c3700da184151c46ab562eca4c914a57c52e000ce9be0e10f001151b5906a80895f0d9ba563d4d42785eb5c9a0150467df8d376005459000f3f31134d335b109c9198064dd31011554befd32011a2f3c4c0db273e06856e2ec51d548558e5b801902f18c0cd1485fadd38088d9ba55194f25aa1c33f27fc55254be7a55f7175e3b1e0b32f71fae409e15a09f6d00a8ffaea86ff7d41950570e2d8df98bf7829ea26248a9f9400aa25a146116651f711d0434ab374e4f6e94f55ee56a8a1694c226e00e41b0040f82386c562c1a8096401825e29721837da57849eef7e4342c3307ff152c42726219f20c82631b8e29a7dab22e7d79be23540fe9edda853af3e5efce8338484ea37afc01f0280bc156105ec3abddd1a326e12d5abb518007d290ab1ca7103201fc974fdeed7f744c3c6da6f9d5deaf4bf75fe9ed26bf6b7d56ac533afbf83b4ac6c00c07e8206c05d089045d2b4309206606f1e00202d2b1b73def910569b3e0b928c1e01ecab28ab3e3b0926374d47bbabafa52a473272ca2ac70d805cb1003a5314baebc1d11465bce2809af06792d7fe15344e6faecb0630139e9983ab7a5cdc4c65bfcbee76be4870b702c022e709901452794e80a72efd9e3b75bb06539e7b51b8a6b742c3c2d150a7576ab2298aba8110f524504f0cb8ef21aa52dd01f8be9905ab16370072f50541d64266cb96687fd9e504a7e339278033256a136056168b45f32d60ef183d16378fb8a7dc9fe5e7e509d7f56509a0af5209b605deb77b77b9ffdf7fe81db863f458e1badec8689d03abd500717a9258157524406bd99dae44a3cc2c8a520150f3539824dc00c83590a2c8ad7768bf4746810328d1fca8dad37208f89a7e03307a5af919ff0e8703f97b29e600546c006c921a008a2c8003fbf2e070946f2f474f7b12d7f41b205cdb53661dfebf54a0a2cff2c0eb6e23db9e9ce41ecadce306409e0800b9a245424243d177e04d04a7e3b922873aebbf26d06a2260664e1b4c9fff5a85c8d923070ffcb3adad08d706c0a228500c3c07a0e8fc791c3d74b0dc9f592c16cc58f0065ab52789cca856b61f27007a23d4a2fd0e825d07dc8c203713537dd01980f9d2a70c821b0079ba421dc212d2bbff40844768f79eda01e0ac595ffabba145205072c3c698bf7829ec21156f8814c3ff6e330024e6c2516501ecdf5371e423c86ec7bc8f3e4572c3c6c2f5aba2280a3273da483d8691445a01495342dc0a8d88446eef1b284a0582681e15ab881b007948a6c2f6bb8974bbcd6a9d2d059c35a801888e8d43622ac9160d6e4545c7e0e5c54b50ab921dd3f6efd9257c0cb7190012eff6545900fbf376bbfdf35a31b158f0f957888eab2d7c8cca24356884e8d83869f58dc6027507412d75ee4f3672790d5521561e3700f274132d10131b870e9daea038178f143a81e21af4f02f232b0c26c86ec70b8b3e434aa3ca976f52ac0070b70450e608004097055099c4d40678f9e3256e474d2864eb1c02a507bb454d0bd44aabdc2e88a269b2c8d615b2f2b80190a3098024d122d7f7ed079b46eba31d305fd29fa7643c0c2c160b9e5af866b5efb3cbd6c38b4870f3aed52279bc97a201a82eff2033a70d66bcf2ba94ad7acd90ffef8b700d97065a6d36aafd01520034a028c4cae306408ecb288a74efd98ba28c47ce396ad6d0ffa5b2dad037000f3d361dddfbcef08b1900000c7849444154561f8b4a3102e0c936c0d428b2003c4940ecdeb77f85951314b2db9a7f05803b1600e11adef53b5edbb3fa2ff20cc93d9595c70d801cc2d398edc1c1e87079278a73a956b1539df95f5335cdc84470a8f803ad4cffa17760d8a8311e7dadbb8970ded23203a04c0ac152404fbf7777d90922ec212168d2bce66e36176c018234baf36777ba1201414114a5b80190801b0039841b808e57e42258d2fb4f57674b35398c61596d3634cf6e4552eb8aeed77a9c6ae7703870609f8c1020fa6d805da5108401e5efdd53210ba032139e9e8d2bbad3bc0ace68d95ab7e861a3d02a1bc01e128acc0e242166daac0dad61b801a0170140385f34b74b578253a95e81c3dc697f9e6a7fa5f84aa3b4ac6ccc7efb038f1f2e470f1d94920120631b6057b2b2002a63b5d930fbed0ffed93f4144c7cedafc6e19990dda4d08ccb992e4dfbb3900f1ae9395c30d00bd4c10dc7ddb76903fe2e574aa33ff19d063e04d4293cde21393f0f2275f78b5b31dc5f0bfdb0c00c9c3ff80dc2c80ca848486e1e54fbe407ca2eff36bad562b7a0cd47669ad51855b65b789aa0c9a11000b809afbde46126e00e8b5102d600f0e4646b6f8279dea14386beec43f57c90d1ba3f7e0213efdddf08848cc5fbc14b5e3eb79f5f72a5b07ef8dfaf6908a190092b601be94ec2c80cad48eaf87f98b97223c22d2a7e3f5bd75281253794239a0defcc3347815d024ab15025d9a541f09df5b5979dc00d013be48b35be72020403844b04a0e00e779ecbf9cf1339e418326cdbcfa3b81414178eebd45689cdedcebe355b50ede535a6e03ec4a761640651aa737c773ef2d42a09793cb1a364bc7d8e94f7b7d3c330b55e43f04028282d084668e4d26451176113700f48487a932b35b529c47950a1de6dde6d7571151b5f0ead26fd1ac85673b99858547e0850f3f4587abbaf874bcead6c17bc2ed0a008d325fb5c802a84c87abba60de078b3ddeceb979cb56786de9b73e8f1c9895a2a87b05c8d6388ba401e05700c4b801a0279c2b9b9621f73ae74fff95ab5b3f011ffe6705464d7d0275ea27b8fd1a8bc5826ebdfb61f18ab5b8fceaee3e1f4b5a068006730000a2570002ff069dba5d83c52bd6e0ea5e7d2b9dbf513721110f3d361defffb8dceb57343545a855fe832025cdfb1132371a51146117d5ecb530f48201d4152d929e21f755d779fef45fa5c0a0208c18f308ee183d16abfefb1fecdcfe3bf2f3f2600b084083264dd1a17357d4ada439f006c546405a6e03ec8a640440702264626a43cc7dff631cdcb7172b96fd805d3bfe40497131ea2525a161b374b4cbbd0a56ab0efbe1fa11054088153823713970039a7b5a3c802000e24b6718006d2681d624cd006c132db2f3e8098486c9db01f344092ffdd39bc3e140abb870e165805fb5ef8ad65131fffc7f8ba220369064c255b57e3d760497fdfc95508dc0a020ac3f725a4adc2ff39cc3091c2e91f7c1e0eca993e8951c53fd1756af29803f280a317e05402d55b4404c6c9cd4877f91931ffe4670e4e0013919001af6f45a670130792c8aba59902ca1119108af154d512a99a208537103402b5eb440628adcebbb909ffe864031fc1f64719301a0e1a6ef7a6401307942255f3af1c9291465ea5314612a6e0068b9dff4dd0b8934bf246e953a81127ef96f0814190009c16e3200341c01d02b0b80c91160016c122f9fba4929146584efb1ec226e0068095f9c75ea0a0f2254ea3c3ffc0d63ffee5dc23592dd6cc8237b1b60577a6501303964c603d7aa2d3c3f1a0048261230153700b4842fce5ad124efc9dce2a57fc691bf97620540c5cda2646f03ec8aa40120f8b7603482255e3e11d124cf6e6e0008710340ab966881e81839d777919397fe1909450640828e190065285e01ec23180d61342c0082245d429134f7366e00087103404b78fd556494700fe156317ffa3714391900f2b7017665842c00464bd66a80709a7b9b366b5c6b086e006879174eee86b7f9e69e70421d0160c6e0743a71601f7d03a0c536c0aedccd43f0d6817d797038b843350a590d404020c9bd2d90a208537103404bf8e20c0ca4bfbe4b78f8df500e1fc8c7f9c242e13a151b00ed73bd380bc07c2c0002255c4a01341f6ee83f21d560dc00d0127e7a074868008af9e96f28149b00b9cd00d0601b60579c05604e32e60110dddb780480103700b484ef843272cbb90130967c8206c05d068056db005f8ab300cc2948c293c16a25d97a86f7af21c40d80c939a0060031e3909501a0650ae0a5380bc07c6c0a3f1c6a02fe199b5c09cfad321c6919003acc0100380bc08c14c89907c08c851b00932bd1fb045805b23200b4da06d8555248c573f116c5bf09a315c04f07d3e31fb1c9f1fb7fe3a198f0e6ba02c0a2285074dadd3b856029204f02341e9e6d677edc00981cbfff3716a7d38983fbf70ad7d1731b60572921e1c235f2f7eee12c008309b0689d2ac1b4c60d8089f1c3df78a46500e8340110e02c00b35200cd932599b6b80130b152bd4f8055202d0340c75f65ce0230af006e004c8d1b00132be11100c3a158ee96181c5a310340c7df64ce02302f1b3700a6c60d8089f12b00e3a198ed9ee46e17409d7f95390bc09c02f43e012615370026c653aa8cc76c190065380bc09c780e80b9710360623c02603c723200b4df06d815670198137d303933126e004c8a3ffd1b938c0c003db60176c55900e6a47024b0a9f1cfd6a4b801301e6919003a0fff039c0560667a8f2e3179b8013029270fff1b8eb40c001db60176c55900e6a563c404934cff3b0793829fffc6232b03408f6d805d71168079f143c2bcf8676b520eee000c475606809e298065380bc0bcf4bfba982cdc0098143fff8d475a068001e600009c0560563c07c0bcb80130296e008c475606805edb00bbe22c0093e29b89697103c09846646400e8b90db02bce02302783f4974c026e004c8a9b76e39192016090873fc0590066659c2b8c51e306c0acb803301433670094e12c00c6fc0b37008c69c0cc190065380b8031ff629cbb076326262d03c040bfc19c05c0987f31d0ed8331f392960160a05f61ce0260ccbf18e7eec19889993d03a00c670130e63fb801604c03723200f4df06d815670130e63fb801604c033232008cb00db02bce0260cc7f7003c09806a46400186cf81fe02c00c6fc0937008c49262f03c078bfbe9c05c098ff30de1d84319391950160846d805d71160063fe831b00c62493950160846d805d71160063fe831b00c62493960160c039009c05c098ffe0068031c964650018651b60579c05c0987fe0068031c964640018691b60579c05c0987fe0068031c9a4640018f4e10f70160063fe821b00c624ab29190065380b8031ffc00d006312d5a40c80329c05c0987f30ee5d84311390960160e0df5cce0260cc3f18f836c298ff93960160e05f5dce0260cc3f18f72ec29809d4a40c80329c05c0987fe006803189e46400186f1b60579c05c098f17103c09844323200d44fffc6ee00380b8031e3e306803189a4640018fbd90f80b30018f307dc003026919c0c00e3ffda72160063c667fc3b09637e4a56068011b70176c559008c191f37008c49222b03c088db00bbe22c00c68c8f1b00c62491960160e0258065380b8031e3e30680314964650018751be04b71160063c6c70d0063921c3e902f5cc39fb6017645f11ae0d0fe7d0467c21873c7a6f709984ca96881e2c2b37b1dc5e7ce89d609769c3f1254527c5ab40ef3ddd15dff6b04a0b1488d7ab56b1706366d70f1e71818587a3635f1a4e8b96921fac0ffeae0f0fe28911ac7f276ec88387ff84faa7362de0b802dc2aad86345eb04179f0d01902858a644f43c1893e50b004ec1ff35d3fcac992ca3217e3d8cd5fcace98c85f8f7ffa0e667cd644983f8f5b044f3b336317e05406babe0df3f036017c5893043d844506315410dbdac26a841f16fc88c611780b38235b6509c086332b4835877fbb1f6a7cc240a047008be5f0f870004697ed674ec000ec3f7efff008000cdcf9ac9b41862f7c836da9f32639e5b06df2e6c07801c1dce97c9f52ff87eb39ba4c3f95213f9fe27e870be4caeb650ef75be5c0fdfeb70be8c79a5398053f0fee27e5e8f9365d205411db6f4f67ad800fffef45f2608c04678fffd6f823a82c2cce745787f3d9c843a878031c3bb0eeabb2e4f2fee25e0a14e334b00f0173cbf1efe0090a4cb99ca910cf57bf2f4fbff13403d5dce94692100de4d983e0be01a5dce94311fb582fa29a6aa0bfb1c80a9e0c99835412c804f51fdcdee2300b5753a47996a035884eabfff8f0144eb748e4c3b5600d30014a0eaeb612380963a9d2363422c000640bda9ef0250087552d44a009321be2696f99f1c00f3a1ae183906e004d446f165d48c094e6da17eaf9ba07eefc7a0fe5bbc0ca0b58ee7c5f49104600ad4d52e87a1de23ff02f02180fee00f4752fd3fa5af67a5e8ea025a0000000049454e44ae426082	0999999999	Sanjapamba	t	M	2003-07-17 00:00:00	0	\N	f	2026-01-07 10:54:34.287963	3	\N	\N	\N	\N	\N	\N
16	luis	$2b$12$tL3mdJRJVbWttiY1w5EWMO9tvJZDM0jUtbmV0YPxh8QX2r3A.RTU6	Luis	Vargas	1109988776	alexcharco2002@gmail.com	2025-11-15 20:00:31.714546	\N	0995544332	Machala	t	M	1997-07-03 00:00:00	2	\N	f	2025-12-21 15:17:21.177431	4	\N	\N	\N	\N	\N	\N
1	admin	$2b$12$75SOz/VrYQiGM.bAUTqAMu.nS50ag3uniN7s1jhp0Jdv8s74JBou6	Jeferson Alexander	Charco Tenesaca	0604583138	alexcharco2002@gmail.com	2025-07-24 15:17:19.36669	\\xffd8ffe10ee845786966000049492a000800000010000001030001000000b00f00000101030001000000801700000201030003000000ce0000000601030001000000020000000f01020012000000d4000000100102000b000000e60000001201030001000000010000001501030001000000030000001a01050001000000f10000001b01050001000000f9000000280103000100000002000000310102001f000000010100003201020014000000200100001302030001000000020000006987040001000000340100002588040001000000f80300000c0400000800080008004e494b4f4e20434f52504f524154494f4e004e494b4f4e204437353000c0c62d0010270000c0c62d001027000041646f62652050686f746f73686f702032322e30202857696e646f77732900323032333a30323a31352030383a32333a3035002a009a82050001000000320300009d820500010000003a0300002288030001000000010000002788030001000000fa00000030880300010000000200000000900700040000003032333003900200140000004203000004900200140000005603000001910700040000000102030002910500010000006a03000001920a00010000007203000002920500010000007a03000004920a00010000008203000005920500010000008a0300000792030001000000050000000892030001000000000000000992030001000000100000000a9205000100000092030000869207002c0000009a03000090920200030000003231000091920200030000003231000092920200030000003231000000a00700040000003031303001a00300010000000100000002a00400010000006201000003a0040001000000d801000005a0040001000000d803000017a20300010000000200000000a30700010000000300000001a30700010000000100000002a3070008000000c603000001a40300010000000000000002a40300010000000100000003a40300010000000100000004a4050001000000ce03000005a40300010000005500000006a40300010000000000000007a40300010000000000000008a40300010000000000000009a4030001000000000000000aa4030001000000000000000ca403000100000000000000000000000a000000e2040000380000000a000000323032333a30323a31352030383a31383a343700323032333a30323a31352030383a31383a3437000200000001000000184a6a0040420f0066d94b0040420f000000000006000000280000000a000000520300000a00000041534349490000002020202020202020202020202020202020202020202020202020202020202020202020200200020000010102010000000100000000000200010002000400000052393800020007000400000030313030000000000000010000000100040000000203000000000000000006000301030001000000060000001a010500010000005a0400001b010500010000006204000028010300010000000200000001020400010000006a0400000202040001000000760a00000000000048000000010000004800000001000000ffd8ffed000c41646f62655f434d0001ffee000e41646f626500648000000001ffdb0084000c08080809080c09090c110b0a0b11150f0c0c0f1518131315131318110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c010d0b0b0d0e0d100e0e10140e0e0e14140e0e0e0e14110c0c0c0c0c11110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0cffc00011080071005503012200021101031101ffdd00040006ffc4013f0000010501010101010100000000000000030001020405060708090a0b0100010501010101010100000000000000010002030405060708090a0b1000010401030204020507060805030c33010002110304211231054151611322718132061491a1b14223241552c16233347282d14307259253f0e1f163733516a2b283264493546445c2a3743617d255e265f2b384c3d375e3f3462794a485b495c4d4e4f4a5b5c5d5e5f55666768696a6b6c6d6e6f637475767778797a7b7c7d7e7f711000202010204040304050607070605350100021103213112044151617122130532819114a1b14223c152d1f0332462e1728292435315637334f1250616a2b283072635c2d2449354a317644555367465e2f2b384c3d375e3f34694a485b495c4d4e4f4a5b5c5d5e5f55666768696a6b6c6d6e6f62737475767778797a7b7c7ffda000c03010002110311003f00f554924925292492494a4962f5ff00adfd0beafc333ef2725cd2faf12a69b2e701c7b1bedab7bbe85990fa6aff00845ca1ff001c786d79dfd2afd8382db6b71f9b7ff33494fa2a4b94e8dfe32feabf56b998deabf0afb086b1994d0c6b9c7f31b7b1d651bbf737dbfa4fcc5d5a4a5249249294924924a7ffd0f55492492529727fe307eb7d9f57702bc7c183d4f3b7371c91b854d6c35f93e9fbbd47ee7b19456ff65967f22ab2b5d62f33ebcd399f5ef3f232181cde9b4518d8d23bbd9f6b73bfaffac588134095d08f1480eef02fc5ea77dc4be9bafc9b8ef7bac9758e27fc25ae74bf73ff00e1169627d4ceab743ef733181e5a65ef1fd96c33fe92ef31287ba5c19e64c7e5563638120b7e2a139a5d346dc796875b2f0b93f515be893464937107e9b46d3fc92d0b4ffc577d62cdc1eb47eade5bc9c4bf78a2a32ef4b2183d577a6e3fcde3db5576fb3fd2fa7fcdfa96addc8aac60968d39d1727f592a38b9585f58319a3d6c1bab75838ddb1edb6a73dcdfeafa4f471e424d1d6d667c200b88aa7da92492533554924924a7ffd1f5549249252970df5831ff00cb99bb5c6bf58d763ac68123f44cabdbbbf3b6d4bb95c0dbd42dea3957655ed6b497beb6b5a34f498f7b28dd3f4ac733f9c51e535166e5e24cafa0d0ff0084e0577747b329b552cce36fa7eb3723d6b034d7bbd3f56b76f66f6fa8ed9edafdeb79f75cce9eeb039ceb6a3b373b531f477977f267e9ab156163901eca9bbc9241f03fbeabbf37a68c4b77e554c634b98f24c00468edce23cd43237557f56e4635775f4d1e7aeb7168c8156466751379ace47a82c9afd2dde97aae05a5acabd4f6effa1fcb57aec3fb6630c47bbd5196f652e791048b1ed66e21bedddb7f7568554623eb6bcb038b74ddcea342abe5de31e875d59f48d05ae63c47b1c1cd1559fbbec794e121637d18e503476d767d292593f557a865f52fabf85999b1f69b1845ae02039cc73a9366d1edfd2fa7ea7b56b2b00d8b69114483d0d292492490ff00ffd2f55492492529713d53a3e4f4dc9bad68dd876da5f53e4437d43bbece593bdbb5fbff00e0d76ca9759a6bbba5e532cd1be99703c439bfa4acff009ed6a6ce36193164303e077790cacdfb3e3876d7bc3b42da86e71ffa959f667641a46ec271aa3404d6607f25db91b1f36ab9bb1c76ba2083e6a5661f4c23786b77f73de7ef55869b86f836c31b39b7504358ead8de1af6ec23ff0024dfe52251f57f3bae6d141aebc4aed70becb2499d9edf4ea68fd2ec6dbbbdf656a9dd7b2b9ada792bb4faa01bfb158f6f0fb2c20f8c38b27fe82931c6cb0e69988d37b7530b129c2c3a70e811563d6dad83c9a3684749253b494924924a7fffd3f55497079dfe377a3d408c0c2c8cb703a3acdb4308f1dce36ddffb2eb9bcff00f1a9f59f20118cdc7c0613ed35b0db647fc6647e87ff006551a53eb39b9b8981896e6665ada31a86eeb6d798007fafd15e75d06ebfebcfd6ec8eab985ede8fd240fb1613c8da2c7ef6635d6d10e67afb3d6ca7bfe9d76fd9e8dfe9d4b83ceea5d4faa582eea395765bc1967aaf2e6b67fd1d5fcd55ff005aad77dfe27b6edeae27dfbf1c96f78db700eff392a4a0cbe9b6d190ec6c826bbea3b1e470e8fe6ee67ef577346f67fe4d01fd2f260b8648dbe2667f2aefbeb374cc5cbe9cfc8b6caf1aec5697d59373832b6ffc1df61fa3459f9ffe8ff9d5ca60e2ddd52060b1b79fcf7b5ec754cedbacc8a5d6d7b7fe2bd5f53fc12ad384a2686a3a3731e48c859a046ee21a1b46e73ecdd1a977f70fa4b6f3babf53faa38df57efb2f2cc6bee7d7d4fa7b9ad700c79391ea31fb7d4aefc4aaefd37a76fa565ccff3f7fa57d56c4e9f67daf29ff6acc69dc2d236d7591ff71a8f77bbfe1edf52dff47e92e0ff00c65e71c9ead89437f9aa2a7b99e65efd8e7ff6bd1ffa0a5c78c8d4b0e6c825a4767d818f658c6d95b83d8f01cc7b4c820ead735c3e935ca4bc17a1fd6debdd048660649fb30ffb4970f529fecd72d7d3ff00a0f652bbbe95fe36fa75a1b5f57c4b311fa03751fa6abcdc5becc8affa9e95ca4a607bf49627fcf4faa8708e70ea98fe80201f77bc1325acfb3ff48deedaef67a4920a7fffd4e1c353166e441c4278d139288b5e1da1f6f81fe0ba4ff17fd669e8bd7acb6f6d96332319f4b29a9a5efb2edf5598f554c1fe12cfd2b19bf657fe92c62e7c191af2343f2563a5648c4eb18194efa3464d2f77f577b43ffe89494ee7f8c077d69c8cba5fd79adaf16f06cc2c5a5e5f4d2f603ea635da37d6ce6d4edeebdfff00a0de9d7fa35cef4aea199d17399d47a7d9e86457e13b2c6989a2fadbfced3647d1ff00b6ff0048bd3ffc643f1c743b6abdbbacb72f1d9880f6b03bd5b2c1fd5c5f5bfedc5e75d0e8e9c7ae6063e7d7bb16cca155fa900b6c3e9d5b9c0fe6dce6ff00d6d2a53ecbd17ab57d7ba3d19eda1f8cebdbefc7b3e935d3b3dafd3d5a5cefe66eff0008cff46ffd1af20fadb9e3a87d65cfb9bfccd567d96813a7a78ffabfb7fe32d6db6ffd717ac757cb6746e9197d44015fd8697baa60d06e03d3c7a34fcd75cead9b5788d6d2d0d0e32e1f48f89fce724429668ddf9a47c6148090a4dd493db84f1aa4a47b759efe292240949253ffd5e29bc279506190a49c950d09f350b1bb9a40d091a7c53931af8272929e83eb07d613d7ba874ba8196e163b5f7f87af606bedff00b6e9ae86ff005fd45ce6413e81b0121cc05e08ec47bda7fce47e995edcac8781f46b7bbef6a0d8d9639be208454fa4ff008cdeaad77d5de9f456e20f55b5979038755530643bff00662ec65e6a4ed6cf7e00f32b63eb175119c3a3d4d7173307a5625275ff0008e60b6fff00d10d58fcbfc99ff547ff0022d41491a21a07824903a2435d1252a7549475949253ffd6e1aafa0df829ac049392ef243e8b7e0160a4929ea3a6ff003d97ff0013fdcaa3b82b092454edd1fcdb7e693383fd777e5588920a77fb2416024929dfff000c3e692c049253ffd9ffed13c650686f746f73686f7020332e30003842494d04040000000000271c015a00031b25471c0200000200001c0237000832303233303231351c023c0006303831383437003842494d04250000000000105b3659577704359065821812f3f7b75f3842494d043a000000000111000000100000000100000000000b7072696e744f7574707574000000050000000050737453626f6f6c0100000000496e7465656e756d00000000496e746500000000436c726d0000000f7072696e745369787465656e426974626f6f6c000000000b7072696e7465724e616d65544558540000001200440053002d005200580031002000280043006f007000690061007200200031002900000000000f7072696e7450726f6f6653657475704f626a63000000110041006a0075007300740065002000640065002000700072007500650062006100000000000a70726f6f6653657475700000000100000000426c746e656e756d0000000c6275696c74696e50726f6f660000000970726f6f66434d594b003842494d043b00000000022d00000010000000010000000000127072696e744f75747075744f7074696f6e7300000017000000004370746e626f6f6c0000000000436c6272626f6f6c00000000005267734d626f6f6c000000000043726e43626f6f6c0000000000436e7443626f6f6c00000000004c626c73626f6f6c00000000004e677476626f6f6c0000000000456d6c44626f6f6c0000000000496e7472626f6f6c000000000042636b674f626a630000000100000000000052474243000000030000000052642020646f7562406fe000000000000000000047726e20646f7562406fe0000000000000000000426c2020646f7562406fe000000000000000000042726454556e744623526c74000000000000000000000000426c6420556e744623526c7400000000000000000000000052736c74556e74462350786c4072c000000000000000000a766563746f7244617461626f6f6c010000000050675073656e756d00000000506750730000000050675043000000004c656674556e744623526c74000000000000000000000000546f7020556e744623526c7400000000000000000000000053636c20556e74462350726340590000000000000000001063726f705768656e5072696e74696e67626f6f6c000000000e63726f7052656374426f74746f6d6c6f6e67000000000000000c63726f70526563744c6566746c6f6e67000000000000000d63726f705265637452696768746c6f6e67000000000000000b63726f7052656374546f706c6f6e6700000000003842494d03ed000000000010012c000000010002012c0000000100023842494d042600000000000e000000000000000000003f8000003842494d040d000000000004000000783842494d04190000000000040000001e3842494d03f3000000000009000000000000000001003842494d271000000000000a000100000000000000023842494d03f5000000000048002f66660001006c66660006000000000001002f6666000100a1999a0006000000000001003200000001005a00000006000000000001003500000001002d000000060000000000013842494d03f80000000000700000ffffffffffffffffffffffffffffffffffffffffffff03e800000000ffffffffffffffffffffffffffffffffffffffffffff03e800000000ffffffffffffffffffffffffffffffffffffffffffff03e800000000ffffffffffffffffffffffffffffffffffffffffffff03e800003842494d0408000000000010000000010000024000000240000000003842494d041e000000000004000000003842494d041a000000000345000000060000000000000000000001d80000016200000008004400530043005f0035003300310036000000010000000000000000000000000000000000000001000000000000000000000162000001d800000000000000000000000000000000010000000000000000000000000000000000000010000000010000000000006e756c6c0000000200000006626f756e64734f626a6300000001000000000000526374310000000400000000546f70206c6f6e6700000000000000004c6566746c6f6e67000000000000000042746f6d6c6f6e67000001d800000000526768746c6f6e670000016200000006736c69636573566c4c73000000014f626a6300000001000000000005736c6963650000001200000007736c69636549446c6f6e67000000000000000767726f757049446c6f6e6700000000000000066f726967696e656e756d0000000c45536c6963654f726967696e0000000d6175746f47656e6572617465640000000054797065656e756d0000000a45536c6963655479706500000000496d672000000006626f756e64734f626a6300000001000000000000526374310000000400000000546f70206c6f6e6700000000000000004c6566746c6f6e67000000000000000042746f6d6c6f6e67000001d800000000526768746c6f6e67000001620000000375726c54455854000000010000000000006e756c6c54455854000000010000000000004d7367655445585400000001000000000006616c74546167544558540000000100000000000e63656c6c54657874497348544d4c626f6f6c010000000863656c6c546578745445585400000001000000000009686f727a416c69676e656e756d0000000f45536c696365486f727a416c69676e0000000764656661756c740000000976657274416c69676e656e756d0000000f45536c69636556657274416c69676e0000000764656661756c740000000b6267436f6c6f7254797065656e756d0000001145536c6963654247436f6c6f7254797065000000004e6f6e6500000009746f704f75747365746c6f6e67000000000000000a6c6566744f75747365746c6f6e67000000000000000c626f74746f6d4f75747365746c6f6e67000000000000000b72696768744f75747365746c6f6e6700000000003842494d042800000000000c000000023ff00000000000003842494d0414000000000004000000043842494d040c000000000a92000000010000005500000071000001000000710000000a7600180001ffd8ffed000c41646f62655f434d0001ffee000e41646f626500648000000001ffdb0084000c08080809080c09090c110b0a0b11150f0c0c0f1518131315131318110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c010d0b0b0d0e0d100e0e10140e0e0e14140e0e0e0e14110c0c0c0c0c11110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0cffc00011080071005503012200021101031101ffdd00040006ffc4013f0000010501010101010100000000000000030001020405060708090a0b0100010501010101010100000000000000010002030405060708090a0b1000010401030204020507060805030c33010002110304211231054151611322718132061491a1b14223241552c16233347282d14307259253f0e1f163733516a2b283264493546445c2a3743617d255e265f2b384c3d375e3f3462794a485b495c4d4e4f4a5b5c5d5e5f55666768696a6b6c6d6e6f637475767778797a7b7c7d7e7f711000202010204040304050607070605350100021103213112044151617122130532819114a1b14223c152d1f0332462e1728292435315637334f1250616a2b283072635c2d2449354a317644555367465e2f2b384c3d375e3f34694a485b495c4d4e4f4a5b5c5d5e5f55666768696a6b6c6d6e6f62737475767778797a7b7c7ffda000c03010002110311003f00f554924925292492494a4962f5ff00adfd0beafc333ef2725cd2faf12a69b2e701c7b1bedab7bbe85990fa6aff00845ca1ff001c786d79dfd2afd8382db6b71f9b7ff33494fa2a4b94e8dfe32feabf56b998deabf0afb086b1994d0c6b9c7f31b7b1d651bbf737dbfa4fcc5d5a4a5249249294924924a7ffd0f55492492529727fe307eb7d9f57702bc7c183d4f3b7371c91b854d6c35f93e9fbbd47ee7b19456ff65967f22ab2b5d62f33ebcd399f5ef3f232181cde9b4518d8d23bbd9f6b73bfaffac588134095d08f1480eef02fc5ea77dc4be9bafc9b8ef7bac9758e27fc25ae74bf73ff00e1169627d4ceab743ef733181e5a65ef1fd96c33fe92ef31287ba5c19e64c7e5563638120b7e2a139a5d346dc796875b2f0b93f515be893464937107e9b46d3fc92d0b4ffc577d62cdc1eb47eade5bc9c4bf78a2a32ef4b2183d577a6e3fcde3db5576fb3fd2fa7fcdfa96addc8aac60968d39d1727f592a38b9585f58319a3d6c1bab75838ddb1edb6a73dcdfeafa4f471e424d1d6d667c200b88aa7da92492533554924924a7ffd1f5549249252970df5831ff00cb99bb5c6bf58d763ac68123f44cabdbbbf3b6d4bb95c0dbd42dea3957655ed6b497beb6b5a34f498f7b28dd3f4ac733f9c51e535166e5e24cafa0d0ff0084e0577747b329b552cce36fa7eb3723d6b034d7bbd3f56b76f66f6fa8ed9edafdeb79f75cce9eeb039ceb6a3b373b531f477977f267e9ab156163901eca9bbc9241f03fbeabbf37a68c4b77e554c634b98f24c00468edce23cd43237557f56e4635775f4d1e7aeb7168c8156466751379ace47a82c9afd2dde97aae05a5acabd4f6effa1fcb57aec3fb6630c47bbd5196f652e791048b1ed66e21bedddb7f7568554623eb6bcb038b74ddcea342abe5de31e875d59f48d05ae63c47b1c1cd1559fbbec794e121637d18e503476d767d292593f557a865f52fabf85999b1f69b1845ae02039cc73a9366d1edfd2fa7ea7b56b2b00d8b69114483d0d292492490ff00ffd2f55492492529713d53a3e4f4dc9bad68dd876da5f53e4437d43bbece593bdbb5fbff00e0d76ca9759a6bbba5e532cd1be99703c439bfa4acff009ed6a6ce36193164303e077790cacdfb3e3876d7bc3b42da86e71ffa959f667641a46ec271aa3404d6607f25db91b1f36ab9bb1c76ba2083e6a5661f4c23786b77f73de7ef55869b86f836c31b39b7504358ead8de1af6ec23ff0024dfe52251f57f3bae6d141aebc4aed70becb2499d9edf4ea68fd2ec6dbbbdf656a9dd7b2b9ada792bb4faa01bfb158f6f0fb2c20f8c38b27fe82931c6cb0e69988d37b7530b129c2c3a70e811563d6dad83c9a3684749253b494924924a7fffd3f55497079dfe377a3d408c0c2c8cb703a3acdb4308f1dce36ddffb2eb9bcff00f1a9f59f20118cdc7c0613ed35b0db647fc6647e87ff006551a53eb39b9b8981896e6665ada31a86eeb6d798007fafd15e75d06ebfebcfd6ec8eab985ede8fd240fb1613c8da2c7ef6635d6d10e67afb3d6ca7bfe9d76fd9e8dfe9d4b83ceea5d4faa582eea395765bc1967aaf2e6b67fd1d5fcd55ff005aad77dfe27b6edeae27dfbf1c96f78db700eff392a4a0cbe9b6d190ec6c826bbea3b1e470e8fe6ee67ef577346f67fe4d01fd2f260b8648dbe2667f2aefbeb374cc5cbe9cfc8b6caf1aec5697d59373832b6ffc1df61fa3459f9ffe8ff9d5ca60e2ddd52060b1b79fcf7b5ec754cedbacc8a5d6d7b7fe2bd5f53fc12ad384a2686a3a3731e48c859a046ee21a1b46e73ecdd1a977f70fa4b6f3babf53faa38df57efb2f2cc6bee7d7d4fa7b9ad700c79391ea31fb7d4aefc4aaefd37a76fa565ccff3f7fa57d56c4e9f67daf29ff6acc69dc2d236d7591ff71a8f77bbfe1edf52dff47e92e0ff00c65e71c9ead89437f9aa2a7b99e65efd8e7ff6bd1ffa0a5c78c8d4b0e6c825a4767d818f658c6d95b83d8f01cc7b4c820ead735c3e935ca4bc17a1fd6debdd048660649fb30ffb4970f529fecd72d7d3ff00a0f652bbbe95fe36fa75a1b5f57c4b311fa03751fa6abcdc5becc8affa9e95ca4a607bf49627fcf4faa8708e70ea98fe80201f77bc1325acfb3ff48deedaef67a4920a7fffd4e1c353166e441c4278d139288b5e1da1f6f81fe0ba4ff17fd669e8bd7acb6f6d96332319f4b29a9a5efb2edf5598f554c1fe12cfd2b19bf657fe92c62e7c191af2343f2563a5648c4eb18194efa3464d2f77f577b43ffe89494ee7f8c077d69c8cba5fd79adaf16f06cc2c5a5e5f4d2f603ea635da37d6ce6d4edeebdfff00a0de9d7fa35cef4aea199d17399d47a7d9e86457e13b2c6989a2fadbfced3647d1ff00b6ff0048bd3ffc643f1c743b6abdbbacb72f1d9880f6b03bd5b2c1fd5c5f5bfedc5e75d0e8e9c7ae6063e7d7bb16cca155fa900b6c3e9d5b9c0fe6dce6ff00d6d2a53ecbd17ab57d7ba3d19eda1f8cebdbefc7b3e935d3b3dafd3d5a5cefe66eff0008cff46ffd1af20fadb9e3a87d65cfb9bfccd567d96813a7a78ffabfb7fe32d6db6ffd717ac757cb6746e9197d44015fd8697baa60d06e03d3c7a34fcd75cead9b5788d6d2d0d0e32e1f48f89fce724429668ddf9a47c6148090a4dd493db84f1aa4a47b759efe292240949253ffd5e29bc279506190a49c950d09f350b1bb9a40d091a7c53931af8272929e83eb07d613d7ba874ba8196e163b5f7f87af606bedff00b6e9ae86ff005fd45ce6413e81b0121cc05e08ec47bda7fce47e995edcac8781f46b7bbef6a0d8d9639be208454fa4ff008cdeaad77d5de9f456e20f55b5979038755530643bff00662ec65e6a4ed6cf7e00f32b63eb175119c3a3d4d7173307a5625275ff0008e60b6fff00d10d58fcbfc99ff547ff0022d41491a21a07824903a2435d1252a7549475949253ffd6e1aafa0df829ac049392ef243e8b7e0160a4929ea3a6ff003d97ff0013fdcaa3b82b092454edd1fcdb7e693383fd777e5588920a77fb2416024929dfff000c3e692c049253ffd93842494d042100000000005700000001010000000f00410064006f00620065002000500068006f0074006f00730068006f00700000001400410064006f00620065002000500068006f0074006f00730068006f00700020003200300032003100000001003842494d0406000000000007ffff010100010100ffe10f04687474703a2f2f6e732e61646f62652e636f6d2f7861702f312e302f003c3f787061636b657420626567696e3d22efbbbf222069643d2257354d304d7043656869487a7265537a4e54637a6b633964223f3e203c783a786d706d65746120786d6c6e733a783d2261646f62653a6e733a6d6574612f2220783a786d70746b3d2241646f626520584d5020436f726520362e302d633030322037392e3136343438382c20323032302f30372f31302d32323a30363a35332020202020202020223e203c7264663a52444620786d6c6e733a7264663d22687474703a2f2f7777772e77332e6f72672f313939392f30322f32322d7264662d73796e7461782d6e7323223e203c7264663a4465736372697074696f6e207264663a61626f75743d222220786d6c6e733a786d703d22687474703a2f2f6e732e61646f62652e636f6d2f7861702f312e302f2220786d6c6e733a6175783d22687474703a2f2f6e732e61646f62652e636f6d2f657869662f312e302f6175782f2220786d6c6e733a70686f746f73686f703d22687474703a2f2f6e732e61646f62652e636f6d2f70686f746f73686f702f312e302f2220786d6c6e733a786d704d4d3d22687474703a2f2f6e732e61646f62652e636f6d2f7861702f312e302f6d6d2f2220786d6c6e733a73744576743d22687474703a2f2f6e732e61646f62652e636f6d2f7861702f312e302f73547970652f5265736f757263654576656e74232220786d6c6e733a64633d22687474703a2f2f7075726c2e6f72672f64632f656c656d656e74732f312e312f2220786d703a43726561746f72546f6f6c3d224e494b4f4e2044373530205665722e312e313320202020202220786d703a437265617465446174653d22323032332d30322d31355430383a31383a34372220786d703a4d6f64696679446174653d22323032332d30322d31355430383a32333a30352d30353a30302220786d703a4d65746164617461446174653d22323032332d30322d31355430383a32333a30352d30353a303022206175783a53657269616c4e756d6265723d223331353831373522206175783a4c656e73496e666f3d223234302f313020313230302f31302034302f31302034302f313022206175783a4c656e733d2232342e302d3132302e30206d6d20662f342e3022206175783a4c656e7349443d2231373022206175783a496d6167654e756d6265723d223535383522206175783a417070726f78696d617465466f63757344697374616e63653d223230302f313030222070686f746f73686f703a44617465437265617465643d22323032332d30322d31355430383a31383a34372e303231222070686f746f73686f703a436f6c6f724d6f64653d2233222070686f746f73686f703a49434350726f66696c653d22735247422049454336313936362d322e312220786d704d4d3a446f63756d656e7449443d2261646f62653a646f6369643a70686f746f73686f703a66376239393662332d326365612d396334622d613039312d6536316666613530663266612220786d704d4d3a496e7374616e636549443d22786d702e6969643a37366566636330372d396139362d663334632d393865392d6165623961326132353030612220786d704d4d3a4f726967696e616c446f63756d656e7449443d223437313535463043454245363530393830303137363935323637394430444234222064633a666f726d61743d22696d6167652f6a706567223e203c786d704d4d3a486973746f72793e203c7264663a5365713e203c7264663a6c692073744576743a616374696f6e3d227361766564222073744576743a696e7374616e636549443d22786d702e6969643a33343337633161622d306537642d313034302d383866332d306133356538326165623833222073744576743a7768656e3d22323032332d30322d31355430383a32333a30352d30353a3030222073744576743a736f6674776172654167656e743d2241646f62652050686f746f73686f702032322e30202857696e646f777329222073744576743a6368616e6765643d222f222f3e203c7264663a6c692073744576743a616374696f6e3d227361766564222073744576743a696e7374616e636549443d22786d702e6969643a37366566636330372d396139362d663334632d393865392d616562396132613235303061222073744576743a7768656e3d22323032332d30322d31355430383a32333a30352d30353a3030222073744576743a736f6674776172654167656e743d2241646f62652050686f746f73686f702032322e30202857696e646f777329222073744576743a6368616e6765643d222f222f3e203c2f7264663a5365713e203c2f786d704d4d3a486973746f72793e203c2f7264663a4465736372697074696f6e3e203c2f7264663a5244463e203c2f783a786d706d6574613e2020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020203c3f787061636b657420656e643d2277223f3effe20c584943435f50524f46494c4500010100000c484c696e6f021000006d6e74725247422058595a2007ce00020009000600310000616373704d5346540000000049454320735247420000000000000000000000000000f6d6000100000000d32d4850202000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001163707274000001500000003364657363000001840000006c77747074000001f000000014626b707400000204000000147258595a00000218000000146758595a0000022c000000146258595a0000024000000014646d6e640000025400000070646d6464000002c400000088767565640000034c0000008676696577000003d4000000246c756d69000003f8000000146d6561730000040c0000002474656368000004300000000c725452430000043c0000080c675452430000043c0000080c625452430000043c0000080c7465787400000000436f70797269676874202863292031393938204865776c6574742d5061636b61726420436f6d70616e790000646573630000000000000012735247422049454336313936362d322e31000000000000000000000012735247422049454336313936362d322e31000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000058595a20000000000000f35100010000000116cc58595a200000000000000000000000000000000058595a200000000000006fa2000038f50000039058595a2000000000000062990000b785000018da58595a2000000000000024a000000f840000b6cf64657363000000000000001649454320687474703a2f2f7777772e6965632e636800000000000000000000001649454320687474703a2f2f7777772e6965632e63680000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064657363000000000000002e4945432036313936362d322e312044656661756c742052474220636f6c6f7572207370616365202d207352474200000000000000000000002e4945432036313936362d322e312044656661756c742052474220636f6c6f7572207370616365202d20735247420000000000000000000000000000000000000000000064657363000000000000002c5265666572656e63652056696577696e6720436f6e646974696f6e20696e2049454336313936362d322e3100000000000000000000002c5265666572656e63652056696577696e6720436f6e646974696f6e20696e2049454336313936362d322e31000000000000000000000000000000000000000000000000000076696577000000000013a4fe00145f2e0010cf140003edcc0004130b00035c9e0000000158595a2000000000004c09560050000000571fe76d6561730000000000000001000000000000000000000000000000000000028f0000000273696720000000004352542063757276000000000000040000000005000a000f00140019001e00230028002d00320037003b00400045004a004f00540059005e00630068006d00720077007c00810086008b00900095009a009f00a400a900ae00b200b700bc00c100c600cb00d000d500db00e000e500eb00f000f600fb01010107010d01130119011f0125012b01320138013e0145014c0152015901600167016e0175017c0183018b0192019a01a101a901b101b901c101c901d101d901e101e901f201fa0203020c0214021d0226022f02380241024b0254025d02670271027a0284028e029802a202ac02b602c102cb02d502e002eb02f50300030b03160321032d03380343034f035a03660372037e038a039603a203ae03ba03c703d303e003ec03f9040604130420042d043b0448045504630471047e048c049a04a804b604c404d304e104f004fe050d051c052b053a05490558056705770586059605a605b505c505d505e505f6060606160627063706480659066a067b068c069d06af06c006d106e306f507070719072b073d074f076107740786079907ac07bf07d207e507f8080b081f08320846085a086e0882089608aa08be08d208e708fb09100925093a094f09640979098f09a409ba09cf09e509fb0a110a270a3d0a540a6a0a810a980aae0ac50adc0af30b0b0b220b390b510b690b800b980bb00bc80be10bf90c120c2a0c430c5c0c750c8e0ca70cc00cd90cf30d0d0d260d400d5a0d740d8e0da90dc30dde0df80e130e2e0e490e640e7f0e9b0eb60ed20eee0f090f250f410f5e0f7a0f960fb30fcf0fec1009102610431061107e109b10b910d710f511131131114f116d118c11aa11c911e81207122612451264128412a312c312e31303132313431363138313a413c513e5140614271449146a148b14ad14ce14f01512153415561578159b15bd15e0160316261649166c168f16b216d616fa171d17411765178917ae17d217f7181b18401865188a18af18d518fa19201945196b199119b719dd1a041a2a1a511a771a9e1ac51aec1b141b3b1b631b8a1bb21bda1c021c2a1c521c7b1ca31ccc1cf51d1e1d471d701d991dc31dec1e161e401e6a1e941ebe1ee91f131f3e1f691f941fbf1fea20152041206c209820c420f0211c2148217521a121ce21fb22272255228222af22dd230a23382366239423c223f0241f244d247c24ab24da250925382568259725c725f726272657268726b726e827182749277a27ab27dc280d283f287128a228d429062938296b299d29d02a022a352a682a9b2acf2b022b362b692b9d2bd12c052c392c6e2ca22cd72d0c2d412d762dab2de12e162e4c2e822eb72eee2f242f5a2f912fc72ffe3035306c30a430db3112314a318231ba31f2322a3263329b32d4330d3346337f33b833f1342b3465349e34d83513354d358735c235fd3637367236ae36e937243760379c37d738143850388c38c839053942397f39bc39f93a363a743ab23aef3b2d3b6b3baa3be83c273c653ca43ce33d223d613da13de03e203e603ea03ee03f213f613fa23fe24023406440a640e74129416a41ac41ee4230427242b542f7433a437d43c044034447448a44ce45124555459a45de4622466746ab46f04735477b47c04805484b489148d7491d496349a949f04a374a7d4ac44b0c4b534b9a4be24c2a4c724cba4d024d4a4d934ddc4e254e6e4eb74f004f494f934fdd5027507150bb51065150519b51e65231527c52c75313535f53aa53f65442548f54db5528557555c2560f565c56a956f75744579257e0582f587d58cb591a596959b85a075a565aa65af55b455b955be55c355c865cd65d275d785dc95e1a5e6c5ebd5f0f5f615fb36005605760aa60fc614f61a261f56249629c62f06343639763eb6440649464e9653d659265e7663d669266e8673d679367e9683f689668ec6943699a69f16a486a9f6af76b4f6ba76bff6c576caf6d086d606db96e126e6b6ec46f1e6f786fd1702b708670e0713a719571f0724b72a67301735d73b87414747074cc7528758575e1763e769b76f8775677b37811786e78cc792a798979e77a467aa57b047b637bc27c217c817ce17d417da17e017e627ec27f237f847fe5804780a8810a816b81cd8230829282f4835783ba841d848084e3854785ab860e867286d7873b879f8804886988ce8933899989fe8a648aca8b308b968bfc8c638cca8d318d988dff8e668ece8f368f9e9006906e90d6913f91a89211927a92e3934d93b69420948a94f4955f95c99634969f970a977597e0984c98b89924999099fc9a689ad59b429baf9c1c9c899cf79d649dd29e409eae9f1d9f8b9ffaa069a0d8a147a1b6a226a296a306a376a3e6a456a4c7a538a5a9a61aa68ba6fda76ea7e0a852a8c4a937a9a9aa1caa8fab02ab75abe9ac5cacd0ad44adb8ae2daea1af16af8bb000b075b0eab160b1d6b24bb2c2b338b3aeb425b49cb513b58ab601b679b6f0b768b7e0b859b8d1b94ab9c2ba3bbab5bb2ebba7bc21bc9bbd15bd8fbe0abe84beffbf7abff5c070c0ecc167c1e3c25fc2dbc358c3d4c451c4cec54bc5c8c646c6c3c741c7bfc83dc8bcc93ac9b9ca38cab7cb36cbb6cc35ccb5cd35cdb5ce36ceb6cf37cfb8d039d0bad13cd1bed23fd2c1d344d3c6d449d4cbd54ed5d1d655d6d8d75cd7e0d864d8e8d96cd9f1da76dafbdb80dc05dc8add10dd96de1cdea2df29dfafe036e0bde144e1cce253e2dbe363e3ebe473e4fce584e60de696e71fe7a9e832e8bce946e9d0ea5beae5eb70ebfbec86ed11ed9cee28eeb4ef40efccf058f0e5f172f1fff28cf319f3a7f434f4c2f550f5def66df6fbf78af819f8a8f938f9c7fa57fae7fb77fc07fc98fd29fdbafe4bfedcff6dffffffee002141646f62650064800000000103001003020306000000000000000000000000ffdb008400120e0e0e100e151010151e1311131e231a15151a2322171717171722110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c011413131619161b17171b140e0e0e14140e0e0e0e14110c0c0c0c0c11110c0c0c0c0c0c110c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0cffc200110801d8016203012200021101031101ffc400cc00010002030101000000000000000000000001020305060407010101010101000000000000000000000000010203041000010303020601040005050100000000010002031104051021203040311206134122321450603315167080422324351100020003030608070f0108030100000001020011032112041020314151224061713242521323816272923343a33091a1b182a2b25363738393b3c3d3c250f0c1e21424340580d2e364120001030304020300000000000000000001401121002030507031511071606162ffda000c03010102110311000000ee0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001aae40ecb43c8597a6cbc950ee361f35b1f5ccdf20dc1f476b36680000000000000000000000011c86b348b3489a566a44d649ada6315b2635cbd0f2f74fa6edfe47f444dc000000000000000000000709baf9fac5a9956b4cf4313ddb1ceb47e9e8f2e3a68fdbb1b677e1c3b5a1cc6bbb2d0f4e5abd9eaf374e3f609d1ef2000000000000000000079cf9d6bf1745378fd3ec9e5df5be8f6de5c5932a6b1dae31d33632b16aa53c7ecaea727e5eab98ebe7eafb8f92fd6ae0000000000000000001ce747c91c9f51a3def3ef335be3adb2d734b11968566256697460c79f1d98a269733ce745e3de39afa9fcc7e89d386e8200000000000000000e5ba9e78d1fad3cbd36b6bbca6fbd1cacd9d74737b8cebd4ac6777af9f4d73bfc7cd5758e9306b3dab92264d0767cd757d386e45c80000000000000000d3ee35ebcfe3be4e5e8c7e9c3e1976b8b439ecdabcf9f3bf6d252eb715af737b783cdacecf0bd1116bc6a787b4e3fbadf2917000000000000000003c5edc272d931e6e3e9f0793718579edafaefbce1f46573e992c675acafa29bc79355d062df3d6fbbd36ce96b23cbdb71fd375e3ea1700000000000000000472dbce479f7d85e96ceed929933bbccd6b1c64a4abdd5e3ae7c099d130c77c64511ac60d56c35abf47cda8dbf5f2858000000000000001ace77a8e5797a7d3931de5be5c59b3bc9312b5d3ecfcf662b7a7026b3db5cb59ef339b8f1df11598a6f9eb715e26bb5d9d6ddbca080000000000000011c4f6fabcf4d25a97e7df27a3cb9f3ab527ce5e7c9e5ad94ebe95b18d7fa64f4e4f3642d8ed8c8f27a70eb18b6d93a2d62c37c4000000000000000003c3a8e97519e9abcb83272f464d6ec291a8f4fa306adab8e2daf9fd7959c1efa5f3228a99baed0efbb79c2e0000000000000000000062ca391be6f1f1f4fa58ef9e9169c860afaab5e4afa31c639ad6c8532eb1bcdbea36fd3805c8000000000000000000078b8c373acf5f9797a2de8d764cef637f04cbee6bc7b31f9e95971e08b9cd7c36b3a9da6b367d3ce1600000000000000000035bb0f991abdc68fea75e0d6f41cf71f461c7eaa677e6afae9679a32c18a3358c392f244a86f759d1f13dbcfddfbfe71f4764000000000000000035bc9993999ad6fbbce47b059e5fa9acbc963f579787a72e4c1925c915a938942b588b1eef3f53be76e57a6e2faf1d2fd4be59b74fa4bc7ec80000000002baa36ee3f507d1755f3bad757a0f050bcc003acebf94ead6e4a63e53b0c39df219bcde8e3e857244b8f0e5ad9e2dbee3d9d38e265c5d39e0f9f765c2d50465e8b9827d4361f23db9f4573dbc8ca0000e2f57a98acb8e00915411316262d0a891d8759c077e58941ab8ae83c3e4cf4deceafb8cefc7b4b53a72aad1647933782b53c8759ca1098844916a58b65c23a1def0327d632fc97727d05c9a38c4ad24445a08ad8913304b0e42d09327d53e4df4d5d9457809369c5c66ac5132b8fd18c9f4ff7fca7e9a7a2b928be7c7e88ae27419714122122130924ac26089424a04ca6d26080132456d2516888488ed38bca6dbdbb3dad7cdb077ff3e44dab2c5a252bedf16d97e879355b431ea76dc99ca2609a5e4c73691168a8909894445a08489989a44884c9098134b08944448ae5c63e93eaf17b3530725d5f84e0f0faf0c23d7e73d9d94ec571acb327cf3b8f9b44c4a5998b1594161504804260804cc0902400a952e982225115b41de6db98e9f530e8b7fc29e2c59f1430de0efb69c8f5f51332737c6eeb4d012cca08b56e00898a902262201335b500989008a5ea59122088891b8ee3e73dc557e7fd2f329ebc1eaf20c79319ecfa4fca7ea664adf4b5c25539a9892696a1924a989880a89010011312481301301122b6ad844c442609ec78df7d79f060f549ebf17b7c556a5a0c3f4cf9a7d00dd721d87cd8f009641115c84c9402251028021116acd591200209801116898213030e6c047bfc3b1b3278bd9e3113063ecf8cea8ea3e5fdc7101295138c9c9592c890452626213148980222696ab024080015988b2b611304e1cd429b2d6edacc3e6f479c889831f41a0dbc7a743e9f3da9898ad17241209829308b5664a0a2118f26b06d2754adacea51b56a86d6356368d58d95f5436ad50dab54361b7e6166ff00cda91b58d58d965d40d9cead2ed6bac1b0c9ab1b46ac6d5aa1b56a86d5aa1b5b6a06d6bac57bde047fffda0008010200010500fe69af4555545e1179552aa9aee81c680955e269af3de77e369df9c7bf8af1088d00aaf05e2821db9bf5dc92d77078b9548d0738a0ea22f44e80d179a26a81439af2423c14e01a0edcb7f7fa21aeda8d0731c2a3e87401515340be8d6f39c363a792aaf24504dedcf70e2010edcf277235a20aa876e7bc6f555d2ba81b73dc2a0823858de65389cd05114d00250670d39ee6d508ca000d4f15153f80008f053a33a81a11d084751d184751d3847a31d38e9c73bfffda0008010300010500fe50d96ca9d3d0f4542550a119284610680a813d83a06b6a40541c2427b6879d18db84e8f15079a137605cbcca0ed0ba8be45e40a29ddf983bfd36003dbad02f26aa03a3f9a1045b5423080d08aa31041b4453c1e6c4c040d29a5780a684e143cb80fdbff208f09457644d4f2e277892370abc256d57bc7398e351a0d95511a1521df9ed351c24a777e7b47da0aaaaaaa274777e7c66ada2a2a15454d1db9e7b5de241047048ee89ae2d20d742404e93a463e88ca28493fead7fffda0008010100010500ff0064593ce586304beece5fe6790259eeb3023ddadc9b6f68c4ccadeeed6e5bfc132f9db3c64775ed398b8157bdd5a2354490bcdc848426cc3cacbd972b687139cb2c9b3f803ded63733ed6e2e9247be473c945e1120aa90aa1045aabb34922395cc7da7b7e521186cf5b64dbd6921a33d9f9724ff25ba1e2d55aa2095440356c8b495faf21058e622776b95bdcc90cb86ce45916f59ec79f92ea42e24f641db170a54aee9b0c8f4cc7cee50e242663620059b1aa6b16395d634b4f8b98ead460aedd6f946b9ae1d57b6651d67624d03438a6db48e4f85c13622e31d849218314c6a8ed58d5f0808300402a045814b182323080490a13e27d62f65bab1eabd83212df64e181f33edf1ed6b5f051bfdbcbcc7631b5476ed6af8c20c5e08b51086e8854aabab61236eed0c4eaefe9b91f8e7ea6fee85a590f391f8eb411c2000051008350029dd764110885d9172251ef7b6ec7c52328fc7caf8aefa9f729dd1e2ed23acac6d188209a3405568aaaa13827228e84790c85a98a600d30976ebcc5751eea16362acc50aa1ddad4d0bc4a7054aaf1545409cd4e6a705555df231f9b268fc24f54686e0fa8f7361743610f83689a179b1a5b2c49af6501049468092b622a8908b855d429e08214adf36dfc25a7d3c8385ea3db23f3b68c523eeae2f483e732747772116d76c504f7ec36b74f7871aaecae2e046cb8cb4c0ff70bb726e46751dfca44376c955370b20c0e8fd5a2f8f07d47b1c7e7669ec73db15a431a686343a4891f0722c6a68a3a31512ec263e685b30a8ed6101d656ae471f6c13ec05222f2c0aeb76e2e2f8b1bd4669a0e3dbf8b0514b2f8367bc860273574e6c17ef9d90cbe62a4185c6933becddce79f06cf908a14dcd42e2cb9f36b250e15aa2367b43d35a1adea32c2b8e8c7d9457b2c8c18d82163aeb1d750bf18c16b676f090e70abe1d93bbcacf8a7646e7cd9933fcb8cb47ba6b9b7f8ae6da41235ada222aad985f77d4ddb7ced60fe90463053ad5848b620b6d5c508c3435bbb36255cb7c8c6c25ae8a446004b2014110068beb68f8a0bfb6c959dd3ba7739ad6bb3135e4cd146b4a09ad40510013f75b04d04e9336862145454442722abbcd40e6ddcf1dcd9dc36e6d7a6ccbcb31966ca11d9a9a5349402ee8b281adf231b5ae5206b5481ae0dab4b7755a22e4e555f5b97912dd32927ad3cbb13d367ebfdae16fdacedd934a6a1d9ada99886b2eaf324d7c17370e8dd741a1f97736674c5ec88d5a6a8a257d5647c997570e0f8701098715d365e33263a1943226914aa604d4dede54123894d8c877882c7d9405aeb720c7004c000704e213d0ef3ca228a28e59596d6cf9cc6c6c71f4ce68736e2d8432b5a036a9a536942e352fa2dcaa50171a7c87c7f21b84d7af3aa7271d2f9db41f87afdabdf75d46571bfb0812746a6934354e7b5865bf8d80de87117011b8085d0059771bc07b4905128943753d95f4b3e3b053131c71c4cea6e313673bef606dbdd040a71dae6074e459b5a63b68097d9c1575a5b8125adb14eb535b78a58d044d1555ac5f35c75b9a8760534a71a8f1d9e139ee6a33cc4892640bc968a20ddbb02512b070f94fd6dcc027808731cd72ae9e20911369f0b4231828c5bf8d10a044a250dce140af5d95f117c1e98f08200214440a9002727772684b956a5a4346047fd1d766bff00a05c4164c9b220fd84945e68c8139e0a73939e8bd076e5f55821ff008bacc8e56cb1d15dfba64e596ec5c89646ec0ee24213674655f39afcd55f3009f7011909552503403be088fd1eaf37956e32ca7964925f57c63ef3239b696dcd2a1eddc82113a54845c554aaa15406815936e5f8bb7f78b86371396b7ca5b751248c8a3cd651f92bd0d7c92626c59616398b475cd944e0f6b9a830230829d6a51b672fd772fd67216ebe30178aa29642c6d8db7eadafb3e35b677feb19036593ea3d9b3dfb4f2bd62ca396f18361b2c8d99b2ba3d877690850af069458027513c8d5c43460ac8cf724af6f7b5d1b7be22ebf6f1bd2dee771764b35ecf35f3115e9e07837b514913258ef2ca4b191db269aa150bcca73d1aa3d9ce5e402b3b096fe56471c109ad3d9ee04b78161b333e326b1cad8dfb7a09258e26dcfb2e22dd5d7b9cce57998c85d9077275f4ffc19acd0c73457967358c8cee0220af15e20291c02327dd63849e64c8e389842b894451645e5f7081a26cae61c77b65e402c7378ebde5c92c510b8f65c3c0ae7dd1eae3d9b313a9259a675400e72ee8707a8347c6de0b98239e22c92dae5a41141a48f0d16f8dbebf36389b2b10e3e48354868b232d44cff00925d0f60535e558fb0e46cc597b6d8cc20b9b7b8670dc7b95db94fec397994933e57171d0055a2251402a6dafa810631c397c58bc8dae918ef9146c9a6759e123622688ee804e341349417929fd61c1f40815b850dccd0bed3daf250ab5f6dc7caadeeadae5ba55575011d0aa20387d62f3e0be0a9ae573b618c65d7b965a593fc8b22f50fb058138d7d8496a510a9a4ae5355cb3ad1062f807643803884c99cc759fb3e4edd7f99705343a808bbc4070235b790c5716cff009214480335ed5f73fccbd16828fc8158e4af71f3e1f2d6f95b42114e0a4151f1efed7701d7fdc6a11e3aaaf07d11d28804e09cd51beadd3e9829be6c54b2c7147ec5ec735f88dc019403a6fa5015617f758bbac7dfdbe42d7ba23670a9ab582eae1d7573a1d0f72341c91c1454d0a0c088dc0d7d6b276d6983c8e4ef33135b7afb4c795c6498fb984f9b69434d027914c1656e719776f710dc4446e7bfb1dcfebe1f52f20f9940b9da11c54d0723740511e1b71576271d0c71b9ab278e8efad5f1c96f3c80541db644d03586438eb0f99f651fea318f6bdae06bee7700bb4a22df2410e881152a9c36dfd7c6ef68eecedc7b65a3185ad91c0893c845354793cdada3e67d858b6de3a2abe32c944cb3b77fb795d068421ca1c65155a8e163bc5f8870365276602e3ec31c070d10a878de1ab844ff008e7c5d9c51c4e002684e6abd95b6f662a751a128115d0f3ca61e276e3d726f92ce4516cbdc2e0b2d2109e378dfe29fbaf5eb8f9f1606ed088dfdbae8c765a8d1c681a283935e00b6d0a286ce3a9d0af549fed97b40ca8cfdf7eee42009c2a6944e1b7a85dd242a8885ed17227cbf01437723c6751c35d0a217708f07aecdf1dcb9c0b329786d31c777403ecafdcea55c561a7fd7c9ec5514d2b2089f23e69381c681a28de50e494dd0f0636431de433fc91fb4dcd1ecddd1d0423b91b11bf9783a0779c417b5cc62c3f0fe4f1c83a8e5763c2c798e4c54ad2ec8df1bcbc882790d8023d8a93f1c4c9f2e397b9dcf94fc0e340c1f6f2aa82fa720afa6a111512df3a1b0077b71557146c5f54774f5ead2fc986037cd5d0bacb703bee70e7d783b6a535764752a6712e6ab502b75f8eaf5e9727958646e7f52c0540d5c682307907836d070edc1555a1e19c6ec0ad00f2b9a54eae5e90ffbfdbee7e3c7703f723b710e5edc450dc704c3ec8d5a05706af3df472f4c7f8e53db6e3e5caeae2008c1e403a1e061db9077d5a786415645b8b46ed38a3ca28a72f53778e76fee3f6afd53479f270141c808a3a6c987ee435af115d8ea11a283b5a81e171f91d5ddb1f746cef5a086e8e21a2315e6144af25fffda0008010202063f00d8163b04dac39d74a77ed3b531b5d2c54a59a8ddafffda0008010302063f00f9ff001e1c6bf15c24174ab7ca49f56b5c47de423f5470faa27bc93c1c334409cc012bca017940dd5e4a07a716b04b3509278a814e776bffda0008010101063f00ff00c220b5d8bd66135a29bd508ebb7d553fbc8ee7072e3a8ffd3451e2cc3d103612ff004e3bdc2a5dd775ccfe7538ff008afe7ac49dcd06d954487c9aa9da538bd87ac954788c1bfb148622ae2642e61d4ef19f4eafd4d28215d70c875525defcfabda54fd382cc665ad66249627c7bd125316dbe18988d463618079ae3432d8de7ac05357b7a634ad4deb3abdafa6a512a67b3ae04de8373c7ddfd7d2fb4a7fd825dc8555b4b1320078cd1d87fd5badc96fe2489dbd4c2a3feb435472ceec66cec6659baf52f4099004689f298d42344e2cb324c4718896b1a203a31474b559495653e23ac28ad73128b61bc2e543f8b4ff8a2e7a3c52acea523c5bad5283f4e9f0e2cc6405a49d004361e89b9815360d75a5ebaafd9fd4d2fcc890b22db4ec8da7fbf5b26d8d31a634ca2c89ca3444e3fc615e9b1a7516d571a560537029e2409dc9d8e073aa51e1b570140affa54617aaa3126a95f494b7773b1ed3f4e24b1a4183a87c392cb236c6ead9b62db39626d16082008b04a3734c156b2247488c354a84ad25a9bec742870d45dbc8de80ca41536822d07858c35132af8a9a820c8a521e9eafec7e2400001c9167bf00dd27646f1f7b440001e58b6c1aa05e133c71a0468cb6e59caddb1a22cb09d13864a80770d711d449593a3b9f67c2ea9617568b1a549362a1defc4ab5202af84ec81659125599f83e546fead9a2000234787dc489468329c5bab541ffaf69b8af37a6662ed334c3768b77ed78557c49b7b2466038c0dc824dacc49278db79e013a4da4ed8d9eebcb04cad831866a66eb8aa9749db797852d156ba6bb80c35b228ed5d3cfece1578ed80367bbc8c311cd2670646d1a0eb8c3621eda8c927f2d3b9a9f4384e0ecd06a4ceaf55bb0188cfb7dc94f82704461c8005e2e4c8ce66fbf3ba9c270875768c3df5ff2c5e9716591316b01cb0244196991c9c596796473246270a358a9501f3b84e14eb1580f7d2a401c592ed3b10597b5b1f1227266d804fe7c5a1c0d51342c0fbd00b1265a035b1bf6649c13b20845304c8d912624fc100836fc7015ac7d9b7291e11187f1ef3f9ceedc2699d69590fd3a7fd7020aad97ac278a2d136da6262438e39c22c20f264b32ca2d1e18d022da6a63756ef108dc241d5cb12a824e2c276f8d13873b01f8a30b4e574ad24040db75784d42742156f7996071d992c136360112aa4d5ac74535b65f261de9e1fbaa52ed184c840c7b3a7dad4f57da3c768f48a81d21688b0de1b62590d907962f31089ad8ff00442dda2f54b73660ef790bcf817e8155daa6728ed30efda20e721e701e24061a32ddeb1bbe71bb014685000f0709afe4ff008ac0c92a4b7aa1b01d4be34335669d663cf6d9d2487a348b54a2c6c34cd95141ed29f6f4fec7ed21d6a02d56af4355351d1dee9fd640645bb395e99d5d25bab1664e589f41b4c1af8843504fbb51234e9a0e8252fac7fac8a58dc0bb537a6a5180ddab4e7eb2927ddbf655202b9b94010ce4890377994f7e3b6c19bbb57a24c4e574eb5e3c8628a0b49a8b67235ee155976a37c50bc9938e344580c6f583645996cc92d1c7123bc38a2d0de18d1289e54ab54dda68c49204f535ddd8b946a02fa6e9055a5f2f84166325513278845414dda9d31301059bb00649e9cb6c4844e27927974649e524c070c54a19a81d1eac52aeba2a283e1e9f07ae41912b2f38aac2ed22f13cb1c996c8db90ce26746a116b5d9458d3896d891d23e1cfba355a4406d4c229cfa2cc0725ee0f565b57e94291d516c714f2f1ea8e3c967862584a02a8d24932f3201c453ec9f5acef0f92d0667c31d9a50a8fe35807c9806523b2279cb5d0d800568571b65efc50074b82fe79bebf3383d7502642def34f690aa7588ddb46de3cce38e38b626ac40d90435b178033e3d11b84089b1998966b5494ee8b06d3d18a8ce6f5f16885c3ae977503c26ec2d35e6a00a3900bbc1ca9b41122388c3e1de60d26214f8bcea6de64096ccb3c8444e266c8ddb65a845bbbc513073d506bb4c103588359977290369ebb6eaaf99c2457a43bd51265eba8fdc48e4cd9b18bab6b6d3a2379a67962c338993130d126323f1c599a4a61ea328b1582991f9501f17dda6aa60ef9fbc65f470129a8545d0070a350a94736b143767e543535e648159db61198778a8e2b23784ced36c5aa3de8b104a2d458e681c91ddb11c5a440bed79a71319529f5984f93a7c3a9d71ab71bc3bc996512894a71608b01945ab168ce6aa7a0b672b70e7a47a42c3b0f41a0ab09329208e319864672d3934468cee58ab2d09757c3bcefc3ea002464a4cb5cc665964ed3cb1c592cce2fac737962ab6d7f8870f6f257248e5e2cfe5803508276bb7f4f0d353135003d1a62da8e7ab4a947fb444a14c5811876aec4f36fbee7b38518b6bf8934d0d520051788bdd9a2a742966698d3974e74b58769f0c3540bd59f72826d7973dfeca8fa4a90d56ab17aae66eed6b313095dd6785c29beec743551bd87a3e3eff7b14aa1d151489f8cbfe4ccb634c698d31a73abff00a4a869622f4e93091dfa7bdd95447bdddd5f4717715855a8e2c251bb3331cebf4ea2d5835e8828ca6ed4a6dce46e774784b54a8c151016663a028e734356b4525dda087a29d7fbdafe92a7e5c044137721546d626eac52c2a7404ddbad51bd354826989d6a07b4a6069377d252fc5a50186822cf70b733745e762022f599b75162951e9a09b91adcefd56f3e056a425471736ba3a1507a64fc4f4b08acd2a389952a8354cffc6abf22af77f8bc25b038469e154f7b507ae71ea93ffcf4bdb54fb3c9db9131445efc46e679994ba8ff006b886bc87553aa7d2506f12afaaf70b330e3aaace95132a33d0d57a753f03f5326187483b11c92dec987ae5af3b200e7c75eeeadef97c188ab5c338f574fbc7f369fee47fa7c286c3e1ccc54248ed2a8ea6e7a1a3fa996b9d7797e2cad4ea2874712653a088936fe1d8ca9d4d6bf615ff6ea7ac8b332cc938908e382a0dda49e96a7547d5d3fb685a3456ed341755760c94e90d145483e531dec9359be1dcf7b4b6fdad2ea56fd489e1aa86694cd33bb517caa4dc06f547545dac428f9d0476ddb30e8d217fda7a1f69057094053f1ea1bc7f2a9ee7b483dbe21d81e803713f2e95c8e2ccafcab98d4aaade47126531d9d49b5063dd55fd9adf6bfa99f745ac6c0040a98a9d1a5a6efad6f16efa8814a8a84a6bcd51a22d8673a84e0b369227e71bd9430254a9b083220f8acb013123fd4d31ac9bb547e2732afe27e64014aa85a87d53ee3fcef49f87ee77aabaa2ed62147cf832addb30e8d205fe7fa2f6912c2e1c2f8d54cfd9d1fe58976fd90d94c04f69bf522755daa1dae4bfd38967d53ac819ad4aa0bc8e24c22a616af3e999a93eb299f455b30936403497b3a1aeb38dd97d8d3e7d689d35352b6baaf6bfc8e8518ff00089e434c681ce30efa89b0710e6e7055a9da531eaeaef8f9153d35380b8953876eb73e9f9e9de27e5c5fa1516aa1d6a43671187a09486a2e4d46f353b248dec4b28d94c2d3fa0bda45ea8c5db6b12e7da7ba30d7297bd9c2a5321315467d9bea61d3a15bec9fd9c1a5590d2ac9ce43fdf9993b3a285db8b40f29a055c5caad4d213d5aff0033c48681984ecd1cb15eb1b422b1f95cdf70988ed293b5371d24255be6401519710bb2a0badf9d4bf8e00c42be1d8eb3be9f994bf8a2f61eaad55daa43701345ac5ab68f28669155afd794d282fa46fe2fc4863875a787a679a08ed1be5d46dc8ff7294f1405a2f2c997eeead06a556e40189c1141d26a551ac1f775bff785a980656a0da1976fdafaced7ef3271664b5432ce4d56a2a01d6f5d5157eed17dd2f292add65254f9c90035415d3ab56d3f9e9de47fc51a3eb3a5f97e8fdcb975c5867994aa03228c0c537eb28390926405a4986c2ffd5b02cb63e26c2bf7784fac7fb6f470cf5096a8c66ccc66cc7c77c9658636c76f85728dd25f5750752bd2e9fea40af4b76a2eed6a479d4dff008dfd554cde23a229e154cd70c96fde55ef1bd95ce133d078a37b4eddb9987a9a4dd91f04354aac129a09b33190020e1b085a960ed0e74357fe3c3fea40d82030d7996c0c5618f13d33cda89f5553fbf77098ac399a3d841e7238f4946af8f4f30bb7310166e41bcd15712da6b397f013ddfb3c93e0f33ef66bbe25c2ad2aacaa3a4d3bb5129d2a7d380a54a5053ddd00663ef711f5957f4e03d6b491a22e5ad49f7a939d63a54fef2945c3e08966dea40d4a15242bd1d4cbf5c9d4ad4bff009c2d6a0e2a5271356196b48c9eb4a9291a7bcf49ec73245639a6344b81dba738af211e1dd85a929b11a72361d8dd277a9bf52a0e63ff002c353a8b72a212aebb1873a2635db992160d66022092749b598bb4c6e6964dbe37971794cc1f83cac985c28d41ab30e5ee297ee66718d1c2d46d98843c4325914318a37eb134dc0e91417e955f33bb8de63668022578c1065609c0502d3a040a682cd660002d89080d4cc89d20e86f2a2405da82db87f6da2bd41cc422927934f73f53b4cd9ebe148fd5606138b21e28c4355504d2bad449d2b549eca93a79f1e0c80ec041e431498f3436f72735a2f002675c48413022be21ececa9b34f8e5ddfb489b69369e539c65c0c8cf5e407e0c879630f861eb9cd47f2690eefdad4c87960c1e5f8e28b13365171fca4dc8b6397252c2ae9c4bcdfeee96ffcfad9dc66c1007bfc0c679a7d598f86f2fd28313da618a99d2a53a74bc953de55fc6ab1c507218ad8463619544fa15731a98334c2a8a43cb3df57fa79d3d43e3e0567bf9679ccbc8dfb7138ad510c9c8b89e5d4eed625b218f141c928c3d49c816b8791f772bd7a9625252edc882f43d67e7d562edcae7b4cd9eb8970596cce5f1c15f0f3d3e8c2c8e99450c1a9e6835aa72b777875f33b4a913863ae27955c695607de308fd6507e0c8c82c35dd29fc99f6b57f4f3b897e3e188e3a2418218c952d27628debd15b13aaa36e0ead31b9417f2f2486939844619f6d35f8064c36101b29a9aafcafdcd2f9895734989eb369e0f3cc9e460a77f12a13917d7b65005a4e6d11ae9de4f78c08c556066b7ee21f169771fd19a175693c2259caa4d8a2c1ca7209c0cdaf4fa9527e708c46275d2a6c57ca95ca5ed22dd3acf1e613178e93c207c39ca720d9078edcdc652e246fe98a786077b13504fc8a5df3fb4ecb3428f0c4b84cf367b0e539b553af48fcd30290e6e1a985f96fdfd5fdacc9c5e3afdda5b3dd259ac38a045b0c3466d21a9d2a0f9b7ff00a6313891cdab558af920f674bd9a6605f7fdde5b7dd2713cd96c304994139b4f1204ca0712f2d1e8ff005c01efe5262f1d27ddbc31ffd9	0998804603	Sanjapamba	t	M	2002-01-03 00:00:00	0	\N	f	2026-01-31 14:08:07.525452	1	fc10a2225fa4cfdcf536feca3bdb4604289890389f3955234160fa6ef1120ece	2026-01-05 16:47:09.530163	2026-01-06 00:47:09.530163	200.112.220.40	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0	2026-01-05 16:49:10.839677
9	jeny	$2b$12$SLD92USnN6qqV4T/Ovt6Y.K80hljXmxnlK/Jx9kbXeBSyUycSS4qC	Jeny Alexandra	Gavilanez	0605686696	jenygavilanez@gmail.com	2025-10-27 10:22:01.391676	\N	0999999999	Sanjapamba	t	F	2005-02-16 00:00:00	0	\N	f	2026-01-11 12:36:27.27735	4	\N	\N	\N	\N	\N	\N
\.


--
-- Name: t_auditoria_sistema_id_seq; Type: SEQUENCE SET; Schema: auditoria; Owner: postgres
--

SELECT pg_catalog.setval('auditoria.t_auditoria_sistema_id_seq', 1, false);


--
-- Name: limites_geograficos_id_seq; Type: SEQUENCE SET; Schema: configuracion; Owner: postgres
--

SELECT pg_catalog.setval('configuracion.limites_geograficos_id_seq', 6, true);


--
-- Name: t_configuracion_backup_id_seq; Type: SEQUENCE SET; Schema: configuracion; Owner: postgres
--

SELECT pg_catalog.setval('configuracion.t_configuracion_backup_id_seq', 2, true);


--
-- Name: t_iva_id_iva_seq; Type: SEQUENCE SET; Schema: configuracion; Owner: postgres
--

SELECT pg_catalog.setval('configuracion.t_iva_id_iva_seq', 14, true);


--
-- Name: t_asignacion_servicio_permanente_id_asignacion_sp_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_asignacion_servicio_permanente_id_asignacion_sp_seq', 5, true);


--
-- Name: t_configuracion_mora_id_configuracion_mora_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_configuracion_mora_id_configuracion_mora_seq', 1, true);


--
-- Name: t_configuracion_servicio_permanente_id_configuracion_sp_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_configuracion_servicio_permanente_id_configuracion_sp_seq', 1, true);


--
-- Name: t_factura_cod_factura_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_factura_cod_factura_seq', 135, true);


--
-- Name: t_factura_servicio_cod_factura_servicio_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_factura_servicio_cod_factura_servicio_seq', 228, true);


--
-- Name: t_mora_factura_id_mora_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_mora_factura_id_mora_seq', 11, true);


--
-- Name: t_pagos_cod_pago_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_pagos_cod_pago_seq', 119, true);


--
-- Name: t_tarifa_cod_tarifa_seq; Type: SEQUENCE SET; Schema: facturacion; Owner: postgres
--

SELECT pg_catalog.setval('facturacion.t_tarifa_cod_tarifa_seq', 8, true);


--
-- Name: t_historial_medidor_id_historial_seq; Type: SEQUENCE SET; Schema: medidores; Owner: postgres
--

SELECT pg_catalog.setval('medidores.t_historial_medidor_id_historial_seq', 4, true);


--
-- Name: t_lecturas_cod_lectura_seq; Type: SEQUENCE SET; Schema: medidores; Owner: postgres
--

SELECT pg_catalog.setval('medidores.t_lecturas_cod_lectura_seq', 200, true);


--
-- Name: t_medidor_cod_medidor_seq; Type: SEQUENCE SET; Schema: medidores; Owner: postgres
--

SELECT pg_catalog.setval('medidores.t_medidor_cod_medidor_seq', 25, true);


--
-- Name: t_sector_cod_sector_seq; Type: SEQUENCE SET; Schema: medidores; Owner: postgres
--

SELECT pg_catalog.setval('medidores.t_sector_cod_sector_seq', 9, true);


--
-- Name: t_servicios_cod_servicio_seq; Type: SEQUENCE SET; Schema: medidores; Owner: postgres
--

SELECT pg_catalog.setval('medidores.t_servicios_cod_servicio_seq', 7, true);


--
-- Name: t_multa_cod_tipo_multa_seq; Type: SEQUENCE SET; Schema: multas; Owner: postgres
--

SELECT pg_catalog.setval('multas.t_multa_cod_tipo_multa_seq', 7, true);


--
-- Name: t_multas_usuario_cod_multa_usuario_seq; Type: SEQUENCE SET; Schema: multas; Owner: postgres
--

SELECT pg_catalog.setval('multas.t_multas_usuario_cod_multa_usuario_seq', 66, true);


--
-- Name: t_notificaciones_cod_notificacion_seq; Type: SEQUENCE SET; Schema: notificaciones; Owner: postgres
--

SELECT pg_catalog.setval('notificaciones.t_notificaciones_cod_notificacion_seq', 991, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 1, false);


--
-- Name: t_auditoria_contrasenas_id_auditoria_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_auditoria_contrasenas_id_auditoria_seq', 14, true);


--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_auditoria_sesiones_id_auditoria_seq', 21, true);


--
-- Name: t_configuracion_sistema_id_configuracion_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_configuracion_sistema_id_configuracion_seq', 38, true);


--
-- Name: t_historial_contrasenas_id_historial_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_historial_contrasenas_id_historial_seq', 21, true);


--
-- Name: t_rol_acciones_id_rol_accion_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_rol_acciones_id_rol_accion_seq', 173, true);


--
-- Name: t_roles_id_rol_seq; Type: SEQUENCE SET; Schema: seguridad; Owner: postgres
--

SELECT pg_catalog.setval('seguridad.t_roles_id_rol_seq', 5, true);


--
-- Name: t_auditoria_sesiones_id_auditoria_seq; Type: SEQUENCE SET; Schema: usuarios; Owner: postgres
--

SELECT pg_catalog.setval('usuarios.t_auditoria_sesiones_id_auditoria_seq', 7, true);


--
-- Name: t_usuario_afiliado_cod_usuario_afi_seq; Type: SEQUENCE SET; Schema: usuarios; Owner: postgres
--

SELECT pg_catalog.setval('usuarios.t_usuario_afiliado_cod_usuario_afi_seq', 27, true);


--
-- Name: t_usuario_sistema_cod_usuario_sistema_seq; Type: SEQUENCE SET; Schema: usuarios; Owner: postgres
--

SELECT pg_catalog.setval('usuarios.t_usuario_sistema_cod_usuario_sistema_seq', 20, true);


--
-- Name: t_auditoria_sistema t_auditoria_sistema_pkey; Type: CONSTRAINT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.t_auditoria_sistema
    ADD CONSTRAINT t_auditoria_sistema_pkey PRIMARY KEY (id_auditoria_sistema);


--
-- Name: t_limites_geograficos limites_geograficos_nombre_key; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_limites_geograficos
    ADD CONSTRAINT limites_geograficos_nombre_key UNIQUE (nombre);


--
-- Name: t_limites_geograficos limites_geograficos_pkey; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_limites_geograficos
    ADD CONSTRAINT limites_geograficos_pkey PRIMARY KEY (id);


--
-- Name: t_configuracion_backup t_configuracion_backup_nombre_key; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_configuracion_backup
    ADD CONSTRAINT t_configuracion_backup_nombre_key UNIQUE (nombre);


--
-- Name: t_configuracion_backup t_configuracion_backup_pkey; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_configuracion_backup
    ADD CONSTRAINT t_configuracion_backup_pkey PRIMARY KEY (id);


--
-- Name: t_iva t_iva_codigo_key; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_iva
    ADD CONSTRAINT t_iva_codigo_key UNIQUE (codigo);


--
-- Name: t_iva t_iva_pkey; Type: CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_iva
    ADD CONSTRAINT t_iva_pkey PRIMARY KEY (id_iva);


--
-- Name: t_asignacion_servicio_permanente t_asignacion_servicio_permanente_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_asignacion_servicio_permanente
    ADD CONSTRAINT t_asignacion_servicio_permanente_pkey PRIMARY KEY (id_asignacion_sp);


--
-- Name: t_detalle_factura t_cod_detalle_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura
    ADD CONSTRAINT t_cod_detalle_pkey PRIMARY KEY (id_detalle);


--
-- Name: t_configuracion_mora t_configuracion_mora_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_configuracion_mora
    ADD CONSTRAINT t_configuracion_mora_pkey PRIMARY KEY (id_configuracion_mora);


--
-- Name: t_configuracion_servicio_permanente t_configuracion_servicio_permanente_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_configuracion_servicio_permanente
    ADD CONSTRAINT t_configuracion_servicio_permanente_pkey PRIMARY KEY (id_configuracion_sp);


--
-- Name: t_factura t_factura_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura
    ADD CONSTRAINT t_factura_pkey PRIMARY KEY (id_factura);


--
-- Name: t_mora_factura t_mora_factura_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_mora_factura
    ADD CONSTRAINT t_mora_factura_pkey PRIMARY KEY (id_mora);


--
-- Name: t_pagos t_pagos_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_pagos
    ADD CONSTRAINT t_pagos_pkey PRIMARY KEY (id_pago);


--
-- Name: t_tarifa t_tarifa_pkey; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_tarifa
    ADD CONSTRAINT t_tarifa_pkey PRIMARY KEY (id_tarifa);


--
-- Name: t_factura uk_num_factura; Type: CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura
    ADD CONSTRAINT uk_num_factura UNIQUE (num_factura);


--
-- Name: t_historial_medidor t_historial_medidor_pkey; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor
    ADD CONSTRAINT t_historial_medidor_pkey PRIMARY KEY (id_historial);


--
-- Name: t_lecturas t_lecturas_pkey; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_lecturas
    ADD CONSTRAINT t_lecturas_pkey PRIMARY KEY (id_lectura);


--
-- Name: t_medidor t_medidor_pkey; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_medidor
    ADD CONSTRAINT t_medidor_pkey PRIMARY KEY (id_medidor);


--
-- Name: t_sector t_sector_pkey; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_sector
    ADD CONSTRAINT t_sector_pkey PRIMARY KEY (id_sector);


--
-- Name: t_servicios t_servicios_pkey; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_servicios
    ADD CONSTRAINT t_servicios_pkey PRIMARY KEY (id_servicio);


--
-- Name: t_lecturas unique_medidor_periodo; Type: CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_lecturas
    ADD CONSTRAINT unique_medidor_periodo UNIQUE (id_medidor, fecha_lectura);


--
-- Name: t_multa t_multa_pkey; Type: CONSTRAINT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multa
    ADD CONSTRAINT t_multa_pkey PRIMARY KEY (id_tipo_multa);


--
-- Name: t_multas_afiliados t_multas_afiliados_pkey; Type: CONSTRAINT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multas_afiliados
    ADD CONSTRAINT t_multas_afiliados_pkey PRIMARY KEY (id_multa_afi);


--
-- Name: t_notificaciones t_notificaciones_pkey; Type: CONSTRAINT; Schema: notificaciones; Owner: postgres
--

ALTER TABLE ONLY notificaciones.t_notificaciones
    ADD CONSTRAINT t_notificaciones_pkey PRIMARY KEY (id_notificacion);


--
-- Name: t_auditoria_contrasenas t_auditoria_contrasenas_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_contrasenas
    ADD CONSTRAINT t_auditoria_contrasenas_pkey PRIMARY KEY (id_auditoria);


--
-- Name: t_auditoria_sesiones t_auditoria_sesiones_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_sesiones
    ADD CONSTRAINT t_auditoria_sesiones_pkey PRIMARY KEY (id_auditoria);


--
-- Name: t_configuracion_sistema t_configuracion_sistema_clave_key; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_configuracion_sistema
    ADD CONSTRAINT t_configuracion_sistema_clave_key UNIQUE (clave);


--
-- Name: t_configuracion_sistema t_configuracion_sistema_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_configuracion_sistema
    ADD CONSTRAINT t_configuracion_sistema_pkey PRIMARY KEY (id_configuracion);


--
-- Name: t_historial_contrasenas t_historial_contrasenas_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_historial_contrasenas
    ADD CONSTRAINT t_historial_contrasenas_pkey PRIMARY KEY (id_historial);


--
-- Name: t_rol_acciones t_rol_acciones_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_rol_acciones
    ADD CONSTRAINT t_rol_acciones_pkey PRIMARY KEY (id_rol_accion);


--
-- Name: t_roles t_roles_nombre_rol_key; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_roles
    ADD CONSTRAINT t_roles_nombre_rol_key UNIQUE (nombre_rol);


--
-- Name: t_roles t_roles_pkey; Type: CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_roles
    ADD CONSTRAINT t_roles_pkey PRIMARY KEY (id_rol);


--
-- Name: t_auditoria_sesiones t_auditoria_sesiones_pkey; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_auditoria_sesiones
    ADD CONSTRAINT t_auditoria_sesiones_pkey PRIMARY KEY (id_auditoria);


--
-- Name: t_usuario_afiliado t_usuario_afiliado_pkey; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_afiliado
    ADD CONSTRAINT t_usuario_afiliado_pkey PRIMARY KEY (id_usuario_afi);


--
-- Name: t_usuario_sistema t_usuario_sistema_pkey; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_sistema
    ADD CONSTRAINT t_usuario_sistema_pkey PRIMARY KEY (id_usuario_sistema);


--
-- Name: t_usuario_sistema t_usuario_sistema_session_token_key; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_sistema
    ADD CONSTRAINT t_usuario_sistema_session_token_key UNIQUE (session_token);


--
-- Name: t_usuario_sistema uq_cedula; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_sistema
    ADD CONSTRAINT uq_cedula UNIQUE (cedula);


--
-- Name: t_usuario_sistema uq_usuario; Type: CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_sistema
    ADD CONSTRAINT uq_usuario UNIQUE (usuario);


--
-- Name: idx_config_backup_activo; Type: INDEX; Schema: configuracion; Owner: postgres
--

CREATE INDEX idx_config_backup_activo ON configuracion.t_configuracion_backup USING btree (activo);


--
-- Name: idx_t_iva_activo; Type: INDEX; Schema: configuracion; Owner: postgres
--

CREATE INDEX idx_t_iva_activo ON configuracion.t_iva USING btree (activo);


--
-- Name: idx_t_iva_codigo; Type: INDEX; Schema: configuracion; Owner: postgres
--

CREATE INDEX idx_t_iva_codigo ON configuracion.t_iva USING btree (codigo);


--
-- Name: idx_asignacion_sp_activo; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_asignacion_sp_activo ON facturacion.t_asignacion_servicio_permanente USING btree (activo);


--
-- Name: idx_asignacion_sp_configuracion; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_asignacion_sp_configuracion ON facturacion.t_asignacion_servicio_permanente USING btree (id_configuracion_sp);


--
-- Name: idx_asignacion_sp_usuario; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_asignacion_sp_usuario ON facturacion.t_asignacion_servicio_permanente USING btree (id_usuario_afi);


--
-- Name: idx_configuracion_sp_activo; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_configuracion_sp_activo ON facturacion.t_configuracion_servicio_permanente USING btree (activo);


--
-- Name: idx_configuracion_sp_servicio; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_configuracion_sp_servicio ON facturacion.t_configuracion_servicio_permanente USING btree (id_servicio);


--
-- Name: idx_detalle_asignacion_sp; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_detalle_asignacion_sp ON facturacion.t_detalle_factura USING btree (id_asignacion_sp);


--
-- Name: idx_detalle_factura; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_detalle_factura ON facturacion.t_detalle_factura USING btree (id_factura);


--
-- Name: idx_factura_fecha; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_factura_fecha ON facturacion.t_factura USING btree (fecha_emision);


--
-- Name: idx_factura_num; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_factura_num ON facturacion.t_factura USING btree (num_factura);


--
-- Name: idx_factura_periodo_estado; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_factura_periodo_estado ON facturacion.t_factura USING btree (periodo, estado_factura);


--
-- Name: idx_factura_usuario; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_factura_usuario ON facturacion.t_factura USING btree (id_usuario_afi);


--
-- Name: idx_pago_fecha_estado; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_pago_fecha_estado ON facturacion.t_pagos USING btree (fecha_pago, estado_pago) WHERE (activo = true);


--
-- Name: idx_pagos_estado; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_pagos_estado ON facturacion.t_pagos USING btree (estado_pago);


--
-- Name: idx_pagos_factura; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_pagos_factura ON facturacion.t_pagos USING btree (id_factura);


--
-- Name: idx_pagos_usuario; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_pagos_usuario ON facturacion.t_pagos USING btree (id_usuario_afi);


--
-- Name: idx_tarifa_es_vigente; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_tarifa_es_vigente ON facturacion.t_tarifa USING btree (es_vigente);


--
-- Name: idx_tarifa_limites; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_tarifa_limites ON facturacion.t_tarifa USING btree (limite_min_m3, limite_max_m3);


--
-- Name: idx_tarifa_tipo_vigente; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_tarifa_tipo_vigente ON facturacion.t_tarifa USING btree (tipo_tarifa, es_vigente);


--
-- Name: idx_tarifa_vigencia_desde; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE INDEX idx_tarifa_vigencia_desde ON facturacion.t_tarifa USING btree (vigencia_desde);


--
-- Name: uq_asignacion_sp_activa; Type: INDEX; Schema: facturacion; Owner: postgres
--

CREATE UNIQUE INDEX uq_asignacion_sp_activa ON facturacion.t_asignacion_servicio_permanente USING btree (id_configuracion_sp, id_usuario_afi) WHERE (activo = true);


--
-- Name: idx_hist_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_activo ON medidores.t_historial_medidor USING btree (activo);


--
-- Name: idx_hist_afi_anterior; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_afi_anterior ON medidores.t_historial_medidor USING btree (id_usuario_afi_anterior);


--
-- Name: idx_hist_afi_nuevo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_afi_nuevo ON medidores.t_historial_medidor USING btree (id_usuario_afi_nuevo);


--
-- Name: idx_hist_facturado; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_facturado ON medidores.t_historial_medidor USING btree (facturado, activo);


--
-- Name: idx_hist_fecha_cambio; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_fecha_cambio ON medidores.t_historial_medidor USING btree (fecha_cambio);


--
-- Name: idx_hist_medidor; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_medidor ON medidores.t_historial_medidor USING btree (id_medidor);


--
-- Name: idx_hist_usuario_sistema; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_hist_usuario_sistema ON medidores.t_historial_medidor USING btree (id_usuario_sistema);


--
-- Name: idx_lecturas_activas_fecha; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_activas_fecha ON medidores.t_lecturas USING btree (fecha_lectura DESC) WHERE (activo = true);


--
-- Name: idx_lecturas_consumo_fecha; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_consumo_fecha ON medidores.t_lecturas USING btree (fecha_lectura DESC, consumo_m3 DESC NULLS LAST) WHERE (activo = true);


--
-- Name: idx_lecturas_fecha_medidor; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_fecha_medidor ON medidores.t_lecturas USING btree (fecha_lectura DESC, id_medidor);


--
-- Name: idx_lecturas_lector; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_lector ON medidores.t_lecturas USING btree (id_lector);


--
-- Name: idx_lecturas_medidor_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_medidor_activo ON medidores.t_lecturas USING btree (id_medidor, activo);


--
-- Name: idx_lecturas_medidor_fecha_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_medidor_fecha_activo ON medidores.t_lecturas USING btree (id_medidor, fecha_lectura DESC) WHERE (activo = true);


--
-- Name: idx_lecturas_mes_anio; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_mes_anio ON medidores.t_lecturas USING btree (EXTRACT(year FROM fecha_lectura), EXTRACT(month FROM fecha_lectura));


--
-- Name: idx_lecturas_periodo_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_periodo_activo ON medidores.t_lecturas USING btree (EXTRACT(year FROM fecha_lectura), EXTRACT(month FROM fecha_lectura), activo);


--
-- Name: idx_lecturas_periodo_consumo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_periodo_consumo ON medidores.t_lecturas USING btree (EXTRACT(year FROM fecha_lectura), EXTRACT(month FROM fecha_lectura), id_medidor, consumo_m3) WHERE (activo = true);


--
-- Name: idx_lecturas_reporte_completo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_reporte_completo ON medidores.t_lecturas USING btree (fecha_lectura DESC, activo, es_estimada, id_medidor);


--
-- Name: idx_lecturas_tipo_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_lecturas_tipo_activo ON medidores.t_lecturas USING btree (es_estimada) WHERE (activo = true);


--
-- Name: idx_medidor_activo; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_medidor_activo ON medidores.t_medidor USING btree (activo);


--
-- Name: idx_medidor_num_trgm; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_medidor_num_trgm ON medidores.t_medidor USING gin (num_medidor public.gin_trgm_ops);


--
-- Name: idx_medidor_sector; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_medidor_sector ON medidores.t_medidor USING btree (id_sector);


--
-- Name: idx_medidor_sector_activo_usuario; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_medidor_sector_activo_usuario ON medidores.t_medidor USING btree (id_sector, activo, id_usuario_afi);


--
-- Name: idx_medidor_usuario; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_medidor_usuario ON medidores.t_medidor USING btree (id_usuario_afi);


--
-- Name: idx_servicio_activo_vigente; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_servicio_activo_vigente ON medidores.t_servicios USING btree (activo, es_vigente);


--
-- Name: idx_servicio_es_vigente; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_servicio_es_vigente ON medidores.t_servicios USING btree (es_vigente);


--
-- Name: idx_servicio_vigencia_desde; Type: INDEX; Schema: medidores; Owner: postgres
--

CREATE INDEX idx_servicio_vigencia_desde ON medidores.t_servicios USING btree (vigencia_desde);


--
-- Name: idx_fecha; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_fecha ON multas.t_multas_afiliados USING btree (fecha_multa);


--
-- Name: idx_multa_es_vigente; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multa_es_vigente ON multas.t_multa USING btree (es_vigente);


--
-- Name: idx_multa_facturado; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multa_facturado ON multas.t_multas_afiliados USING btree (facturado);


--
-- Name: idx_multa_nombre; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multa_nombre ON multas.t_multa USING btree (nombre_multa);


--
-- Name: idx_multa_vigencia_desde; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multa_vigencia_desde ON multas.t_multa USING btree (vigencia_desde);


--
-- Name: idx_multas_activo; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multas_activo ON multas.t_multas_afiliados USING btree (activo);


--
-- Name: idx_multas_estado; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multas_estado ON multas.t_multas_afiliados USING btree (estado);


--
-- Name: idx_multas_id_tipo_multa; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multas_id_tipo_multa ON multas.t_multas_afiliados USING btree (id_tipo_multa);


--
-- Name: idx_multas_id_usuario_afi; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multas_id_usuario_afi ON multas.t_multas_afiliados USING btree (id_usuario_afi);


--
-- Name: idx_multas_usuario_estado; Type: INDEX; Schema: multas; Owner: postgres
--

CREATE INDEX idx_multas_usuario_estado ON multas.t_multas_afiliados USING btree (id_usuario_afi, estado);


--
-- Name: idx_notificaciones_estado; Type: INDEX; Schema: notificaciones; Owner: postgres
--

CREATE INDEX idx_notificaciones_estado ON notificaciones.t_notificaciones USING btree (estado);


--
-- Name: idx_notificaciones_fecha_inicio; Type: INDEX; Schema: notificaciones; Owner: postgres
--

CREATE INDEX idx_notificaciones_fecha_inicio ON notificaciones.t_notificaciones USING btree (fecha_inicio_mantenimiento);


--
-- Name: idx_notificaciones_mantenimiento; Type: INDEX; Schema: notificaciones; Owner: postgres
--

CREATE INDEX idx_notificaciones_mantenimiento ON notificaciones.t_notificaciones USING btree (es_mantenimiento);


--
-- Name: idx_notificaciones_prioridad; Type: INDEX; Schema: notificaciones; Owner: postgres
--

CREATE INDEX idx_notificaciones_prioridad ON notificaciones.t_notificaciones USING btree (prioridad);


--
-- Name: idx_notificaciones_tipo; Type: INDEX; Schema: notificaciones; Owner: postgres
--

CREATE INDEX idx_notificaciones_tipo ON notificaciones.t_notificaciones USING btree (tipo);


--
-- Name: idx_auditoria_accion; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_accion ON seguridad.t_auditoria_contrasenas USING btree (accion);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON seguridad.t_auditoria_contrasenas USING btree (fecha_hora DESC);


--
-- Name: idx_auditoria_sesiones_evento; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_sesiones_evento ON seguridad.t_auditoria_sesiones USING btree (evento);


--
-- Name: idx_auditoria_sesiones_fecha; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_sesiones_fecha ON seguridad.t_auditoria_sesiones USING btree (fecha_hora);


--
-- Name: idx_auditoria_sesiones_usuario; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_sesiones_usuario ON seguridad.t_auditoria_sesiones USING btree (id_usuario_sistema);


--
-- Name: idx_auditoria_sesiones_usuario_nombre; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_sesiones_usuario_nombre ON seguridad.t_auditoria_sesiones USING btree (usuario);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON seguridad.t_auditoria_contrasenas USING btree (id_usuario_sistema);


--
-- Name: idx_configuracion_activo; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_configuracion_activo ON seguridad.t_configuracion_sistema USING btree (activo);


--
-- Name: idx_configuracion_categoria; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_configuracion_categoria ON seguridad.t_configuracion_sistema USING btree (categoria);


--
-- Name: idx_configuracion_clave; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_configuracion_clave ON seguridad.t_configuracion_sistema USING btree (clave);


--
-- Name: idx_historial_fecha; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_historial_fecha ON seguridad.t_historial_contrasenas USING btree (fecha_cambio DESC);


--
-- Name: idx_historial_usuario; Type: INDEX; Schema: seguridad; Owner: postgres
--

CREATE INDEX idx_historial_usuario ON seguridad.t_historial_contrasenas USING btree (id_usuario_sistema);


--
-- Name: idx_auditoria_evento; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_auditoria_evento ON usuarios.t_auditoria_sesiones USING btree (evento, fecha_evento DESC);


--
-- Name: idx_auditoria_fecha; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_auditoria_fecha ON usuarios.t_auditoria_sesiones USING btree (fecha_evento DESC);


--
-- Name: idx_auditoria_usuario; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_auditoria_usuario ON usuarios.t_auditoria_sesiones USING btree (id_usuario_sistema, fecha_evento DESC);


--
-- Name: idx_cod_usuario_afi; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_cod_usuario_afi ON usuarios.t_usuario_afiliado USING btree (cod_usuario_afi);


--
-- Name: idx_session_active; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_session_active ON usuarios.t_usuario_sistema USING btree (id_usuario_sistema, session_token, session_expires_at) WHERE (session_token IS NOT NULL);


--
-- Name: idx_session_token; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_session_token ON usuarios.t_usuario_sistema USING btree (session_token) WHERE (session_token IS NOT NULL);


--
-- Name: idx_usuario_afi_activo; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_activo ON usuarios.t_usuario_afiliado USING btree (activo);


--
-- Name: idx_usuario_afi_fecha_activo; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_fecha_activo ON usuarios.t_usuario_afiliado USING btree (fecha_afiliacion, activo) WHERE (activo = true);


--
-- Name: idx_usuario_afi_fecha_afiliacion; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_fecha_afiliacion ON usuarios.t_usuario_afiliado USING btree (fecha_afiliacion);


--
-- Name: idx_usuario_afi_id_sector; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_id_sector ON usuarios.t_usuario_afiliado USING btree (id_sector);


--
-- Name: idx_usuario_afi_id_usuario_sistema; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_id_usuario_sistema ON usuarios.t_usuario_afiliado USING btree (id_usuario_sistema);


--
-- Name: idx_usuario_afi_sector_activo; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_afi_sector_activo ON usuarios.t_usuario_afiliado USING btree (id_sector, activo);


--
-- Name: idx_usuario_bloqueado; Type: INDEX; Schema: usuarios; Owner: postgres
--

CREATE INDEX idx_usuario_bloqueado ON usuarios.t_usuario_sistema USING btree (usuario, bloqueado_permanente, bloqueado_hasta);


--
-- Name: t_iva trigger_actualizar_iva; Type: TRIGGER; Schema: configuracion; Owner: postgres
--

CREATE TRIGGER trigger_actualizar_iva BEFORE UPDATE ON configuracion.t_iva FOR EACH ROW EXECUTE FUNCTION configuracion.actualizar_fecha_iva();


--
-- Name: t_medidor trg_sync_medidor_insert; Type: TRIGGER; Schema: medidores; Owner: postgres
--

CREATE TRIGGER trg_sync_medidor_insert AFTER INSERT ON medidores.t_medidor FOR EACH ROW WHEN ((new.id_usuario_afi IS NOT NULL)) EXECUTE FUNCTION public.sincronizar_num_medidor_a_afiliado();


--
-- Name: t_medidor trg_sync_medidor_update; Type: TRIGGER; Schema: medidores; Owner: postgres
--

CREATE TRIGGER trg_sync_medidor_update AFTER UPDATE OF num_medidor ON medidores.t_medidor FOR EACH ROW WHEN (((old.num_medidor)::text IS DISTINCT FROM (new.num_medidor)::text)) EXECUTE FUNCTION public.sincronizar_num_medidor_a_afiliado();


--
-- Name: t_configuracion_sistema trigger_actualizar_fecha_config; Type: TRIGGER; Schema: seguridad; Owner: postgres
--

CREATE TRIGGER trigger_actualizar_fecha_config BEFORE UPDATE ON seguridad.t_configuracion_sistema FOR EACH ROW EXECUTE FUNCTION seguridad.actualizar_fecha_modificacion_config();


--
-- Name: t_historial_contrasenas trigger_limpiar_historial; Type: TRIGGER; Schema: seguridad; Owner: postgres
--

CREATE TRIGGER trigger_limpiar_historial AFTER INSERT ON seguridad.t_historial_contrasenas FOR EACH ROW EXECUTE FUNCTION seguridad.limpiar_historial_antiguo();


--
-- Name: t_auditoria_sistema t_auditoria_sistema_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: auditoria; Owner: postgres
--

ALTER TABLE ONLY auditoria.t_auditoria_sistema
    ADD CONSTRAINT t_auditoria_sistema_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) NOT VALID;


--
-- Name: t_configuracion_backup t_configuracion_backup_actualizado_por_fkey; Type: FK CONSTRAINT; Schema: configuracion; Owner: postgres
--

ALTER TABLE ONLY configuracion.t_configuracion_backup
    ADD CONSTRAINT t_configuracion_backup_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema);


--
-- Name: t_asignacion_servicio_permanente fk_asignacion_sp_configuracion; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_asignacion_servicio_permanente
    ADD CONSTRAINT fk_asignacion_sp_configuracion FOREIGN KEY (id_configuracion_sp) REFERENCES facturacion.t_configuracion_servicio_permanente(id_configuracion_sp) ON DELETE CASCADE;


--
-- Name: t_asignacion_servicio_permanente fk_asignacion_sp_usuario_afi; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_asignacion_servicio_permanente
    ADD CONSTRAINT fk_asignacion_sp_usuario_afi FOREIGN KEY (id_usuario_afi) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) ON DELETE CASCADE;


--
-- Name: t_asignacion_servicio_permanente fk_asignacion_sp_usuario_sistema; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_asignacion_servicio_permanente
    ADD CONSTRAINT fk_asignacion_sp_usuario_sistema FOREIGN KEY (asignado_por) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) ON DELETE SET NULL;


--
-- Name: t_configuracion_servicio_permanente fk_configuracion_sp_servicio; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_configuracion_servicio_permanente
    ADD CONSTRAINT fk_configuracion_sp_servicio FOREIGN KEY (id_servicio) REFERENCES medidores.t_servicios(id_servicio) ON DELETE RESTRICT;


--
-- Name: t_detalle_factura fk_detalle_asignacion_sp; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura
    ADD CONSTRAINT fk_detalle_asignacion_sp FOREIGN KEY (id_asignacion_sp) REFERENCES facturacion.t_asignacion_servicio_permanente(id_asignacion_sp) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: t_factura fk_t_factura_tarifa; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura
    ADD CONSTRAINT fk_t_factura_tarifa FOREIGN KEY (id_tarifa) REFERENCES facturacion.t_tarifa(id_tarifa);


--
-- Name: t_detalle_factura t_detalle_factura_id_factura_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura
    ADD CONSTRAINT t_detalle_factura_id_factura_fkey FOREIGN KEY (id_factura) REFERENCES facturacion.t_factura(id_factura);


--
-- Name: t_detalle_factura t_detalle_factura_id_multa_afiliados_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura
    ADD CONSTRAINT t_detalle_factura_id_multa_afiliados_fkey FOREIGN KEY (id_multa_afiliados) REFERENCES multas.t_multas_afiliados(id_multa_afi);


--
-- Name: t_detalle_factura t_detalle_factura_id_servicio_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_detalle_factura
    ADD CONSTRAINT t_detalle_factura_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES medidores.t_servicios(id_servicio);


--
-- Name: t_factura t_factura_id_lectura_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura
    ADD CONSTRAINT t_factura_id_lectura_fkey FOREIGN KEY (id_lectura) REFERENCES medidores.t_lecturas(id_lectura);


--
-- Name: t_factura t_factura_id_usuario_afi_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_factura
    ADD CONSTRAINT t_factura_id_usuario_afi_fkey FOREIGN KEY (id_usuario_afi) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi);


--
-- Name: t_mora_factura t_mora_factura_id_configuracion_mora_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_mora_factura
    ADD CONSTRAINT t_mora_factura_id_configuracion_mora_fkey FOREIGN KEY (id_configuracion_mora) REFERENCES facturacion.t_configuracion_mora(id_configuracion_mora);


--
-- Name: t_mora_factura t_mora_factura_id_factura_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_mora_factura
    ADD CONSTRAINT t_mora_factura_id_factura_fkey FOREIGN KEY (id_factura) REFERENCES facturacion.t_factura(id_factura);


--
-- Name: t_pagos t_pagos_id_cajero_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_pagos
    ADD CONSTRAINT t_pagos_id_cajero_fkey FOREIGN KEY (id_cajero) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) NOT VALID;


--
-- Name: t_pagos t_pagos_id_factura_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_pagos
    ADD CONSTRAINT t_pagos_id_factura_fkey FOREIGN KEY (id_factura) REFERENCES facturacion.t_factura(id_factura) NOT VALID;


--
-- Name: t_pagos t_pagos_id_usuario_afi_fkey; Type: FK CONSTRAINT; Schema: facturacion; Owner: postgres
--

ALTER TABLE ONLY facturacion.t_pagos
    ADD CONSTRAINT t_pagos_id_usuario_afi_fkey FOREIGN KEY (id_usuario_afi) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) NOT VALID;


--
-- Name: t_historial_medidor fk_hist_medidor; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor
    ADD CONSTRAINT fk_hist_medidor FOREIGN KEY (id_medidor) REFERENCES medidores.t_medidor(id_medidor) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: t_historial_medidor fk_hist_usuario_afi_anterior; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor
    ADD CONSTRAINT fk_hist_usuario_afi_anterior FOREIGN KEY (id_usuario_afi_anterior) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: t_historial_medidor fk_hist_usuario_afi_nuevo; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor
    ADD CONSTRAINT fk_hist_usuario_afi_nuevo FOREIGN KEY (id_usuario_afi_nuevo) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: t_historial_medidor fk_hist_usuario_sistema; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_historial_medidor
    ADD CONSTRAINT fk_hist_usuario_sistema FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: t_lecturas t_lecturas_id_lector_fkey; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_lecturas
    ADD CONSTRAINT t_lecturas_id_lector_fkey FOREIGN KEY (id_lector) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) NOT VALID;


--
-- Name: t_lecturas t_lecturas_id_medidor_fkey; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_lecturas
    ADD CONSTRAINT t_lecturas_id_medidor_fkey FOREIGN KEY (id_medidor) REFERENCES medidores.t_medidor(id_medidor) NOT VALID;


--
-- Name: t_medidor t_medidor_id_sector_fkey; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_medidor
    ADD CONSTRAINT t_medidor_id_sector_fkey FOREIGN KEY (id_sector) REFERENCES medidores.t_sector(id_sector) NOT VALID;


--
-- Name: t_medidor t_medidor_id_usuario_afi_fkey; Type: FK CONSTRAINT; Schema: medidores; Owner: postgres
--

ALTER TABLE ONLY medidores.t_medidor
    ADD CONSTRAINT t_medidor_id_usuario_afi_fkey FOREIGN KEY (id_usuario_afi) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) NOT VALID;


--
-- Name: t_multas_afiliados t_multas_afiliados_id_tipo_multa_fkey; Type: FK CONSTRAINT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multas_afiliados
    ADD CONSTRAINT t_multas_afiliados_id_tipo_multa_fkey FOREIGN KEY (id_tipo_multa) REFERENCES multas.t_multa(id_tipo_multa) NOT VALID;


--
-- Name: t_multas_afiliados t_multas_afiliados_id_usuario_afi_fkey; Type: FK CONSTRAINT; Schema: multas; Owner: postgres
--

ALTER TABLE ONLY multas.t_multas_afiliados
    ADD CONSTRAINT t_multas_afiliados_id_usuario_afi_fkey FOREIGN KEY (id_usuario_afi) REFERENCES usuarios.t_usuario_afiliado(id_usuario_afi) NOT VALID;


--
-- Name: t_notificaciones t_notificaciones_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: notificaciones; Owner: postgres
--

ALTER TABLE ONLY notificaciones.t_notificaciones
    ADD CONSTRAINT t_notificaciones_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) NOT VALID;


--
-- Name: t_auditoria_sesiones fk_auditoria_sesion_usuario; Type: FK CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_sesiones
    ADD CONSTRAINT fk_auditoria_sesion_usuario FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) ON DELETE CASCADE;


--
-- Name: t_auditoria_contrasenas fk_auditoria_usuario; Type: FK CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_auditoria_contrasenas
    ADD CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) ON DELETE CASCADE;


--
-- Name: t_historial_contrasenas fk_historial_usuario; Type: FK CONSTRAINT; Schema: seguridad; Owner: postgres
--

ALTER TABLE ONLY seguridad.t_historial_contrasenas
    ADD CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) ON DELETE CASCADE;


--
-- Name: t_usuario_afiliado fk_id_usuario_sistema; Type: FK CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_usuario_afiliado
    ADD CONSTRAINT fk_id_usuario_sistema FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema) NOT VALID;


--
-- Name: t_auditoria_sesiones t_auditoria_sesiones_id_usuario_sistema_fkey; Type: FK CONSTRAINT; Schema: usuarios; Owner: postgres
--

ALTER TABLE ONLY usuarios.t_auditoria_sesiones
    ADD CONSTRAINT t_auditoria_sesiones_id_usuario_sistema_fkey FOREIGN KEY (id_usuario_sistema) REFERENCES usuarios.t_usuario_sistema(id_usuario_sistema);


--
-- PostgreSQL database dump complete
--

