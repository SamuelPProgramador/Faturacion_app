"""
db/clientes.py
Toda la logica de datos del modulo de Clientes: crear, listar, editar,
activar/desactivar, y generar el codigo automatico.
"""

from db.database import get_connection


def generar_codigo():
    """Genera un codigo tipo CLI-0001, siguiendo el consecutivo general."""
    conn = get_connection()
    fila = conn.execute(
        "SELECT codigo FROM clientes WHERE codigo LIKE 'CLI-%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if fila and fila["codigo"]:
        try:
            ultimo_num = int(fila["codigo"].split("-")[-1])
        except ValueError:
            ultimo_num = 0
    else:
        ultimo_num = 0

    return f"CLI-{ultimo_num + 1:04d}"


def listar(incluir_inactivos=False, busqueda=None):
    conn = get_connection()
    sql = "SELECT * FROM clientes"
    condiciones = []
    params = []

    if not incluir_inactivos:
        condiciones.append("activo = 1")

    if busqueda:
        condiciones.append("(nombre LIKE ? OR codigo LIKE ? OR telefono LIKE ? OR rnc_cedula LIKE ?)")
        comodin = f"%{busqueda}%"
        params += [comodin, comodin, comodin, comodin]

    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)

    sql += " ORDER BY nombre"

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def obtener(cliente_id):
    conn = get_connection()
    fila = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    conn.close()
    return dict(fila) if fila else None


def crear(datos):
    codigo = (datos.get("codigo") or "").strip() or generar_codigo()

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO clientes
                (codigo, tipo_cliente, nombre, rnc_cedula, telefono,
                 telefono_alt, correo, direccion, limite_credito,
                 dias_credito, notas, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                codigo,
                datos.get("tipo_cliente", "Individual"),
                datos.get("nombre", "").strip(),
                datos.get("rnc_cedula", "").strip(),
                datos.get("telefono", "").strip(),
                datos.get("telefono_alt", "").strip(),
                datos.get("correo", "").strip(),
                datos.get("direccion", "").strip(),
                float(datos.get("limite_credito") or 0),
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
            return {"ok": False, "error": f"Ya existe un cliente con el código {codigo}."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def actualizar(cliente_id, datos):
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE clientes SET
                codigo = ?, tipo_cliente = ?, nombre = ?, rnc_cedula = ?,
                telefono = ?, telefono_alt = ?, correo = ?, direccion = ?,
                limite_credito = ?, dias_credito = ?, notas = ?,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                datos.get("codigo", "").strip(),
                datos.get("tipo_cliente", "Individual"),
                datos.get("nombre", "").strip(),
                datos.get("rnc_cedula", "").strip(),
                datos.get("telefono", "").strip(),
                datos.get("telefono_alt", "").strip(),
                datos.get("correo", "").strip(),
                datos.get("direccion", "").strip(),
                float(datos.get("limite_credito") or 0),
                int(datos.get("dias_credito") or 0),
                datos.get("notas", "").strip(),
                cliente_id,
            ),
        )
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            return {"ok": False, "error": "Ya existe otro cliente con ese código."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def cambiar_estado(cliente_id, activo):
    conn = get_connection()
    conn.execute(
        "UPDATE clientes SET activo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        (1 if activo else 0, cliente_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}