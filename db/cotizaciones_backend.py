"""
db/cotizaciones.py
Toda la logica de negocio de Cotizaciones: generar el numero, calcular
subtotal/impuesto/total, cambiar de estado (Pendiente/Aprobada/Rechazada)
y convertir una cotizacion aprobada en una factura real con un clic
(reutilizando la logica de facturas_db.crear, que ya descuenta
inventario y crea el CxC si aplica).
"""

from datetime import datetime, timedelta
from db.database import get_connection, get_config
from db import facturas as facturas_db


def previsualizar_numero():
    """Muestra el numero que le tocaria a la proxima cotizacion, sin gastarlo."""
    n = int(get_config("siguiente_numero_cotizacion", "1"))
    return f"COT-{n:06d}"


def crear(datos):
    """
    datos = {
        "cliente_id": int | None,
        "dias_validez": int,           # se usa para calcular "vencimiento"
        "notas": str,
        "lineas": [{"producto_id": int, "cantidad": float, "precio_unit": float|None}, ...]
    }
    A diferencia de Facturar, crear una cotizacion NO descuenta inventario
    (es solo una propuesta de precio todavia).
    """
    lineas = datos.get("lineas") or []
    if not lineas:
        return {"ok": False, "error": "Agrega al menos un producto a la cotización."}

    cliente_id = datos.get("cliente_id")

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

        dias_validez = int(datos.get("dias_validez") or 15)
        vencimiento = (datetime.now() + timedelta(days=dias_validez)).strftime("%Y-%m-%d")

        n = int(get_config("siguiente_numero_cotizacion", "1"))
        numero = f"COT-{n:06d}"

        cur = conn.execute(
            """
            INSERT INTO cotizaciones
                (numero, cliente_id, vencimiento, subtotal, impuesto, total, estado, notas)
            VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?)
            """,
            (
                numero,
                cliente_id,
                vencimiento,
                subtotal,
                impuesto_total,
                total,
                (datos.get("notas") or "").strip(),
            ),
        )
        cotizacion_id = cur.lastrowid

        for d in detalle_final:
            conn.execute(
                """
                INSERT INTO cotizacion_detalle
                    (cotizacion_id, producto_id, descripcion, cantidad, precio_unit, total_linea)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cotizacion_id, d["producto_id"], d["descripcion"], d["cantidad"], d["precio_unit"], d["total_linea"]),
            )

        conn.execute(
            "UPDATE configuracion SET valor = ? WHERE clave = 'siguiente_numero_cotizacion'",
            (str(n + 1),),
        )

        conn.commit()
        return {"ok": True, "id": cotizacion_id, "numero": numero, "total": total}

    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def actualizar(cotizacion_id, datos):
    """
    Reemplaza cliente, vencimiento, notas y lineas de una cotizacion existente.
    Solo se puede editar si todavia NO fue convertida en factura.
    """
    lineas = datos.get("lineas") or []
    if not lineas:
        return {"ok": False, "error": "Agrega al menos un producto a la cotización."}

    conn = get_connection()
    try:
        actual = conn.execute(
            "SELECT estado FROM cotizaciones WHERE id = ?", (cotizacion_id,)
        ).fetchone()
        if not actual:
            return {"ok": False, "error": "La cotización ya no existe."}
        if actual["estado"] == "Convertida":
            return {"ok": False, "error": "Esta cotización ya fue convertida en factura y no se puede editar."}

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

        dias_validez = int(datos.get("dias_validez") or 15)
        vencimiento = (datetime.now() + timedelta(days=dias_validez)).strftime("%Y-%m-%d")

        conn.execute(
            """
            UPDATE cotizaciones
            SET cliente_id = ?, vencimiento = ?, subtotal = ?, impuesto = ?, total = ?, notas = ?
            WHERE id = ?
            """,
            (
                datos.get("cliente_id"),
                vencimiento,
                subtotal,
                impuesto_total,
                total,
                (datos.get("notas") or "").strip(),
                cotizacion_id,
            ),
        )

        conn.execute("DELETE FROM cotizacion_detalle WHERE cotizacion_id = ?", (cotizacion_id,))
        for d in detalle_final:
            conn.execute(
                """
                INSERT INTO cotizacion_detalle
                    (cotizacion_id, producto_id, descripcion, cantidad, precio_unit, total_linea)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (cotizacion_id, d["producto_id"], d["descripcion"], d["cantidad"], d["precio_unit"], d["total_linea"]),
            )

        conn.commit()
        return {"ok": True, "id": cotizacion_id, "total": total}

    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def eliminar(cotizacion_id):
    """Borra una cotizacion y su detalle. No se puede borrar si ya fue convertida en factura."""
    conn = get_connection()
    try:
        actual = conn.execute(
            "SELECT estado FROM cotizaciones WHERE id = ?", (cotizacion_id,)
        ).fetchone()
        if not actual:
            return {"ok": False, "error": "La cotización ya no existe."}
        if actual["estado"] == "Convertida":
            return {"ok": False, "error": "Esta cotización ya fue convertida en factura y no se puede eliminar."}

        conn.execute("DELETE FROM cotizacion_detalle WHERE cotizacion_id = ?", (cotizacion_id,))
        conn.execute("DELETE FROM cotizaciones WHERE id = ?", (cotizacion_id,))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def listar_recientes(limite=20):
    conn = get_connection()
    filas = conn.execute(
        """
        SELECT q.*, COALESCE(c.nombre, 'Consumidor final') AS cliente_nombre
        FROM cotizaciones q
        LEFT JOIN clientes c ON c.id = q.cliente_id
        ORDER BY q.id DESC
        LIMIT ?
        """,
        (limite,),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener_con_detalle(cotizacion_id):
    conn = get_connection()
    cotizacion = conn.execute(
        """
        SELECT q.*, COALESCE(c.nombre, 'Consumidor final') AS cliente_nombre
        FROM cotizaciones q
        LEFT JOIN clientes c ON c.id = q.cliente_id
        WHERE q.id = ?
        """,
        (cotizacion_id,),
    ).fetchone()
    if not cotizacion:
        conn.close()
        return None
    lineas = conn.execute(
        "SELECT * FROM cotizacion_detalle WHERE cotizacion_id = ?", (cotizacion_id,)
    ).fetchall()
    conn.close()

    resultado = dict(cotizacion)
    resultado["lineas"] = [dict(l) for l in lineas]
    return resultado


def cambiar_estado(cotizacion_id, estado):
    """estado: 'Pendiente' | 'Aprobada' | 'Rechazada'. No se usa para
    'Convertida': eso lo pone convertir_a_factura automaticamente."""
    if estado not in ("Pendiente", "Aprobada", "Rechazada"):
        return {"ok": False, "error": "Estado no válido."}

    conn = get_connection()
    try:
        actual = conn.execute(
            "SELECT estado FROM cotizaciones WHERE id = ?", (cotizacion_id,)
        ).fetchone()
        if not actual:
            return {"ok": False, "error": "La cotización ya no existe."}
        if actual["estado"] == "Convertida":
            return {"ok": False, "error": "Esta cotización ya fue convertida en factura."}

        conn.execute("UPDATE cotizaciones SET estado = ? WHERE id = ?", (estado, cotizacion_id))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def convertir_a_factura(cotizacion_id, metodo_pago="Efectivo"):
    """
    Toma una cotizacion y crea una factura real con las mismas lineas y
    cliente, reutilizando facturas_db.crear (que valida existencia,
    descuenta inventario y crea CxC si el metodo de pago es Credito).
    Si todo sale bien, marca la cotizacion como 'Convertida' y guarda
    la referencia a la factura generada.
    """
    conn = get_connection()
    cotizacion = conn.execute(
        "SELECT * FROM cotizaciones WHERE id = ?", (cotizacion_id,)
    ).fetchone()
    if not cotizacion:
        conn.close()
        return {"ok": False, "error": "La cotización ya no existe."}
    if cotizacion["estado"] == "Convertida":
        conn.close()
        return {"ok": False, "error": "Esta cotización ya fue convertida en factura."}

    lineas = conn.execute(
        "SELECT * FROM cotizacion_detalle WHERE cotizacion_id = ?", (cotizacion_id,)
    ).fetchall()
    conn.close()

    if not lineas:
        return {"ok": False, "error": "Esta cotización no tiene productos."}

    datos_factura = {
        "cliente_id": cotizacion["cliente_id"],
        "metodo_pago": metodo_pago,
        "notas": f"Generada desde cotización {cotizacion['numero']}",
        "lineas": [
            {
                "producto_id": l["producto_id"],
                "cantidad": l["cantidad"],
                "precio_unit": l["precio_unit"],
            }
            for l in lineas
        ],
    }

    resultado = facturas_db.crear(datos_factura)
    if not resultado.get("ok"):
        return resultado

    conn = get_connection()
    try:
        conn.execute(
            "UPDATE cotizaciones SET estado = 'Convertida', factura_id = ? WHERE id = ?",
            (resultado["id"], cotizacion_id),
        )
        conn.commit()
    finally:
        conn.close()

    return resultado
