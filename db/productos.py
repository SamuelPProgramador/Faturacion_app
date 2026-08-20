"""
db/productos.py
Toda la logica de datos del modulo de Productos: crear, listar, editar,
activar/desactivar, y generar el codigo automatico.
"""

from db.database import get_connection

PREFIJOS_CATEGORIA = {
    "Empanadas": "EMP",
    "Pastelitos": "PAS",
    "Bebidas": "BEB",
    "Combos": "COM",
    "Otros": "OTR",
}


def generar_codigo(categoria):
    """Genera un codigo tipo EMP-0001, siguiendo el consecutivo de esa categoria."""
    prefijo = PREFIJOS_CATEGORIA.get(categoria, "PRD")
    conn = get_connection()
    fila = conn.execute(
        "SELECT codigo FROM productos WHERE codigo LIKE ? ORDER BY id DESC LIMIT 1",
        (f"{prefijo}-%",),
    ).fetchone()
    conn.close()

    if fila and fila["codigo"]:
        try:
            ultimo_num = int(fila["codigo"].split("-")[-1])
        except ValueError:
            ultimo_num = 0
    else:
        ultimo_num = 0

    return f"{prefijo}-{ultimo_num + 1:04d}"


def listar(incluir_inactivos=False, busqueda=None):
    conn = get_connection()
    sql = "SELECT * FROM productos"
    condiciones = []
    params = []

    if not incluir_inactivos:
        condiciones.append("activo = 1")

    if busqueda:
        condiciones.append("(nombre LIKE ? OR codigo LIKE ? OR categoria LIKE ?)")
        comodin = f"%{busqueda}%"
        params += [comodin, comodin, comodin]

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " ORDER BY categoria, nombre"

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener(producto_id):
    conn = get_connection()
    fila = conn.execute("SELECT * FROM productos WHERE id = ?", (producto_id,)).fetchone()
    conn.close()
    return dict(fila) if fila else None


def crear(datos):
    codigo = (datos.get("codigo") or "").strip() or generar_codigo(datos.get("categoria"))

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO productos
                (codigo, nombre, categoria, descripcion, unidad_venta,
                 precio_venta, costo, existencia, stock_minimo,
                 aplica_impuesto, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                codigo,
                datos.get("nombre", "").strip(),
                datos.get("categoria", "Otros"),
                datos.get("descripcion", "").strip(),
                datos.get("unidad_venta", "Unidad"),
                float(datos.get("precio_venta") or 0),
                float(datos.get("costo") or 0),
                float(datos.get("existencia") or 0),
                float(datos.get("stock_minimo") or 0),
                1 if datos.get("aplica_impuesto", True) else 0,
            ),
        )
        conn.commit()
        nuevo_id = cur.lastrowid
        return {"ok": True, "id": nuevo_id, "codigo": codigo}
    except Exception as e:
        conn.rollback()
        # UNIQUE constraint u otro error se explica en espanol, sencillo
        if "UNIQUE" in str(e):
            return {"ok": False, "error": f"Ya existe un producto con el código {codigo}."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def actualizar(producto_id, datos):
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE productos SET
                codigo = ?, nombre = ?, categoria = ?, descripcion = ?,
                unidad_venta = ?, precio_venta = ?, costo = ?,
                existencia = ?, stock_minimo = ?, aplica_impuesto = ?,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                datos.get("codigo", "").strip(),
                datos.get("nombre", "").strip(),
                datos.get("categoria", "Otros"),
                datos.get("descripcion", "").strip(),
                datos.get("unidad_venta", "Unidad"),
                float(datos.get("precio_venta") or 0),
                float(datos.get("costo") or 0),
                float(datos.get("existencia") or 0),
                float(datos.get("stock_minimo") or 0),
                1 if datos.get("aplica_impuesto", True) else 0,
                producto_id,
            ),
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            return {"ok": False, "error": "Ya existe otro producto con ese código."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def cambiar_estado(producto_id, activo):
    conn = get_connection()
    conn.execute(
        "UPDATE productos SET activo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        (1 if activo else 0, producto_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def contar_bajo_stock():
    conn = get_connection()
    fila = conn.execute(
        "SELECT COUNT(*) AS total FROM productos WHERE activo = 1 AND existencia <= stock_minimo"
    ).fetchone()
    conn.close()
    return fila["total"] if fila else 0
