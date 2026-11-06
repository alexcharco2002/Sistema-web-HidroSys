# scratch_fix_pagos.py
import shutil

file_path = "CodigoFuente/backend/routes/pagos.py"
backup_path = "CodigoFuente/backend/routes/pagos.py.bak"

shutil.copyfile(file_path, backup_path)
print("Backup created for pagos.py")

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

crlf = "\r\n" if "\r\n" in text else "\n"

# 1. En obtener_facturas_periodo_con_pagos:
old_query_1 = """        # ========================================
        # QUERY PRINCIPAL — Factura → Lectura → Medidor ✅
        # ========================================
        query = (
            db.query(
                # ===== FACTURA =====
                Factura.id_factura,
                Factura.num_factura,
                Factura.periodo,
                Factura.fecha_emision,
                Factura.estado_factura,
                Factura.consumo_m3,
                Factura.exceso_m3,
                Factura.valor_consumo,
                Factura.valor_exceso,
                Factura.subtotal,
                Factura.descuento,
                Factura.impuesto,
                Factura.total,

                # ===== MEDIDOR ✅ (viene de Lectura, no de Afiliado) =====
                Medidor.id_medidor,
                Medidor.num_medidor,

                # ===== AFILIADO =====
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,

                # ===== USUARIO SISTEMA =====
                func.concat(
                    func.coalesce(UsuarioSistema.nombres, ''),
                    ' ',
                    func.coalesce(UsuarioSistema.apellidos, '')
                ).label('nombre_completo'),
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,

                # ===== SECTOR =====
                Sector.nombre_sector,

                # ===== TOTAL PAGADO =====
                func.coalesce(subquery_pagos.c.total_pagado, 0).label('monto_pagado_total')
            )
            # ✅ Ruta correcta: Factura → Lectura → Medidor → Afiliado → UsuarioSistema
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(subquery_pagos, Factura.id_factura == subquery_pagos.c.id_factura)
        )""".replace("\n", crlf)

new_query_1 = """        # ========================================
        # QUERY PRINCIPAL — Factura → Afiliado → UsuarioSistema (Lectura/Medidor opcionales)
        # ========================================
        MedidorAfiliado = aliased(Medidor)
        query = (
            db.query(
                # ===== FACTURA =====
                Factura.id_factura,
                Factura.num_factura,
                Factura.periodo,
                Factura.fecha_emision,
                Factura.estado_factura,
                Factura.consumo_m3,
                Factura.exceso_m3,
                Factura.valor_consumo,
                Factura.valor_exceso,
                Factura.subtotal,
                Factura.descuento,
                Factura.impuesto,
                Factura.total,

                # ===== MEDIDOR (coalesce entre medidor de lectura y medidor activo del afiliado) =====
                func.coalesce(Medidor.id_medidor, MedidorAfiliado.id_medidor).label('id_medidor'),
                func.coalesce(Medidor.num_medidor, MedidorAfiliado.num_medidor).label('num_medidor'),

                # ===== AFILIADO =====
                UsuarioAfiliado.id_usuario_afi,
                UsuarioAfiliado.cod_usuario_afi,

                # ===== USUARIO SISTEMA =====
                func.concat(
                    func.coalesce(UsuarioSistema.nombres, ''),
                    ' ',
                    func.coalesce(UsuarioSistema.apellidos, '')
                ).label('nombre_completo'),
                UsuarioSistema.cedula,
                UsuarioSistema.direccion,
                UsuarioSistema.telefono,
                UsuarioSistema.email,

                # ===== SECTOR =====
                Sector.nombre_sector,

                # ===== TOTAL PAGADO =====
                func.coalesce(subquery_pagos.c.total_pagado, 0).label('monto_pagado_total')
            )
            .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .outerjoin(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .outerjoin(
                MedidorAfiliado,
                and_(
                    MedidorAfiliado.id_usuario_afi == UsuarioAfiliado.id_usuario_afi,
                    MedidorAfiliado.activo == True
                )
            )
            .outerjoin(subquery_pagos, Factura.id_factura == subquery_pagos.c.id_factura)
        )""".replace("\n", crlf)

if old_query_1 in text:
    text = text.replace(old_query_1, new_query_1, 1)
    print("1. Fixed obtener_facturas_periodo_con_pagos query joins")
else:
    print("1. Old query 1 NOT found")

# Fix search filter in obtener_facturas_periodo_con_pagos
old_search_1 = """                    # ✅ Medidor.num_medidor en lugar de UsuarioAfiliado.num_medidor
                    Medidor.num_medidor.ilike(search_pattern),""".replace("\n", crlf)

new_search_1 = """                    func.coalesce(Medidor.num_medidor, MedidorAfiliado.num_medidor).ilike(search_pattern),""".replace("\n", crlf)

if old_search_1 in text:
    text = text.replace(old_search_1, new_search_1, 1)
    print("2. Fixed search filter in obtener_facturas_periodo_con_pagos")
else:
    print("2. Old search 1 NOT found")

# 2. En listar_pagos:
old_query_2 = """            # Cadena principal: Pago → Factura → Lectura → Medidor
            .join(Factura, Pago.id_factura == Factura.id_factura)
            .join(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .join(Medidor, Lectura.id_medidor == Medidor.id_medidor)

            # Unir con UsuarioAfiliado a través de Medidor (no de Factura) para obtener datos del afiliado correcto
            .join(UsuarioAfiliado, Medidor.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)

            # Cajero con alias correcto
            .outerjoin(CajeroUsuario, Pago.id_cajero == CajeroUsuario.id_usuario_sistema)""".replace("\n", crlf)

new_query_2 = """            MedidorAfiliado = aliased(Medidor)
            .join(Factura, Pago.id_factura == Factura.id_factura)
            .join(UsuarioAfiliado, Factura.id_usuario_afi == UsuarioAfiliado.id_usuario_afi)
            .join(UsuarioSistema, UsuarioAfiliado.id_usuario_sistema == UsuarioSistema.id_usuario_sistema)
            .outerjoin(Sector, UsuarioAfiliado.id_sector == Sector.id_sector)
            .outerjoin(Lectura, Factura.id_lectura == Lectura.id_lectura)
            .outerjoin(Medidor, Lectura.id_medidor == Medidor.id_medidor)
            .outerjoin(
                MedidorAfiliado,
                and_(
                    MedidorAfiliado.id_usuario_afi == UsuarioAfiliado.id_usuario_afi,
                    MedidorAfiliado.activo == True
                )
            )
            .outerjoin(CajeroUsuario, Pago.id_cajero == CajeroUsuario.id_usuario_sistema)""".replace("\n", crlf)

# In listar_pagos, also fix Medidor.num_medidor in select
old_medidor_2 = "                Medidor.num_medidor,".replace("\n", crlf)
new_medidor_2 = "                func.coalesce(Medidor.num_medidor, MedidorAfiliado.num_medidor).label('num_medidor'),".replace("\n", crlf)

# Let's inspect listar_pagos exact lines
with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Saved first round of updates")
