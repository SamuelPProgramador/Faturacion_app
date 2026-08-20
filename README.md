# Sistema de Facturación e Inventario — Empanadas y Pastelitos

Esqueleto inicial del sistema. Escritorio (no navegador), Python + pywebview,
base de datos SQLite local.

## Estructura del proyecto

```
facturacion_app/
├── main.py              → punto de entrada, abre la ventana de la app
├── api.py                → puente Python ↔ interfaz (se ira llenando por módulo)
├── requirements.txt
├── negocio.db             → se crea solo la primera vez que se abre la app
├── db/
│   └── database.py       → creación de tablas SQLite (productos, clientes, facturas...)
├── ui/
│   ├── index.html         → sidebar + las 8 vistas del sistema
│   ├── css/style.css      → estilo visual (sidebar oscuro, acento dorado)
│   └── js/app.js          → navegación entre módulos
└── build/                 → (para más adelante) instrucciones y config del .exe
```

## Cómo correrlo mientras desarrollamos

1. Crear un entorno virtual (recomendado):
   ```
   python -m venv venv
   venv\Scripts\activate       (en Windows)
   ```

2. Instalar dependencias:
   ```
   pip install -r requirements.txt
   ```

3. Correr la app:
   ```
   python main.py
   ```

   Se abrirá una ventana de escritorio normal — sin barra de direcciones,
   sin barra de búsqueda, sin nada que delate que por dentro es HTML/JS.
   Eso ya viene así por como funciona pywebview: no es un navegador, es
   una ventana nativa que simplemente renderiza el contenido.

## Qué tiene este primer esqueleto

- Sidebar con los 8 módulos + botón Salir, ya navegable (cambia de vista
  sin recargar, como una app real).
- Base de datos SQLite con TODAS las tablas ya creadas: productos,
  clientes, facturas + detalle, cotizaciones + detalle, entradas,
  cuentas por cobrar (cxc) y sus pagos, y configuración de la empresa.
- Cada módulo tiene por ahora una tarjeta de "próximamente" — el
  siguiente paso es ir llenando cada uno (empezaríamos por Productos,
  ya que Facturar y Entradas dependen de que existan productos).

## Cómo lo vamos a convertir en .exe (más adelante, cuando el sistema esté listo)

Con PyInstaller, algo así:

```
pyinstaller --noconfirm --onefile --windowed ^
  --add-data "ui;ui" ^
  --name "SistemaFacturacion" ^
  main.py
```

Esto genera un solo `SistemaFacturacion.exe` en `dist/`. Después, si
quieres, le hacemos un instalador con Inno Setup para que el cliente
tenga ícono en el escritorio y un instalador de "Siguiente, Siguiente,
Finalizar" como cualquier programa de Windows. Eso lo dejamos para
cuando ya tengamos los módulos completos.
