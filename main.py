"""
main.py
Punto de entrada de la aplicacion de escritorio.

Abre una ventana nativa (usando pywebview) que carga la interfaz que
esta en /ui. La ventana NO tiene barra de direcciones ni controles de
navegador: para el usuario final se ve y se siente como un programa de
Windows normal, no como una pagina web.

Para correrlo en desarrollo:
    python main.py

Para convertirlo en un .exe mas adelante se usara PyInstaller
(ver /build/README_BUILD.md).
"""

import os
import webview

from db import database
from api import Api

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML = os.path.join(BASE_DIR, "ui", "index.html")
ICON_PATH = os.path.join(BASE_DIR, "ui", "img", "icon.ico")


def main():
    # Crea la base de datos y las tablas si es la primera vez que se abre
    database.init_db()

    api = Api()

    window = webview.create_window(
        title="Sistema de Facturación e Inventario",
        url=INDEX_HTML,
        js_api=api,
        width=1280,
        height=800,
        min_size=(1024, 650),
        background_color="#1C2333",
        text_select=False,
    )

    api.set_window(window)

    # gui='edgechromium' en Windows da el mejor resultado visual (motor
    # moderno tipo Chrome). pywebview detecta el sistema operativo y usa
    # el motor correcto automaticamente si no se especifica.
    #
    # icon=... reemplaza el logo de Python por el nuestro en la barra de
    # tareas y el titulo de la ventana mientras desarrollamos con
    # "python main.py". Cuando empaquetemos el .exe con PyInstaller,
    # ademas le pondremos el icono directo al .exe con --icon, para que
    # se vea correcto incluso en el explorador de archivos.
    webview.start(debug=False, icon=ICON_PATH)


if __name__ == "__main__":
    main()
