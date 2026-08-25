/* =====================================================================
   auth.js
   Controla la pantalla de login, la sesion actual, y esconde en pantalla
   lo que el rol actual no deberia ver. IMPORTANTE: esto es solo una
   comodidad visual - el permiso real se aplica en api.py (Python), que
   es lo unico que de verdad protege los datos.
   ===================================================================== */

let sesionActual = null; // {id, nombre, usuario, rol}

function apiAuth() {
  return window.pywebview ? window.pywebview.api : null;
}

function esAdminGeneral() {
  return sesionActual && sesionActual.rol === "admin_general";
}

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiAuth();
  if (!api) return;

  const usuario = document.getElementById("login-usuario").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error");
  errorBox.classList.remove("active");

  const resultado = await api.iniciar_sesion(usuario, password);

  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo iniciar sesión.";
    errorBox.classList.add("active");
    return;
  }

  sesionActual = resultado.usuario;
  entrarAlSistema();
});

function entrarAlSistema() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "flex";
  document.getElementById("login-password").value = "";

  pintarUsuarioEnTopbar();
  aplicarPermisosDeRol();
  cargarInfoEmpresa();

  goToView("resumen");
}

function pintarUsuarioEnTopbar() {
  if (!sesionActual) return;
  document.getElementById("topbar-user-nombre").textContent = sesionActual.nombre;
  document.getElementById("topbar-user-avatar").textContent = sesionActual.nombre.charAt(0).toUpperCase();
  const rolBadge = document.getElementById("topbar-user-rol");
  rolBadge.textContent = esAdminGeneral() ? "Admin General" : "Admin Cliente";
  rolBadge.className = esAdminGeneral() ? "badge badge-warning" : "badge badge-muted";
}

function aplicarPermisosDeRol() {
  const tabUsuarios = document.getElementById("cfg-tab-usuarios");
  const lockNote = document.getElementById("cfg-empresa-lock-note");

  if (esAdminGeneral()) {
    if (tabUsuarios) tabUsuarios.style.display = "inline-flex";
    if (lockNote) lockNote.style.display = "none";
    document.querySelectorAll("#cfg-panel-empresa input").forEach((el) => (el.disabled = false));
    document.getElementById("btn-guardar-empresa").style.display = "inline-flex";
    document.getElementById("btn-cambiar-logo").style.display = "inline-flex";
    document.getElementById("btn-quitar-logo").style.display = "inline-flex";
  } else {
    if (tabUsuarios) tabUsuarios.style.display = "none";
    if (lockNote) lockNote.style.display = "block";
    document.querySelectorAll("#cfg-panel-empresa input").forEach((el) => (el.disabled = true));
    document.getElementById("btn-guardar-empresa").style.display = "none";
    document.getElementById("btn-cambiar-logo").style.display = "none";
    document.getElementById("btn-quitar-logo").style.display = "none";
  }
}

document.getElementById("btn-cerrar-sesion").addEventListener("click", async () => {
  const api = apiAuth();
  if (api) await api.cerrar_sesion();
  sesionActual = null;
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("login-usuario").value = "";
  document.getElementById("form-login").reset();
});

window.addEventListener("pywebviewready", () => {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-shell").style.display = "none";
});