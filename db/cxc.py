"""
db/cxc.py
Cuentas por Cobrar: lo que los clientes le deben al negocio por ventas
a credito. Los registros de CxC los crea db/facturas.py automaticamente
cuando una factura se hace con metodo_pago='Crédito'. Aqui vive:
- el listado general (para el modulo CxC)
- el registro de pagos/abonos
- el estado de cuenta por cliente (historial cronologico con saldo corriendo)
"""

from datetime import datetime
from db.database import get_connection
from db.database import get_connection, ahora_local


def listar(incluir_pagadas=False, busqueda=None):
    conn = get_connection()
    sql = """
        SELECT cxc.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
               f.numero AS factura_numero
        FROM cxc
        JOIN clientes c ON c.id = cxc.cliente_id
        LEFT JOIN facturas f ON f.id = cxc.factura_id
    """
    condiciones = []
    params = []

    if not incluir_pagadas:
        condiciones.append("cxc.estado = 'Pendiente'")

    if busqueda:
        condiciones.append("(c.nombre LIKE ? OR f.numero LIKE ?)")
        comodin = f"%{busqueda}%"
        params += [comodin, comodin]

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " ORDER BY cxc.fecha_vencim"

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener_resumen():
    conn = get_connection()
    total_pendiente = conn.execute(
        "SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cxc WHERE estado = 'Pendiente'"
    ).fetchone()["total"]

    hoy = datetime.now().strftime("%Y-%m-%d")
    vencidas = conn.execute(
        "SELECT COUNT(*) AS cnt, COALESCE(SUM(saldo_pendiente), 0) AS total "
        "FROM cxc WHERE estado = 'Pendiente' AND fecha_vencim < ?",
        (hoy,),
    ).fetchone()

    clientes_con_deuda = conn.execute(
        "SELECT COUNT(DISTINCT cliente_id) AS cnt FROM cxc WHERE estado = 'Pendiente'"
    ).fetchone()["cnt"]

    conn.close()
    return {
        "total_pendiente": total_pendiente,
        "facturas_vencidas": vencidas["cnt"],
        "monto_vencido": vencidas["total"],
        "clientes_con_deuda": clientes_con_deuda,
    }


def registrar_pago(cxc_id, monto, metodo_pago="Efectivo"):
    """Abona a una cuenta por cobrar. Si el saldo llega a 0, marca la CxC
    (y la factura relacionada, si tiene) como Pagada."""
    monto = float(monto or 0)
    if monto <= 0:
        return {"ok": False, "error": "El monto del pago debe ser mayor a cero."}

    conn = get_connection()
    try:
        cxc = conn.execute("SELECT * FROM cxc WHERE id = ?", (cxc_id,)).fetchone()
        if not cxc:
            return {"ok": False, "error": "Esa cuenta por cobrar ya no existe."}
        if monto > cxc["saldo_pendiente"]:
            return {
                "ok": False,
                "error": f"El pago (${monto}) es mayor al saldo pendiente (${cxc['saldo_pendiente']}).",
            }

        nuevo_saldo = round(cxc["saldo_pendiente"] - monto, 2)
        nuevo_estado = "Pagada" if nuevo_saldo <= 0 else "Pendiente"

        conn.execute(
            "INSERT INTO cxc_pagos (cxc_id, monto, metodo_pago, fecha) VALUES (?, ?, ?, ?)",
            (cxc_id, monto, metodo_pago, ahora_local()),
        )
        conn.execute(
            "UPDATE cxc SET saldo_pendiente = ?, estado = ? WHERE id = ?",
            (nuevo_saldo, nuevo_estado, cxc_id),
        )

        if nuevo_estado == "Pagada" and cxc["factura_id"]:
            conn.execute("UPDATE facturas SET estado = 'Pagada' WHERE id = ?", (cxc["factura_id"],))

        conn.commit()
        return {"ok": True, "saldo_pendiente": nuevo_saldo}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def obtener_estado_cuenta(cliente_id):
    """Historial cronologico de cargos (facturas a credito) y abonos (pagos)
    de un cliente, con el saldo corriendo despues de cada movimiento."""
    conn = get_connection()

    cargos = conn.execute(
        """
        SELECT cxc.id AS cxc_id, cxc.fecha, cxc.monto_original AS monto, f.numero AS factura_numero
        FROM cxc
        LEFT JOIN facturas f ON f.id = cxc.factura_id
        WHERE cxc.cliente_id = ?
        """,
        (cliente_id,),
    ).fetchall()

    cxc_ids = [c["cxc_id"] for c in cargos]
    abonos = []
    if cxc_ids:
        placeholders = ",".join("?" * len(cxc_ids))
        abonos = conn.execute(
            f"SELECT cxc_id, fecha, monto, metodo_pago FROM cxc_pagos WHERE cxc_id IN ({placeholders})",
            cxc_ids,
        ).fetchall()

    conn.close()

    movimientos = []
    for c in cargos:
        movimientos.append(
            {
                "fecha": c["fecha"],
                "tipo": "cargo",
                "descripcion": f"Factura {c['factura_numero']}" if c["factura_numero"] else "Cargo a crédito",
                "monto": c["monto"],
            }
        )
    for a in abonos:
        movimientos.append(
            {
                "fecha": a["fecha"],
                "tipo": "abono",
                "descripcion": f"Abono ({a['metodo_pago']})",
                "monto": a["monto"],
            }
        )

    movimientos.sort(key=lambda m: m["fecha"])

    saldo = 0.0
    for m in movimientos:
        saldo += m["monto"] if m["tipo"] == "cargo" else -m["monto"]
        m["saldo"] = round(saldo, 2)

    total_facturado = round(sum(c["monto"] for c in cargos), 2)
    total_pagado = round(sum(a["monto"] for a in abonos), 2)

    return {
        "movimientos": movimientos,
        "total_facturado": total_facturado,
        "total_pagado": total_pagado,
        "saldo_actual": round(total_facturado - total_pagado, 2),
    }