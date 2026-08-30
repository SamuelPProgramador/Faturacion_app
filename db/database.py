"""
database.py
Maneja la conexión y creación de la base de datos SQLite para el sistema
de facturación e inventario.

Cada modulo de la app (Productos, Clientes, Facturar, etc.) usara las
funciones de este archivo para conectarse. La base de datos se crea
automaticamente la primera vez que se abre la app.
"""

import sqlite3
import os

# La base de datos vive junto al ejecutable, no dentro de los archivos
# empaquetados, para que los datos del cliente nunca se pierdan al
# actualizar la app.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "negocio.db")


def get_connection():
    """Devuelve una conexion nueva a la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Crea todas las tablas del sistema si no existen todavia."""
    conn = get_connection()
    cur = conn.cursor()

    # ---------------------------------------------------------------
    # CONFIGURACION (datos de la empresa, moneda, impuesto, numeracion)
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS configuracion (
            clave   TEXT PRIMARY KEY,
            valor   TEXT
        )
    """)

    # ---------------------------------------------------------------
    # PRODUCTOS
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo          TEXT UNIQUE,
            nombre          TEXT NOT NULL,
            categoria       TEXT,
            descripcion     TEXT,
            unidad_venta    TEXT DEFAULT 'Unidad',
            precio_venta    REAL NOT NULL DEFAULT 0,
            costo           REAL NOT NULL DEFAULT 0,
            existencia      REAL NOT NULL DEFAULT 0,
            stock_minimo    REAL DEFAULT 0,
            aplica_impuesto INTEGER DEFAULT 1,
            activo          INTEGER DEFAULT 1,
            creado_en       TEXT DEFAULT CURRENT_TIMESTAMP,
            actualizado_en  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ---------------------------------------------------------------
    # CLIENTES
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo          TEXT UNIQUE,
            tipo_cliente    TEXT DEFAULT 'Individual',
            nombre          TEXT NOT NULL,
            rnc_cedula      TEXT,
            telefono        TEXT,
            telefono_alt    TEXT,
            correo          TEXT,
            direccion       TEXT,
            limite_credito  REAL DEFAULT 0,
            dias_credito    INTEGER DEFAULT 0,
            notas           TEXT,
            activo          INTEGER DEFAULT 1,
            creado_en       TEXT DEFAULT CURRENT_TIMESTAMP,
            actualizado_en  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ---------------------------------------------------------------
    # FACTURAS (encabezado) y su detalle
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS facturas (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            numero          TEXT UNIQUE,
            ncf             TEXT,
            cliente_id      INTEGER,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            subtotal        REAL NOT NULL DEFAULT 0,
            impuesto        REAL NOT NULL DEFAULT 0,
            total           REAL NOT NULL DEFAULT 0,
            metodo_pago     TEXT,
            estado          TEXT DEFAULT 'Pagada',
            notas           TEXT,
            FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS factura_detalle (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            factura_id      INTEGER NOT NULL,
            producto_id     INTEGER,
            descripcion     TEXT,
            cantidad        REAL NOT NULL,
            precio_unit     REAL NOT NULL,
            total_linea     REAL NOT NULL,
            FOREIGN KEY (factura_id) REFERENCES facturas (id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos (id)
        )
    """)

    # ---------------------------------------------------------------
    # COTIZACIONES (encabezado) y su detalle
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS cotizaciones (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            numero          TEXT UNIQUE,
            cliente_id      INTEGER,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            vencimiento     TEXT,
            subtotal        REAL NOT NULL DEFAULT 0,
            impuesto        REAL NOT NULL DEFAULT 0,
            total           REAL NOT NULL DEFAULT 0,
            estado          TEXT DEFAULT 'Pendiente',
            notas           TEXT,
            FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS cotizacion_detalle (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cotizacion_id   INTEGER NOT NULL,
            producto_id     INTEGER,
            descripcion     TEXT,
            cantidad        REAL NOT NULL,
            precio_unit     REAL NOT NULL,
            total_linea     REAL NOT NULL,
            FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE,
            FOREIGN KEY (producto_id) REFERENCES productos (id)
        )
    """)

    # ---------------------------------------------------------------
    # ENTRADAS (compras / entradas de inventario)
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS entradas (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id     INTEGER NOT NULL,
            cantidad        REAL NOT NULL,
            costo_unit      REAL NOT NULL DEFAULT 0,
            proveedor       TEXT,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            notas           TEXT,
            FOREIGN KEY (producto_id) REFERENCES productos (id)
        )
    """)

    # ---------------------------------------------------------------
    # CUENTAS POR COBRAR (CxC)
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS cxc (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id      INTEGER NOT NULL,
            factura_id      INTEGER,
            monto_original  REAL NOT NULL,
            saldo_pendiente REAL NOT NULL,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            fecha_vencim    TEXT,
            estado          TEXT DEFAULT 'Pendiente',
            FOREIGN KEY (cliente_id) REFERENCES clientes (id),
            FOREIGN KEY (factura_id) REFERENCES facturas (id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS cxc_pagos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cxc_id          INTEGER NOT NULL,
            monto           REAL NOT NULL,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            metodo_pago     TEXT,
            FOREIGN KEY (cxc_id) REFERENCES cxc (id) ON DELETE CASCADE
        )
    """)

    # ---------------------------------------------------------------
    # PROVEEDORES
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS proveedores (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo              TEXT UNIQUE,
            nombre              TEXT NOT NULL,
            telefono            TEXT,
            correo              TEXT,
            direccion           TEXT,
            productos_suministra TEXT,
            dias_credito        INTEGER DEFAULT 0,
            notas               TEXT,
            activo              INTEGER DEFAULT 1,
            creado_en           TEXT DEFAULT CURRENT_TIMESTAMP,
            actualizado_en      TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ---------------------------------------------------------------
    # CUENTAS POR PAGAR (CxP) - lo que el negocio le debe a proveedores
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS cxp (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            proveedor_id    INTEGER NOT NULL,
            entrada_id      INTEGER,
            monto_original  REAL NOT NULL,
            saldo_pendiente REAL NOT NULL,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            fecha_vencim    TEXT,
            estado          TEXT DEFAULT 'Pendiente',
            FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
            FOREIGN KEY (entrada_id) REFERENCES entradas (id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS cxp_pagos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cxp_id          INTEGER NOT NULL,
            monto           REAL NOT NULL,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            metodo_pago     TEXT,
            FOREIGN KEY (cxp_id) REFERENCES cxp (id) ON DELETE CASCADE
        )
    """)

    # ---------------------------------------------------------------
    # GASTOS
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gastos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria       TEXT NOT NULL,
            concepto        TEXT,
            monto           REAL NOT NULL,
            metodo_pago     TEXT DEFAULT 'Efectivo',
            proveedor_id    INTEGER,
            fecha           TEXT DEFAULT CURRENT_TIMESTAMP,
            notas           TEXT,
            creado_en       TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (proveedor_id) REFERENCES proveedores (id)
        )
    """)

    # ---------------------------------------------------------------
    # USUARIOS (roles: admin_general / admin_cliente)
    # ---------------------------------------------------------------
    cur.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre          TEXT NOT NULL,
            usuario         TEXT UNIQUE NOT NULL,
            password_hash   TEXT NOT NULL,
            password_salt   TEXT NOT NULL,
            rol             TEXT NOT NULL DEFAULT 'admin_cliente',
            activo          INTEGER DEFAULT 1,
            creado_en       TEXT DEFAULT CURRENT_TIMESTAMP,
            actualizado_en  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    _migrar_columnas_faltantes(cur)
    conn.commit()

    # Valores de configuracion por defecto (solo si la tabla esta vacia)
    defaults = {
        "nombre_empresa": "Empanadas y Pastelitos",
        "rnc_empresa": "",
        "telefono_empresa": "",
        "direccion_empresa": "",
        "logo_base64": "",
        "moneda": "RD$",
        "impuesto_pct": "0",
        "siguiente_numero_factura": "1",
        "siguiente_numero_cotizacion": "1",
    }
    for clave, valor in defaults.items():
        cur.execute(
            "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)",
            (clave, valor),
        )

    conn.commit()
    _sembrar_admin_general(cur)
    conn.commit()
    conn.close()


def _sembrar_admin_general(cur):
    """
    Crea la cuenta de Administrador General si todavia no existe ninguna.
    IMPORTANTE: usuario/clave por defecto son 'admin' / 'admin123'.
    Esta cuenta se crea igual en cada instalacion nueva del sistema, asi
    que el usuario final DEBE cambiar la contrasena la primera vez que
    entra (ver modulo de Configuracion > Usuarios).
    """
    from db.usuarios import hash_password

    existe = cur.execute(
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin_general'"
    ).fetchone()["total"]

    if existe == 0:
        password_hash, salt = hash_password("admin123")
        cur.execute(
            """
            INSERT INTO usuarios (nombre, usuario, password_hash, password_salt, rol, activo)
            VALUES (?, ?, ?, ?, 'admin_general', 1)
            """,
            ("Administrador General", "admin", password_hash, salt),
        )


def _migrar_columnas_faltantes(cur):
    """
    Si la base de datos ya existia de una version anterior del esqueleto
    (por ejemplo, la tabla productos sin 'descripcion' o 'aplica_impuesto'),
    esto agrega las columnas nuevas sin borrar nada de lo que ya haya.
    """
    columnas_esperadas = {
        "productos": {
            "descripcion": "TEXT",
            "unidad_venta": "TEXT DEFAULT 'Unidad'",
            "aplica_impuesto": "INTEGER DEFAULT 1",
            "actualizado_en": "TEXT",
        },
        "clientes": {
            "codigo": "TEXT",
            "tipo_cliente": "TEXT DEFAULT 'Individual'",
            "telefono_alt": "TEXT",
            "dias_credito": "INTEGER DEFAULT 0",
            "notas": "TEXT",
            "actualizado_en": "TEXT",
        },
        "cotizaciones": {
            "factura_id": "INTEGER",
        },
        "entradas": {
            "proveedor_id": "INTEGER",
            "metodo_pago": "TEXT DEFAULT 'Contado'",
            "estado": "TEXT DEFAULT 'Pagada'",
        },
            "facturas": {
            "ncf": "TEXT",
        },
    }
    for tabla, columnas in columnas_esperadas.items():
        existentes = {row["name"] for row in cur.execute(f"PRAGMA table_info({tabla})")}
        for columna, tipo in columnas.items():
            if columna not in existentes:
                cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}")


def get_config(clave, default=None):
    conn = get_connection()
    row = conn.execute(
        "SELECT valor FROM configuracion WHERE clave = ?", (clave,)
    ).fetchone()
    conn.close()
    return row["valor"] if row else default


def set_config(clave, valor):
    conn = get_connection()
    conn.execute(
        "INSERT INTO configuracion (clave, valor) VALUES (?, ?) "
        "ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        (clave, valor),
    )
    conn.commit()
    conn.close()