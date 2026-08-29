"""
db/reportes.py
Datos para el Resumen de ventas (dashboard): KPIs del dia, series de
ventas por dia/semana/mes (para el grafico de barras), y el ranking de
productos mas vendidos segun el periodo elegido.
"""

from datetime import datetime, timedelta
from db.database import get_connection

MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def resumen_dashboard():
    from db import cxc, productos

    conn = get_connection()
    hoy = datetime.now().strftime("%Y-%m-%d")

    ventas_hoy = conn.execute(
        "SELECT COALESCE(SUM(total), 0) AS total FROM facturas WHERE date(fecha) = ?", (hoy,)
    ).fetchone()["total"]

    facturas_hoy = conn.execute(
        "SELECT COUNT(*) AS cnt FROM facturas WHERE date(fecha) = ?", (hoy,)
    ).fetchone()["cnt"]

    conn.close()

    cxc_resumen = cxc.obtener_resumen()

    return {
        "ventas_hoy": ventas_hoy,
        "facturas_hoy": facturas_hoy,
        "cxc_pendiente": cxc_resumen["total_pendiente"],
        "bajo_stock": productos.contar_bajo_stock(),
    }


def ventas_por_dia(dias=14):
    conn = get_connection()
    filas = conn.execute(
        "SELECT date(fecha) AS periodo, COALESCE(SUM(total), 0) AS total FROM facturas GROUP BY date(fecha)"
    ).fetchall()
    conn.close()

    mapa = {f["periodo"]: f["total"] for f in filas}
    hoy = datetime.now().date()
    resultado = []
    for i in range(dias - 1, -1, -1):
        d = hoy - timedelta(days=i)
        clave = d.strftime("%Y-%m-%d")
        resultado.append({"etiqueta": d.strftime("%d/%m"), "total": mapa.get(clave, 0) or 0})
    return resultado


def ventas_por_semana(semanas=8):
    conn = get_connection()
    filas = conn.execute(
        "SELECT strftime('%Y-%W', fecha) AS periodo, COALESCE(SUM(total), 0) AS total "
        "FROM facturas GROUP BY periodo"
    ).fetchall()
    conn.close()

    mapa = {f["periodo"]: f["total"] for f in filas}
    hoy = datetime.now().date()
    resultado = []
    for i in range(semanas - 1, -1, -1):
        d = hoy - timedelta(weeks=i)
        clave = d.strftime("%Y-%W")
        lunes = d - timedelta(days=d.weekday())
        resultado.append({"etiqueta": lunes.strftime("%d/%m"), "total": mapa.get(clave, 0) or 0})
    return resultado


def _restar_meses(anio, mes, i):
    total = (anio * 12 + (mes - 1)) - i
    return total // 12, total % 12 + 1


def ventas_por_mes(meses=6):
    conn = get_connection()
    filas = conn.execute(
        "SELECT strftime('%Y-%m', fecha) AS periodo, COALESCE(SUM(total), 0) AS total "
        "FROM facturas GROUP BY periodo"
    ).fetchall()
    conn.close()

    mapa = {f["periodo"]: f["total"] for f in filas}
    hoy = datetime.now().date()
    resultado = []
    for i in range(meses - 1, -1, -1):
        anio_i, mes_i = _restar_meses(hoy.year, hoy.month, i)
        clave = f"{anio_i:04d}-{mes_i:02d}"
        resultado.append({"etiqueta": MESES_CORTOS[mes_i - 1], "total": mapa.get(clave, 0) or 0})
    return resultado


def ventas_por_periodo(periodo="dia"):
    if periodo == "semana":
        return ventas_por_semana(8)
    if periodo == "mes":
        return ventas_por_mes(6)
    return ventas_por_dia(14)


def _rango_fechas(periodo):
    hoy = datetime.now().date()
    if periodo == "semana":
        lunes = hoy - timedelta(days=hoy.weekday())
        return lunes.strftime("%Y-%m-%d"), hoy.strftime("%Y-%m-%d")
    if periodo == "mes":
        primero = hoy.replace(day=1)
        return primero.strftime("%Y-%m-%d"), hoy.strftime("%Y-%m-%d")
    return hoy.strftime("%Y-%m-%d"), hoy.strftime("%Y-%m-%d")


def productos_mas_vendidos(desde=None, hasta=None, limite=8):
    conn = get_connection()
    sql = """
        SELECT fd.descripcion AS nombre, SUM(fd.cantidad) AS cantidad, SUM(fd.total_linea) AS total
        FROM factura_detalle fd
        JOIN facturas f ON f.id = fd.factura_id
    """
    condiciones = []
    params = []
    if desde:
        condiciones.append("date(f.fecha) >= date(?)")
        params.append(desde)
    if hasta:
        condiciones.append("date(f.fecha) <= date(?)")
        params.append(hasta)
    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)
    sql += " GROUP BY fd.descripcion ORDER BY cantidad DESC LIMIT ?"
    params.append(limite)

    filas = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(f) for f in filas]


def productos_mas_vendidos_periodo(periodo="dia", limite=8):
    desde, hasta = _rango_fechas(periodo)
    return productos_mas_vendidos(desde=desde, hasta=hasta, limite=limite)