/* =====================================================================
   configuracion.js
   Modulo de Configuracion: 3 pestanas (Empresa, Preferencias, Usuarios).
   El backend (api.py) ya rechaza los cambios que el rol actual no puede
   hacer - aqui solo deshabilitamos visualmente los campos para que la
   experiencia sea clara, no como unica proteccion.
   ===================================================================== */

function apiCfg() {
  return window.pywebview ? window.pywebview.api : null;
}

document.querySelectorAll(".cfg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".cfg-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".cfg-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("cfg-panel-" + tab.dataset.tab).classList.add("active");

    if (tab.dataset.tab === "usuarios") cargarUsuarios();
  });
});

async function cargarConfiguracion() {
  const api = apiCfg();
  if (!api) return;

  const datos = await api.obtener_configuracion_completa();

  document.getElementById("cfg-nombre-empresa").value = datos.nombre_empresa || "";
  document.getElementById("cfg-rnc-empresa").value = datos.rnc_empresa || "";
  document.getElementById("cfg-telefono-empresa").value = datos.telefono_empresa || "";
  document.getElementById("cfg-direccion-empresa").value = datos.direccion_empresa || "";

  document.getElementById("cfg-moneda").value = datos.moneda || "";
  document.getElementById("cfg-impuesto").value = datos.impuesto_pct || "0";

  document.getElementById("cfg-num-factura").value = datos.siguiente_numero_factura || "1";
  document.getElementById("cfg-num-cotizacion").value = datos.siguiente_numero_cotizacion || "1";

  const preview = document.getElementById("cfg-logo-preview");
  logoBase64Actual = datos.logo_base64 || "";
  if (logoBase64Actual) {
    preview.innerHTML = `<img src="${logoBase64Actual}" alt="Logo" />`;
  } else {
    preview.textContent = "EP";
  }
}

document.querySelector('.nav-item[data-view="configuracion"]').addEventListener("click", cargarConfiguracion);

function mostrarBannerCfg(mensaje, tipo) {
  const banner = document.getElementById("cfg-banner");
  banner.textContent = mensaje;
  banner.className = "banner active banner-" + tipo;
  setTimeout(() => banner.classList.remove("active"), 4000);
}

let logoBase64Actual = "";

document.getElementById("btn-cambiar-logo").addEventListener("click", () => {
  document.getElementById("cfg-logo-input").click();
});

document.getElementById("cfg-logo-input").addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    logoBase64Actual = lector.result;
    document.getElementById("cfg-logo-preview").innerHTML = `<img src="${logoBase64Actual}" alt="Logo" />`;
  };
  lector.readAsDataURL(archivo);
});

document.getElementById("btn-quitar-logo").addEventListener("click", () => {
  logoBase64Actual = "";
  document.getElementById("cfg-logo-preview").innerHTML = "EP";
});

document.getElementById("btn-guardar-empresa").addEventListener("click", async () => {
  const api = apiCfg();
  if (!api) return;
  const errorBox = document.getElementById("cfg-empresa-error");
  errorBox.classList.remove("active");

  const datos = {
    nombre_empresa: document.getElementById("cfg-nombre-empresa").value,
    rnc_empresa: document.getElementById("cfg-rnc-empresa").value,
    telefono_empresa: document.getElementById("cfg-telefono-empresa").value,
    direccion_empresa: document.getElementById("cfg-direccion-empresa").value,
    logo_base64: logoBase64Actual,
  };

  if (!datos.nombre_empresa.trim()) {
    errorBox.textContent = "El nombre de la empresa no puede quedar vacío.";
    errorBox.classList.add("active");
    return;
  }

  const resultado = await api.actualizar_datos_empresa(datos);
  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo guardar.";
    errorBox.classList.add("active");
    return;
  }

  mostrarBannerCfg("Datos de la empresa actualizados.", "success");
  cargarInfoEmpresa();
});

document.getElementById("btn-guardar-preferencias").addEventListener("click", async () => {
  const api = apiCfg();
  if (!api) return;
  const errorBox = document.getElementById("cfg-preferencias-error");
  errorBox.classList.remove("active");

  const datos = {
    moneda: document.getElementById("cfg-moneda").value,
    impuesto_pct: document.getElementById("cfg-impuesto").value,
  };

  const resultado = await api.actualizar_preferencias(datos);
  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo guardar.";
    errorBox.classList.add("active");
    return;
  }

  mostrarBannerCfg("Preferencias actualizadas.", "success");
});

