"""
db/entradas.py
Modulo de Entradas: registra una entrada de inventario (compra o
reabastecimiento) y aumenta la existencia del producto correspondiente.
Tambien actualiza el costo del producto al costo mas reciente que entro,
para que Facturar y los reportes de margen usen un costo actualizado.
"""

from datetime import datetime
from db.database import get_connection


def crear(datos):
    """
    datos = {
        "producto_id": int,
        "cantidad": float,
        "costo_unit": float | None,   # si no se manda, se usa el costo actual del producto
        "proveedor": str,
        "notas": str,
        "actualizar_costo": bool,     # si True (default), sobreescribe el costo del producto
    }
    """
    producto_id = datos.get("producto_id")
    if not producto_id:
        return {"ok": False, "error": "Selecciona un producto."}

    cantidad = float(datos.get("cantidad") or 0)
    if cantidad <= 0:
        return {"ok": False, "error": "La cantidad debe ser mayor a cero."}

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
            INSERT INTO entradas (producto_id, cantidad, costo_unit, proveedor, notas)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                producto_id,
                cantidad,
                costo_unit,
                (datos.get("proveedor") or "").strip(),
                (datos.get("notas") or "").strip(),
            ),
        )
        entrada_id = cur.lastrowid

        if actualizar_costo:
            conn.execute(
                """
                UPDATE productos
                SET existencia = existencia + ?, costo = ?, actualizado_en = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (cantidad, costo_unit, producto_id),
            )
        else:
            conn.execute(
                """
                UPDATE productos
                SET existencia = existencia + ?, actualizado_en = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (cantidad, producto_id),
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
        SELECT e.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo, p.unidad_venta
        FROM entradas e
        JOIN productos p ON p.id = e.producto_id
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
        SELECT e.*, p.nombre AS producto_nombre
        FROM entradas e
        JOIN productos p ON p.id = e.producto_id
        WHERE e.producto_id = ?
        ORDER BY e.id DESC
        LIMIT ?
        """,
        (producto_id, limite),
    ).fetchall()
    conn.close()
    return [dict(f) for f in filas]