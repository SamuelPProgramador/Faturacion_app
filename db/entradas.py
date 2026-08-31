"""
db/entradas.py
Modulo de Entradas: registra una entrada de inventario (compra o
reabastecimiento) y aumenta la existencia del producto correspondiente.
Tambien actualiza el costo del producto al costo mas reciente que entro,
para que Facturar y los reportes de margen usen un costo actualizado.

Si la entrada se registra como compra a credito, ademas crea el registro
correspondiente en CxP (cuentas por pagar) para ese proveedor.
"""

from datetime import datetime, timedelta
from db.database import get_connection
from db.database import get_connection, ahora_local


def crear(datos):
    """
    datos = {
        "producto_id": int,
        "cantidad": float,
        "costo_unit": float | None,     # si no se manda, se usa el costo actual del producto
        "proveedor_id": int | None,     # de la lista de Proveedores
        "metodo_pago": "Contado" | "Crédito",
        "notas": str,
        "actualizar_costo": bool,       # si True (default), sobreescribe el costo del producto
    }
    """
    producto_id = datos.get("producto_id")
    if not producto_id:
        return {"ok": False, "error": "Selecciona un producto."}

    cantidad = float(datos.get("cantidad") or 0)
    if cantidad <= 0:
        return {"ok": False, "error": "La cantidad debe ser mayor a cero."}

    metodo_pago = datos.get("metodo_pago", "Contado")
    proveedor_id = datos.get("proveedor_id")

    if metodo_pago == "Crédito" and not proveedor_id:
        return {"ok": False, "error": "Para una compra a crédito debes elegir un proveedor."}

    conn = get_connection()
    try:
        prod = conn.execute("SELECT * FROM productos WHERE id = ?", (producto_id,)).fetchone()
        if not prod:
            return {"ok": False, "error": "Ese producto ya no existe."}

        costo_unit = datos.get("costo_unit")
        costo_unit = float(costo_unit) if costo_unit not in (None, "") else float(prod["costo"])
        if costo_unit < 0:
            return {"ok": False, "error": "El costo no puede ser negativo."}

        actualizar_costo = datos.get("actualizar_costo", True)

        cur = conn.execute(
            """
            INSERT INTO entradas
                (producto_id, cantidad, costo_unit, proveedor_id, metodo_pago, estado, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                producto_id,
                cantidad,
                costo_unit,
                proveedor_id,
                metodo_pago,
                "Pendiente" if metodo_pago == "Crédito" else "Pagada",
                (datos.get("notas") or "").strip(),
            ),
        )
        entrada_id = cur.lastrowid

        actualizar_costo = datos.get("actualizar_costo", True)
        fecha_actual = ahora_local()

        cur = conn.execute(
            """
            INSERT INTO entradas
                (producto_id, cantidad, costo_unit, proveedor_id, metodo_pago, estado, fecha, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                producto_id,
                cantidad,
                costo_unit,
                proveedor_id,
                metodo_pago,
                "Pendiente" if metodo_pago == "Crédito" else "Pagada",
                fecha_actual,
                (datos.get("notas") or "").strip(),
            ),
        )
        entrada_id = cur.lastrowid

        if actualizar_costo:
            conn.execute(
                """
                UPDATE productos
                SET existencia = existencia + ?, costo = ?, actualizado_en = ?
                WHERE id = ?
                """,
                (cantidad, costo_unit, fecha_actual, producto_id),
            )
        else:
            conn.execute(
                """
                UPDATE productos
                SET existencia = existencia + ?, actualizado_en = ?
                WHERE id = ?
                """,
                (cantidad, fecha_actual, producto_id),
            )

        # Si la compra es a credito, se genera la deuda con el proveedor (CxP)
        if metodo_pago == "Crédito":
            total_entrada = round(cantidad * costo_unit, 2)
            proveedor = conn.execute(
                "SELECT dias_credito FROM proveedores WHERE id = ?", (proveedor_id,)
            ).fetchone()
            dias = (proveedor["dias_credito"] if proveedor else 0) or 0
            fecha_venc = (datetime.now() + timedelta(days=dias)).strftime("%Y-%m-%d")

            conn.execute(
                """
                INSERT INTO cxp (proveedor_id, entrada_id, monto_original, saldo_pendiente, fecha, fecha_vencim, estado)
                VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
                """,
                (proveedor_id, entrada_id, total_entrada, total_entrada, fecha_actual, fecha_venc),
            )

        conn.commit()
        return {"ok": True, "id": entrada_id}

    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def listar_recientes(limite=15):
    conn = get_connection()
    filas = conn.execute(
        """
        SELECT e.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo, p.unidad_venta,
               prov.nombre AS proveedor_nombre
        FROM entradas e
        JOIN productos p ON p.id = e.producto_id
        LEFT JOIN proveedores prov ON prov.id = e.proveedor_id
        ORDER BY e.id DESC
        LIMIT ?
        """,
        (limite,),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def listar_por_producto(producto_id, limite=30):
    conn = get_connection()
    filas = conn.execute(
        """
        SELECT e.*, p.nombre AS producto_nombre, prov.nombre AS proveedor_nombre
        FROM entradas e
        JOIN productos p ON p.id = e.producto_id
        LEFT JOIN proveedores prov ON prov.id = e.proveedor_id
        WHERE e.producto_id = ?
        ORDER BY e.id DESC
        LIMIT ?
        """,
        (producto_id, limite),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]