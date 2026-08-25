"""
api.py
Esta clase es el "puente" entre la interfaz (HTML/JS) y Python.
Cada metodo publico de aqui queda disponible en el JavaScript como
pywebview.api.nombre_del_metodo(...)
"""

import os
import sys
import subprocess
import shutil
import base64
import webview
from db import database
from db import productos as productos_db
from db import clientes as clientes_db
from db import facturas as facturas_db
<<<<<<< HEAD
from db import entradas as entradas_db
from db import pdf_cotizacion
from db import entradas as entradas_db
from db import proveedores as proveedores_db
from db import gastos as gastos_db
from db import cotizaciones as cotizaciones_db
import 
from db import cotizaciones as cotizaciones_db
from db import pdf_cotizacion
from db import pdf_factura

>>>>>>> 67842e170161e9a5859dc563791a03ef9a1252a9

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
<<<<<<< HEAD
    # Entradas
    # -----------------------------------------------------------
    def crear_entrada(self, datos):
        return entradas_db.crear(datos)

    def listar_entradas_recientes(self, limite=15):
        return entradas_db.listar_recientes(limite)

    def listar_entradas_por_producto(self, producto_id, limite=30):
        return entradas_db.listar_por_producto(producto_id, limite)


    # -----------------------------------------------------------
    # Proveedores
    # -----------------------------------------------------------
    def listar_proveedores(self, incluir_inactivos=False, busqueda=None):
        return proveedores_db.listar(incluir_inactivos=incluir_inactivos, busqueda=busqueda)

    def obtener_proveedor(self, proveedor_id):
        return proveedores_db.obtener(proveedor_id)

    def generar_codigo_proveedor(self):
        return proveedores_db.generar_codigo()

    def crear_proveedor(self, datos):
        return proveedores_db.crear(datos)

    def actualizar_proveedor(self, proveedor_id, datos):
        return proveedores_db.actualizar(proveedor_id, datos)

    def cambiar_estado_proveedor(self, proveedor_id, activo):
        return proveedores_db.cambiar_estado(proveedor_id, activo)

    def obtener_resumen_proveedor(self, proveedor_id):
        return proveedores_db.obtener_resumen(proveedor_id)

    def listar_compras_proveedor(self, proveedor_id, limite=30):
        return proveedores_db.listar_compras(proveedor_id, limite)

    def listar_deudas_proveedor(self, proveedor_id):
        return proveedores_db.listar_deudas(proveedor_id)

    def registrar_pago_cxp(self, cxp_id, monto, metodo_pago="Efectivo"):
        return proveedores_db.registrar_pago_cxp(cxp_id, monto, metodo_pago)

        # -----------------------------------------------------------
    # Gastos
    # -----------------------------------------------------------
    def listar_gastos(self, fecha_desde=None, fecha_hasta=None, categoria=None, busqueda=None, limite=200):
        return gastos_db.listar(fecha_desde, fecha_hasta, categoria, busqueda, limite)

    def obtener_gasto(self, gasto_id):
        return gastos_db.obtener(gasto_id)

    def crear_gasto(self, datos):
        return gastos_db.crear(datos)

    def actualizar_gasto(self, gasto_id, datos):
        return gastos_db.actualizar(gasto_id, datos)

    def eliminar_gasto(self, gasto_id):
        return gastos_db.eliminar(gasto_id)

    def resumen_gastos_por_categoria(self, fecha_desde=None, fecha_hasta=None):
        return gastos_db.resumen_por_categoria(fecha_desde, fecha_hasta)


    # -----------------------------------------------------------
=======
>>>>>>> 67842e170161e9a5859dc563791a03ef9a1252a9
    # Cotizaciones
    # -----------------------------------------------------------
    def previsualizar_numero_cotizacion(self):
        return cotizaciones_db.previsualizar_numero()

    def crear_cotizacion(self, datos):
        return cotizaciones_db.crear(datos)

    def actualizar_cotizacion(self, cotizacion_id, datos):
        return cotizaciones_db.actualizar(cotizacion_id, datos)

    def eliminar_cotizacion(self, cotizacion_id):
        return cotizaciones_db.eliminar(cotizacion_id)

    def generar_pdf_cotizacion(self, cotizacion_id):
        resultado = pdf_cotizacion.generar(cotizacion_id)
        if resultado.get("ok"):
            try:
                with open(resultado["ruta"], "rb") as f:
                    resultado["base64"] = base64.b64encode(f.read()).decode("ascii")
            except Exception as e:
                resultado = {"ok": False, "error": f"El PDF se generó pero no se pudo leer: {e}"}
        return resultado

    def obtener_factura(self, factura_id):
        return facturas_db.obtener_con_detalle(factura_id)

    def generar_pdf_factura(self, factura_id):
        resultado = pdf_factura.generar(factura_id)
        if resultado.get("ok"):
            try:
                with open(resultado["ruta"], "rb") as f:
                    resultado["base64"] = base64.b64encode(f.read()).decode("ascii")
            except Exception as e:
                resultado = {"ok": False, "error": f"El PDF se generó pero no se pudo leer: {e}"}
        return resultado

    def abrir_pdf_externo(self, ruta):
        try:
            if sys.platform.startswith("win"):
                os.startfile(ruta)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", ruta])
            else:
                subprocess.Popen(["xdg-open", ruta])
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def imprimir_pdf(self, ruta):
        """
        Abre el PDF con el visor predeterminado. No dispara ningun
        dialogo de impresion automaticamente: el usuario decide si
        imprime desde ahi (Ctrl+P) o no.
        """
        try:
            if not ruta or not os.path.exists(ruta):
                return {"ok": False, "error": "El archivo PDF ya no existe."}

            if sys.platform.startswith("win"):
                os.startfile(ruta)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", ruta])
            else:
                subprocess.Popen(["xdg-open", ruta])
            return {"ok": True, "modo": "visor"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def guardar_pdf_como(self, ruta_origen):
        if not self._window:
            return {"ok": False, "error": "No se pudo abrir el diálogo de guardado."}
        try:
            nombre_sugerido = os.path.basename(ruta_origen)
            destino = self._window.create_file_dialog(
                webview.SAVE_DIALOG, save_filename=nombre_sugerido
            )
            if not destino:
                return {"ok": False, "cancelado": True}
            ruta_destino = destino[0] if isinstance(destino, (list, tuple)) else destino
            shutil.copyfile(ruta_origen, ruta_destino)
            return {"ok": True, "ruta": ruta_destino}
        except Exception as e:
            return {"ok": False, "error": str(e)}

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