"""
db/pdf_cotizacion.py
Genera un PDF con el detalle de una cotizacion (encabezado de la empresa,
datos del cliente, tabla de productos y totales) y lo guarda en una
carpeta local para que la app lo abra con el visor de PDF del sistema.
"""

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from db.database import get_config
from db import cotizaciones as cotizaciones_db


def _carpeta_pdfs():
    """Carpeta donde se guardan los PDF generados, junto al ejecutable/proyecto."""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    carpeta = os.path.join(base, "cotizaciones_pdf")
    os.makedirs(carpeta, exist_ok=True)
    return carpeta


def generar(cotizacion_id):
    """
    Genera el PDF de una cotizacion y devuelve {"ok": True, "ruta": "..."}
    o {"ok": False, "error": "..."} si algo sale mal.
    """
    cot = cotizaciones_db.obtener_con_detalle(cotizacion_id)
    if not cot:
        return {"ok": False, "error": "La cotización ya no existe."}

    nombre_empresa = get_config("nombre_empresa", "Mi Empresa")
    moneda = get_config("moneda", "RD$")

    def fmt(valor):
        return f"{moneda} {float(valor or 0):,.2f}"

    ruta = os.path.join(_carpeta_pdfs(), f"{cot['numero']}.pdf")

    doc = SimpleDocTemplate(
        ruta, pagesize=letter,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm,
    )
    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle("titulo", parent=estilos["Heading1"], fontSize=18, spaceAfter=2)
    subtitulo = ParagraphStyle("subtitulo", parent=estilos["Normal"], textColor=colors.HexColor("#666666"))
    numero_style = ParagraphStyle("numero", parent=estilos["Heading2"], alignment=TA_RIGHT, textColor=colors.HexColor("#C98A3D"))
    normal = estilos["Normal"]
    normal_right = ParagraphStyle("normal_right", parent=estilos["Normal"], alignment=TA_RIGHT)
    total_style = ParagraphStyle("total", parent=estilos["Heading2"], alignment=TA_RIGHT)

    elementos = []

    encabezado = Table(
        [[Paragraph(nombre_empresa, titulo), Paragraph(f"COTIZACIÓN<br/>{cot['numero']}", numero_style)]],
        colWidths=[100 * mm, 70 * mm],
    )
    encabezado.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elementos.append(encabezado)
    elementos.append(Paragraph("Sistema interno de facturación", subtitulo))
    elementos.append(Spacer(1, 14))

    info = Table(
        [
            ["Cliente:", cot.get("cliente_nombre", "Consumidor final")],
            ["Fecha:", str(cot.get("fecha", ""))[:10]],
            ["Válida hasta:", cot.get("vencimiento", "—")],
            ["Estado:", cot.get("estado", "Pendiente")],
        ],
        colWidths=[35 * mm, 100 * mm],
    )
    info.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(info)
    elementos.append(Spacer(1, 16))

    filas = [["Producto", "Precio unit.", "Cant.", "Total línea"]]
    for linea in cot.get("lineas", []):
        filas.append([
            linea["descripcion"],
            fmt(linea["precio_unit"]),
            str(linea["cantidad"]),
            fmt(linea["total_linea"]),
        ])

    tabla_productos = Table(filas, colWidths=[75 * mm, 35 * mm, 20 * mm, 35 * mm])
    tabla_productos.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2430")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7F9")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elementos.append(tabla_productos)
    elementos.append(Spacer(1, 14))

    totales = Table(
        [
            ["Subtotal", fmt(cot["subtotal"])],
            ["Impuesto", fmt(cot["impuesto"])],
            ["Total", fmt(cot["total"])],
        ],
        colWidths=[140 * mm, 35 * mm],
    )
    totales.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 2), (-1, 2), 13),
        ("LINEABOVE", (0, 2), (-1, 2), 0.8, colors.HexColor("#333333")),
        ("TOPPADDING", (0, 2), (-1, 2), 6),
    ]))
    elementos.append(totales)

    if cot.get("notas"):
        elementos.append(Spacer(1, 16))
        elementos.append(Paragraph("<b>Notas:</b>", normal))
        elementos.append(Paragraph(cot["notas"], normal))

    doc.build(elementos)

    return {"ok": True, "ruta": ruta}
