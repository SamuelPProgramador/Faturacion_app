"""
api.py
Esta clase es el "puente" entre la interfaz (HTML/JS) y Python.
Cada metodo publico de aqui queda disponible en el JavaScript como
pywebview.api.nombre_del_metodo(...)
"""

import webview
from db import database
from db import productos as productos_db
from db import clientes as clientes_db
from db import facturas as facturas_db
from db import entradas as entradas_db
from db import cotizaciones as cotizaciones_db


class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    # -----------------------------------------------------------
    # Configuracion / info general de la empresa
    # -----------------------------------------------------------
    def obtener_info_empresa(self):
        return {
            "nombre_empresa": database.get_config("nombre_empresa", "Mi Empresa"),
            "moneda": database.get_config("moneda", "RD$"),
            "impuesto_pct": float(database.get_config("impuesto_pct", "0") or 0),
        }

    # -----------------------------------------------------------
    # Productos
    # -----------------------------------------------------------
    def listar_productos(self, incluir_inactivos=False, busqueda=None):
        return productos_db.listar(incluir_inactivos=incluir_inactivos, busqueda=busqueda)

    def obtener_producto(self, producto_id):
        return productos_db.obtener(producto_id)

    def generar_codigo_producto(self, categoria):
        return productos_db.generar_codigo(categoria)

    def crear_producto(self, datos):
        return productos_db.crear(datos)

    def actualizar_producto(self, producto_id, datos):
        return productos_db.actualizar(producto_id, datos)

    def cambiar_estado_producto(self, producto_id, activo):
        return productos_db.cambiar_estado(producto_id, activo)

    # -----------------------------------------------------------
    # Clientes
    # -----------------------------------------------------------
    def listar_clientes(self, incluir_inactivos=False, busqueda=None):
        return clientes_db.listar(incluir_inactivos=incluir_inactivos, busqueda=busqueda)

    def obtener_cliente(self, cliente_id):
        return clientes_db.obtener(cliente_id)

    def generar_codigo_cliente(self):
        return clientes_db.generar_codigo()

    def crear_cliente(self, datos):
        return clientes_db.crear(datos)

    def actualizar_cliente(self, cliente_id, datos):
        return clientes_db.actualizar(cliente_id, datos)

    def cambiar_estado_cliente(self, cliente_id, activo):
        return clientes_db.cambiar_estado(cliente_id, activo)

    # -----------------------------------------------------------
    # Facturar
    # -----------------------------------------------------------
    def previsualizar_numero_factura(self):
        return facturas_db.previsualizar_numero()

    def crear_factura(self, datos):
        return facturas_db.crear(datos)

    def listar_facturas_recientes(self, limite=10):
        return facturas_db.listar_recientes(limite)

    def obtener_factura(self, factura_id):
        return facturas_db.obtener_con_detalle(factura_id)

    # -----------------------------------------------------------
    # Entradas
    # -----------------------------------------------------------
    def crear_entrada(self, datos):
        return entradas_db.crear(datos)

    def listar_entradas_recientes(self, limite=15):
        return entradas_db.listar_recientes(limite)

    def listar_entradas_por_producto(self, producto_id, limite=30):
        return entradas_db.listar_por_producto(producto_id, limite)

    # -----------------------------------------------------------
    # Cotizaciones
    # -----------------------------------------------------------
    def previsualizar_numero_cotizacion(self):
        return cotizaciones_db.previsualizar_numero()

    def crear_cotizacion(self, datos):
        return cotizaciones_db.crear(datos)

    def listar_cotizaciones_recientes(self, limite=20):
        return cotizaciones_db.listar_recientes(limite)

    def obtener_cotizacion(self, cotizacion_id):
        return cotizaciones_db.obtener_con_detalle(cotizacion_id)

    def cambiar_estado_cotizacion(self, cotizacion_id, estado):
        return cotizaciones_db.cambiar_estado(cotizacion_id, estado)

    def convertir_cotizacion_a_factura(self, cotizacion_id, metodo_pago="Efectivo"):
        return cotizaciones_db.convertir_a_factura(cotizacion_id, metodo_pago)

    # -----------------------------------------------------------
    # Control de la ventana
    # -----------------------------------------------------------
    def salir_app(self):
        if self._window:
            self._window.destroy()

    def minimizar_app(self):
        if self._window:
            self._window.minimize()