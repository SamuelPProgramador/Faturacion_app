"""
db/facturas.py
Toda la logica de negocio de Facturar: generar el numero de factura,
calcular subtotal/impuesto/total, descontar inventario, y si la venta
es a credito, crear el registro correspondiente en CxC.
"""

from datetime import datetime, timedelta
from db.database import get_connection, get_config


def previsualizar_numero():
    """Muestra el numero que le tocaria a la proxima factura, sin gastarlo."""
    n = int(get_config("siguiente_numero_factura", "1"))
    return f"FAC-{n:06d}"


def crear(datos):
    """
    datos = {
        "cliente_id": int | None,      # None = Consumidor final
        "metodo_pago": "Efectivo" | "Tarjeta" | "Transferencia" | "Crédito",
        "notas": str,
        "lineas": [{"producto_id": int, "cantidad": float, "precio_unit": float|None}, ...]
    }
    """
    lineas = datos.get("lineas") or []
    if not lineas:
        return {"ok": False, "error": "Agrega al menos un producto a la factura."}

    metodo_pago = datos.get("metodo_pago", "Efectivo")
    cliente_id = datos.get("cliente_id")

    if metodo_pago == "Crédito" and not cliente_id:
        return {
            "ok": False,
            "error": "Para vender a crédito debes elegir un cliente (no puede ser Consumidor final).",
        }

    conn = get_connection()
    try:
        impuesto_pct = float(get_config("impuesto_pct", "0") or 0)

        subtotal = 0.0
        impuesto_total = 0.0
        detalle_final = []

        for linea in lineas:
            prod = conn.execute(
                "SELECT * FROM productos WHERE id = ?", (linea.get("producto_id"),)
            ).fetchone()
            if not prod:
                return {"ok": False, "error": "Uno de los productos ya no existe. Vuelve a buscarlo."}

            cantidad = float(linea.get("cantidad") or 0)
            if cantidad <= 0:
                return {"ok": False, "error": f"La cantidad de '{prod['nombre']}' debe ser mayor a cero."}
            if cantidad > prod["existencia"]:
                return {
                    "ok": False,
                    "error": f"No hay suficiente existencia de '{prod['nombre']}' (disponible: {prod['existencia']}).",
                }

            precio_unit = linea.get("precio_unit")
            precio_unit = float(precio_unit) if precio_unit not in (None, "") else float(prod["precio_venta"])

            total_linea = round(precio_unit * cantidad, 2)
            subtotal += total_linea
            if prod["aplica_impuesto"]:
                impuesto_total += round(total_linea * impuesto_pct / 100, 2)

            detalle_final.append({
                "producto_id": prod["id"],
                "descripcion": prod["nombre"],
                "cantidad": cantidad,
                "precio_unit": precio_unit,
                "total_linea": total_linea,
            })

        subtotal = round(subtotal, 2)
        impuesto_total = round(impuesto_total, 2)
        total = round(subtotal + impuesto_total, 2)

        n = int(get_config("siguiente_numero_factura", "1"))
        numero = f"FAC-{n:06d}"

        cur = conn.execute(
            """
            INSERT INTO facturas
                (numero, cliente_id, subtotal, impuesto, total, metodo_pago, estado, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                numero,
                cliente_id,
                subtotal,
                impuesto_total,
                total,
                metodo_pago,
                "Pendiente" if metodo_pago == "Crédito" else "Pagada",
                (datos.get("notas") or "").strip(),
            ),
        )
        factura_id = cur.lastrowid

        for d in detalle_final:
            conn.execute(
                """
                INSERT INTO factura_detalle
                    (factura_id, producto_id, descripcion, cantidad, precio_unit, total_linea)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (factura_id, d["producto_id"], d["descripcion"], d["cantidad"], d["precio_unit"], d["total_linea"]),
            )
            conn.execute(
                "UPDATE productos SET existencia = existencia - ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
                (d["cantidad"], d["producto_id"]),
            )

        if metodo_pago == "Crédito":
            cliente = conn.execute(
                "SELECT dias_credito FROM clientes WHERE id = ?", (cliente_id,)
            ).fetchone()
            dias = (cliente["dias_credito"] if cliente else 0) or 0
            fecha_venc = (datetime.now() + timedelta(days=dias)).strftime("%Y-%m-%d")

            conn.execute(
                """
                INSERT INTO cxc (cliente_id, factura_id, monto_original, saldo_pendiente, fecha_vencim, estado)
                VALUES (?, ?, ?, ?, ?, 'Pendiente')
                """,
                (cliente_id, factura_id, total, total, fecha_venc),
            )

        conn.execute(
            "UPDATE configuracion SET valor = ? WHERE clave = 'siguiente_numero_factura'",
            (str(n + 1),),
        )

        conn.commit()
        return {"ok": True, "id": factura_id, "numero": numero, "total": total}

    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def listar_recientes(limite=10):
    conn = get_connection()
    filas = conn.execute(
        """
        SELECT f.*, COALESCE(c.nombre, 'Consumidor final') AS cliente_nombre
        FROM facturas f
        LEFT JOIN clientes c ON c.id = f.cliente_id
        ORDER BY f.id DESC
        LIMIT ?
        """,
        (limite,),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener_con_detalle(factura_id):
    conn = get_connection()
    factura = conn.execute(
        """
        SELECT f.*, COALESCE(c.nombre, 'Consumidor final') AS cliente_nombre
        FROM facturas f
        LEFT JOIN clientes c ON c.id = f.cliente_id
        WHERE f.id = ?
        """,
        (factura_id,),
    ).fetchone()
    if not factura:
        conn.close()
        return None
    lineas = conn.execute(
        "SELECT * FROM factura_detalle WHERE factura_id = ?", (factura_id,)
    ).fetchall()
    conn.close()

    resultado = dict(factura)
    resultado["lineas"] = [dict(l) for l in lineas]
    return resultado