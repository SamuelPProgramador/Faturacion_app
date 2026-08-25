"""
db/usuarios.py
Autenticacion y gestion de usuarios con roles:
- admin_general: acceso total, incluyendo datos de la empresa (nombre,
  logo) y gestion de usuarios. Pensado para el dueno del software.
- admin_cliente: acceso operativo completo (todos los modulos del dia a
  dia), pero NO puede cambiar el nombre/logo de la empresa ni gestionar
  usuarios.

Las contrasenas nunca se guardan en texto plano: se guarda un hash
PBKDF2 + una sal aleatoria por usuario.
"""

import hashlib
import hmac
import secrets
from db.database import get_connection

ROLES_VALIDOS = ("admin_general", "admin_cliente")


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    hash_ = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return hash_, salt


def verificar_password(password, password_hash, salt):
    calculado, _ = hash_password(password, salt)
    return hmac.compare_digest(calculado, password_hash)


def iniciar_sesion(usuario, password):
    """Devuelve el usuario (sin datos sensibles) si las credenciales son correctas."""
    conn = get_connection()
    fila = conn.execute(
        "SELECT * FROM usuarios WHERE usuario = ? AND activo = 1", (usuario.strip(),)
    ).fetchone()
    conn.close()

    if not fila:
        return {"ok": False, "error": "Usuario o contraseña incorrectos."}

    if not verificar_password(password, fila["password_hash"], fila["password_salt"]):
        return {"ok": False, "error": "Usuario o contraseña incorrectos."}

    return {
        "ok": True,
        "usuario": {
            "id": fila["id"],
            "nombre": fila["nombre"],
            "usuario": fila["usuario"],
            "rol": fila["rol"],
        },
    }


def listar(incluir_inactivos=False):
    conn = get_connection()
    sql = "SELECT id, nombre, usuario, rol, activo, creado_en FROM usuarios"
    if not incluir_inactivos:
        sql += " WHERE activo = 1"
    sql += " ORDER BY rol, nombre"
    filas = conn.execute(sql).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def crear(datos):
    nombre = (datos.get("nombre") or "").strip()
    usuario = (datos.get("usuario") or "").strip()
    password = datos.get("password") or ""
    rol = datos.get("rol", "admin_cliente")

    if not nombre or not usuario:
        return {"ok": False, "error": "Nombre y usuario son obligatorios."}
    if len(password) < 6:
        return {"ok": False, "error": "La contraseña debe tener al menos 6 caracteres."}
    if rol not in ROLES_VALIDOS:
        return {"ok": False, "error": "Rol inválido."}

    password_hash, salt = hash_password(password)

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO usuarios (nombre, usuario, password_hash, password_salt, rol, activo)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (nombre, usuario, password_hash, salt, rol),
        )
        conn.commit()
        return {"ok": True, "id": cur.lastrowid}
    except Exception as e:
        conn.rollback()
        if "UNIQUE" in str(e):
            return {"ok": False, "error": f"Ya existe un usuario con el nombre de acceso '{usuario}'."}
        return {"ok": False, "error": str(e)}
    finally:
        conn.close()


def cambiar_password(usuario_id, nueva_password):
    if len(nueva_password or "") < 6:
        return {"ok": False, "error": "La contraseña debe tener al menos 6 caracteres."}

    password_hash, salt = hash_password(nueva_password)
    conn = get_connection()
    conn.execute(
        "UPDATE usuarios SET password_hash = ?, password_salt = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        (password_hash, salt, usuario_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def cambiar_estado(usuario_id, activo):
    conn = get_connection()
    # No se permite desactivar al ultimo admin_general activo (para no quedarse sin acceso al sistema)
    if not activo:
        fila = conn.execute("SELECT rol FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
        if fila and fila["rol"] == "admin_general":
            total_activos = conn.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin_general' AND activo = 1"
            ).fetchone()["total"]
            if total_activos <= 1:
                conn.close()
                return {"ok": False, "error": "No puedes desactivar el único Administrador General activo."}

    conn.execute(
        "UPDATE usuarios SET activo = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
        (1 if activo else 0, usuario_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}