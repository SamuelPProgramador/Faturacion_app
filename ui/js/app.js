/* =====================================================================
   app.js
   Navegacion entre modulos (SPA simple, sin recargar la ventana) y
   conexion con Python via pywebview.api
   ===================================================================== */

const navItems = document.querySelectorAll(".nav-item[data-view]");
const views = document.querySelectorAll(".view");
const viewHeading = document.getElementById("view-heading");

const titles = {
  resumen: "Resumen de ventas",
  facturar: "Facturar",
  cotizaciones: "Cotizaciones",
  productos: "Productos",
  entradas: "Entradas",
  clientes: "Clientes",
  proveedores: "Proveedores",
  "proveedor-detalle": "Detalle de proveedor",
  gastos: "Gastos",
  cxc: "Cuentas por Cobrar",
  estadocuenta: "Estado de Cuenta",
  configuracion: "Configuración",
};

function goToView(viewName) {
  views.forEach((v) => v.classList.remove("active"));
  navItems.forEach((n) => n.classList.remove("active"));

  const target = document.getElementById("view-" + viewName);
  const navBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);

  if (target) target.classList.add("active");
  if (navBtn) navBtn.classList.add("active");

  viewHeading.textContent = titles[viewName] || "";
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    goToView(btn.dataset.view);
  });
});

// --- boton salir: le pide a Python que cierre la ventana ---
document.getElementById("btn-salir").addEventListener("click", () => {
  if (window.pywebview) {
    window.pywebview.api.salir_app();
  }
});

// --- fecha en la barra superior ---
function actualizarFecha() {
  const hoy = new Date();
  const opciones = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const texto = hoy.toLocaleDateString("es-DO", opciones);
  document.getElementById("topbar-date").textContent =
    texto.charAt(0).toUpperCase() + texto.slice(1);
}
actualizarFecha();

// --- carga el nombre real de la empresa desde la base de datos ---
function cargarInfoEmpresa() {
  if (!window.pywebview) return;
  window.pywebview.api.obtener_info_empresa().then((info) => {
    if (info && info.nombre_empresa) {
      document.getElementById("brand-name").textContent = info.nombre_empresa;
    }
  });
}

// pywebview dispara este evento cuando la api ya esta lista para usarse
window.addEventListener("pywebviewready", cargarInfoEmpresa);
