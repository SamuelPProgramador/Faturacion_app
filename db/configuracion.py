"""
db/configuracion.py
Agrupa las funciones de lectura/escritura de la tabla `configuracion`
para el modulo de Configuracion. La logica de QUIEN puede llamar a
`actualizar_datos_empresa` (solo admin_general) vive en api.py, que es
donde se conoce la sesion actual - aqui solo esta el acceso a datos.
"""

from db.database import get_config, set_config

CAMPOS_EMPRESA = ["nombre_empresa", "rnc_empresa", "telefono_empresa", "direccion_empresa", "logo_base64"]
CAMPOS_PREFERENCIAS = ["moneda", "impuesto_pct"]
CAMPOS_NUMERACION = ["siguiente_numero_factura", "siguiente_numero_cotizacion"]


def obtener_todo():
    """Todo lo de configuracion en un solo objeto, para pintar la pantalla completa."""
    datos = {}
    for campo in CAMPOS_EMPRESA + CAMPOS_PREFERENCIAS + CAMPOS_NUMERACION:
        datos[campo] = get_config(campo, "")
    return datos


def actualizar_datos_empresa(datos):
    for campo in CAMPOS_EMPRESA:
        if campo in datos:
            set_config(campo, str(datos[campo] or ""))
    return {"ok": True}


def actualizar_preferencias(datos):
    for campo in CAMPOS_PREFERENCIAS:
        if campo in datos:
            set_config(campo, str(datos[campo] or ""))
    return {"ok": True}


def actualizar_numeracion(datos):
    for campo in CAMPOS_NUMERACION:
        if campo in datos and str(datos[campo]).strip().isdigit():
            set_config(campo, str(int(datos[campo])))
    return {"ok": True}