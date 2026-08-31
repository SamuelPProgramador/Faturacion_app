"""
db/proveedores.py
Directorio de proveedores, mas el resumen de cuanto se les ha comprado
y cuanto se les debe (CxP). El registro de deuda en si (tabla cxp) lo
crea db/entradas.py cuando una entrada se registra como compra a credito.
"""

from db.database import get_connection
from db.database import get_connection, ahora_local


def generar_codigo():
    conn = get_connection()
    fila = conn.execute(
        "SELECT codigo FROM proveedores WHERE codigo LIKE 'PROV-%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if fila and fila["codigo"]:
        try:
            ultimo_num = int(fila["codigo"].split("-")[-1])
        except ValueError:
            ultimo_num = 0
    else:
        ultimo_num = 0

    return f"PROV-{ultimo_num + 1:04d}"


def listar(incluir_inactivos=False, busqueda=None):
    conn = get_connection()
    sql = "SELECT * FROM proveedores"
    condiciones = []
    params = []

    if not incluir_inactivos:
        condiciones.append("activo = 1")

    if busqueda:
        condiciones.append("(nombre LIKE ? OR codigo LIKE ? OR telefono LIKE ? OR productos_suministra LIKE ?)")
        comodin = f"%{busqueda}%"
        params += [comodin, comodin, comodin, comodin]

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " ORDER BY nombre"

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener(proveedor_id):
    conn = get_connection()
    fila = conn.execute("SELECT * FROM proveedores WHERE id = ?", (proveedor_id,)).fetchone()
    conn.close()
    return dict(fila) if fila else None


def crear(datos):
    codigo = (datos.get("codigo") or "").strip() or generar_codigo()

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO proveedores
                (codigo, nombre, telefono, correo, direccion,
                 productos_suministra, dias_credito, notas, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                codigo,
                datos.get("nombre", "").strip(),
                datos.get("telefono", "").strip(),
                datos.get("correo", "").strip(),
                datos.get("direccion", "").strip(),
                datos.get("productos_suministra", "").strip(),
                int(datos.get("dias_credito") or 0),
                datos.get("notas", "").strip(),
            ),
        )
        conn.commit()
        nuevo_id = cur.lastrowid
        return {"ok": True, "id": nuevo_id, "codigo": codigo}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            return {"ok": False, "error": f"Ya existe un proveedor con el código {codigo}."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def actualizar(proveedor_id, datos):
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE proveedores SET
                codigo = ?, nombre = ?, telefono = ?, correo = ?, direccion = ?,
                productos_suministra = ?, dias_credito = ?, notas = ?,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                datos.get("codigo", "").strip(),
                datos.get("nombre", "").strip(),
                datos.get("telefono", "").strip(),
                datos.get("correo", "").strip(),
                datos.get("direccion", "").strip(),
                datos.get("productos_suministra", "").strip(),
                int(datos.get("dias_credito") or 0),
                datos.get("notas", "").strip(),
                proveedor_id,
            ),
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            return {"ok": False, "error": "Ya existe otro proveedor con ese código."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def cambiar_estado(proveedor_id, activo):
    conn = get_connection()
    conn.execute(
        "UPDATE proveedores SET activo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        (1 if activo else 0, proveedor_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def obtener_resumen(proveedor_id):
    """Total comprado historicamente + saldo pendiente actual (deuda) con este proveedor."""
    conn = get_connection()

    total_comprado = conn.execute(
        "SELECT COALESCE(SUM(cantidad * costo_unit), 0) AS total FROM entradas WHERE proveedor_id = ?",
        (proveedor_id,),
    ).fetchone()["total"]

    deuda_pendiente = conn.execute(
        "SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cxp WHERE proveedor_id = ? AND estado = 'Pendiente'",
        (proveedor_id,),
    ).fetchone()["total"]

    conn.close()
    return {"total_comprado": total_comprado, "deuda_pendiente": deuda_pendiente}


def listar_compras(proveedor_id, limite=30):
    conn = get_connection()
    filas = conn.execute(
        """
        SELECT e.*, p.nombre AS producto_nombre
        FROM entradas e
        JOIN productos p ON p.id = e.producto_id
        WHERE e.proveedor_id = ?
        ORDER BY e.id DESC
        LIMIT ?
        """,
        (proveedor_id, limite),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def listar_deudas(proveedor_id):
    conn = get_connection()
    filas = conn.execute(
        "SELECT * FROM cxp WHERE proveedor_id = ? AND estado = 'Pendiente' ORDER BY fecha_vencim",
        (proveedor_id,),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def registrar_pago_cxp(cxp_id, monto, metodo_pago="Efectivo"):
    """Abona a una deuda con proveedor. Si el saldo llega a 0, marca la CxP como Pagada."""
    monto = float(monto or 0)
    if monto <= 0:
        return {"ok": False, "error": "El monto del pago debe ser mayor a cero."}

    conn = get_connection()
    try:
        cxp = conn.execute("SELECT * FROM cxp WHERE id = ?", (cxp_id,)).fetchone()
        if not cxp:
            return {"ok": False, "error": "Esa cuenta por pagar ya no existe."}
        if monto > cxp["saldo_pendiente"]:
            return {"ok": False, "error": f"El pago (${monto}) es mayor al saldo pendiente (${cxp['saldo_pendiente']})."}

        nuevo_saldo = round(cxp["saldo_pendiente"] - monto, 2)

        conn.execute(
            "INSERT INTO cxp_pagos (cxp_id, monto, metodo_pago, fecha) VALUES (?, ?, ?, ?)",
            (cxp_id, monto, metodo_pago, ahora_local()),
        )
        conn.execute(
            "UPDATE cxp SET saldo_pendiente = ?, estado = ? WHERE id = ?",
            (nuevo_saldo, "Pagada" if nuevo_saldo <= 0 else "Pendiente", cxp_id),
        )
        conn.commit()
        return {"ok": True, "saldo_pendiente": nuevo_saldo}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()