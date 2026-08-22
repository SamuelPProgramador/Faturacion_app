"""
db/gastos.py
Modulo de Gastos: registro de gastos operativos del negocio (materia
prima, gas, transporte, electricidad, otros). No afecta inventario ni
CxC/CxP directamente - es un gasto simple con su fecha y categoria.
Opcionalmente se puede asociar a un proveedor del directorio.
"""

from db.database import get_connection

CATEGORIAS = ["Materia Prima", "Gas", "Transporte", "Electricidad/Servicios", "Otros"]


def listar(fecha_desde=None, fecha_hasta=None, categoria=None, busqueda=None, limite=200):
    conn = get_connection()
    sql = """
        SELECT g.*, p.nombre AS proveedor_nombre
        FROM gastos g
        LEFT JOIN proveedores p ON p.id = g.proveedor_id
    """
    condiciones = []
    params = []

    if fecha_desde:
        condiciones.append("date(g.fecha) >= date(?)")
        params.append(fecha_desde)
    if fecha_hasta:
        condiciones.append("date(g.fecha) <= date(?)")
        params.append(fecha_hasta)
    if categoria:
        condiciones.append("g.categoria = ?")
        params.append(categoria)
    if busqueda:
        condiciones.append("(g.concepto LIKE ? OR g.notas LIKE ?)")
        comodin = f"%{busqueda}%"
        params += [comodin, comodin]

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " ORDER BY g.fecha DESC, g.id DESC LIMIT ?"
    params.append(limite)

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener(gasto_id):
    conn = get_connection()
    fila = conn.execute(
        """
        SELECT g.*, p.nombre AS proveedor_nombre
        FROM gastos g
        LEFT JOIN proveedores p ON p.id = g.proveedor_id
        WHERE g.id = ?
        """,
        (gasto_id,),
    ).fetchone()
    conn.close()
    return dict(fila) if fila else None


def crear(datos):
    categoria = (datos.get("categoria") or "").strip()
    if categoria not in CATEGORIAS:
        return {"ok": False, "error": "Selecciona una categoría válida."}

    monto = float(datos.get("monto") or 0)
    if monto <= 0:
        return {"ok": False, "error": "El monto debe ser mayor a cero."}

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO gastos (categoria, concepto, monto, metodo_pago, proveedor_id, fecha, notas)
            VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
            """,
            (
                categoria,
                (datos.get("concepto") or "").strip(),
                monto,
                datos.get("metodo_pago", "Efectivo"),
                datos.get("proveedor_id"),
                datos.get("fecha") or None,
                (datos.get("notas") or "").strip(),
            ),
        )
        conn.commit()
        return {"ok": True, "id": cur.lastrowid}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def actualizar(gasto_id, datos):
    categoria = (datos.get("categoria") or "").strip()
    if categoria not in CATEGORIAS:
        return {"ok": False, "error": "Selecciona una categoría válida."}

    monto = float(datos.get("monto") or 0)
    if monto <= 0:
        return {"ok": False, "error": "El monto debe ser mayor a cero."}

    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE gastos SET
                categoria = ?, concepto = ?, monto = ?, metodo_pago = ?,
                proveedor_id = ?, fecha = COALESCE(?, fecha), notas = ?
            WHERE id = ?
            """,
            (
                categoria,
                (datos.get("concepto") or "").strip(),
                monto,
                datos.get("metodo_pago", "Efectivo"),
                datos.get("proveedor_id"),
                datos.get("fecha") or None,
                (datos.get("notas") or "").strip(),
                gasto_id,
            ),
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def eliminar(gasto_id):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM gastos WHERE id = ?", (gasto_id,))
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def resumen_por_categoria(fecha_desde=None, fecha_hasta=None):
    """Total gastado por categoria en el rango de fechas dado (o todo el historial si no se manda)."""
    conn = get_connection()
    sql = "SELECT categoria, COALESCE(SUM(monto), 0) AS total FROM gastos"
    condiciones = []
    params = []

    if fecha_desde:
        condiciones.append("date(fecha) >= date(?)")
        params.append(fecha_desde)
    if fecha_hasta:
        condiciones.append("date(fecha) <= date(?)")
        params.append(fecha_hasta)

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " GROUP BY categoria"

    filas = conn.execute(sql, params).fetchall()

    total_general = conn.execute(
        f"SELECT COALESCE(SUM(monto), 0) AS total FROM gastos"
        + (f" WHERE {' AND '.join(condiciones)}" if condiciones else ""),
        params,
    ).fetchone()["total"]

    conn.close()

    por_categoria = {c: 0 for c in CATEGORIAS}
    for f in filas:
        por_categoria[f["categoria"]] = f["total"]

    return {"por_categoria": por_categoria, "total": total_general}