document.getElementById("btn-guardar-numeracion").addEventListener("click", async () => {
  const api = apiCfg();
  if (!api) return;
  const errorBox = document.getElementById("cfg-numeracion-error");
  errorBox.classList.remove("active");

  const datos = {
    siguiente_numero_factura: document.getElementById("cfg-num-factura").value,
    siguiente_numero_cotizacion: document.getElementById("cfg-num-cotizacion").value,
  };

  const resultado = await api.actualizar_numeracion(datos);
  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo guardar.";
    errorBox.classList.add("active");
    return;
  }

  mostrarBannerCfg("Numeración actualizada.", "success");
});

async function cargarUsuarios() {
  const api = apiCfg();
  if (!api) return;
  const usuarios = await api.listar_usuarios(true);
  const tbody = document.getElementById("usuarios-tbody");
  tbody.innerHTML = "";

  usuarios.forEach((u) => {
    const rolTexto = u.rol === "admin_general" ? "Admin General" : "Admin Cliente";
    const tr = document.createElement("tr");
    if (!u.activo) tr.classList.add("inactivo");
    tr.innerHTML = `
      <td class="cell-strong">${u.nombre}</td>
      <td class="cell-mono">${u.usuario}</td>
      <td><span class="badge ${u.rol === 'admin_general' ? 'badge-warning' : 'badge-muted'}">${rolTexto}</span></td>
      <td>${u.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}</td>
      <td>
        <div class="cell-actions">
          <button class="row-action" title="Cambiar contraseña" data-accion="password" data-id="${u.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          ${u.activo
            ? `<button class="row-action danger" title="Desactivar" data-accion="desactivar" data-id="${u.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
               </button>`
            : `<button class="row-action success" title="Reactivar" data-accion="activar" data-id="${u.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
               </button>`}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("usuarios-tbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const api = apiCfg();
  if (!api) return;

  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;

  if (accion === "password") {
    const nueva = prompt("Nueva contraseña (mínimo 6 caracteres):");
    if (nueva === null) return;
    const resultado = await api.cambiar_password_usuario(id, nueva);
    if (!resultado.ok) {
      alert(resultado.error || "No se pudo cambiar la contraseña.");
      return;
    }
    mostrarBannerCfg("Contraseña actualizada.", "success");
  } else if (accion === "desactivar") {
    const resultado = await api.cambiar_estado_usuario(id, false);
    if (!resultado.ok) {
      alert(resultado.error || "No se pudo desactivar.");
      return;
    }
    cargarUsuarios();
  } else if (accion === "activar") {
    await api.cambiar_estado_usuario(id, true);
    cargarUsuarios();
  }
});

const modalUsuario = document.getElementById("modal-usuario");
const formUsuario = document.getElementById("form-usuario");
const errorUsuario = document.getElementById("form-usuario-error");

document.getElementById("btn-nuevo-usuario").addEventListener("click", () => {
  formUsuario.reset();
  document.getElementById("u-id").value = "";
  document.getElementById("modal-usuario-titulo").textContent = "Nuevo usuario";
  errorUsuario.classList.remove("active");
  modalUsuario.classList.add("active");
  document.getElementById("u-nombre").focus();
});

document.getElementById("btn-cancelar-usuario").addEventListener("click", () => {
  modalUsuario.classList.remove("active");
});
document.getElementById("modal-usuario-cerrar").addEventListener("click", () => {
  modalUsuario.classList.remove("active");
});
modalUsuario.addEventListener("click", (e) => {
  if (e.target === modalUsuario) modalUsuario.classList.remove("active");
});

formUsuario.addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiCfg();
  if (!api) return;
  errorUsuario.classList.remove("active");

  const datos = {
    nombre: document.getElementById("u-nombre").value,
    usuario: document.getElementById("u-usuario").value,
    password: document.getElementById("u-password").value,
    rol: document.getElementById("u-rol").value,
  };

  const resultado = await api.crear_usuario(datos);
  if (!resultado.ok) {
    errorUsuario.textContent = resultado.error || "No se pudo crear el usuario.";
    errorUsuario.classList.add("active");
    return;
  }

  modalUsuario.classList.remove("active");
  mostrarBannerCfg("Usuario creado correctamente.", "success");
  cargarUsuarios();
});