/* =====================================================================
   clientes.js
   Modulo de Clientes: tabla, busqueda, modal de crear/editar y
   activar/desactivar. Habla con Python via window.pywebview.api
   ===================================================================== */

const modalCliente = document.getElementById("modal-cliente");
const formCliente = document.getElementById("form-cliente");
const errorCliente = document.getElementById("form-cliente-error");
const cliTbody = document.getElementById("cli-tbody");
const cliEmptyState = document.getElementById("cli-empty");
const cliInputBuscar = document.getElementById("cli-buscar");
const cliCheckVerInactivos = document.getElementById("cli-ver-inactivos");

function apiCliente() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaCli(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtmlCli(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

async function cargarClientes() {
  const api = apiCliente();
  if (!api) return;

  const busqueda = cliInputBuscar.value.trim();
  const incluirInactivos = cliCheckVerInactivos.checked;

  const clientes = await api.listar_clientes(incluirInactivos, busqueda || null);
  pintarTablaClientes(clientes);
}

function pintarTablaClientes(clientes) {
  cliTbody.innerHTML = "";

  if (!clientes || clientes.length === 0) {
    cliEmptyState.style.display = "block";
    document.getElementById("tabla-clientes").style.display = "none";
    return;
  }

  cliEmptyState.style.display = "none";
  document.getElementById("tabla-clientes").style.display = "table";

  clientes.forEach((c) => {
    const tr = document.createElement("tr");
    if (!c.activo) tr.classList.add("inactivo");

    tr.innerHTML = `
      <td class="cell-mono">${c.codigo || "—"}</td>
      <td>
        <div class="cell-strong">${escapeHtmlCli(c.nombre)}</div>
        ${c.correo ? `<div class="cell-sub">${escapeHtmlCli(c.correo)}</div>` : ""}
      </td>
      <td>${escapeHtmlCli(c.tipo_cliente || "Individual")}</td>
      <td class="cell-mono">${escapeHtmlCli(c.telefono || "—")}</td>
      <td class="cell-mono">${formatoMonedaCli(c.limite_credito)}</td>
      <td class="cell-mono">${c.dias_credito || 0} días</td>
      <td>
        ${c.activo
          ? `<span class="badge badge-success">Activo</span>`
          : `<span class="badge badge-muted">Inactivo</span>`}
      </td>
      <td>
        <div class="cell-actions">
          <button class="row-action" title="Editar" data-accion="editar" data-id="${c.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          ${c.activo
            ? `<button class="row-action danger" title="Desactivar" data-accion="desactivar" data-id="${c.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
               </button>`
            : `<button class="row-action success" title="Reactivar" data-accion="activar" data-id="${c.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
               </button>`}
        </div>
      </td>
    `;
    cliTbody.appendChild(tr);
  });
}

function abrirModalClienteNuevo() {
  formCliente.reset();
  document.getElementById("c-id").value = "";
  document.getElementById("modal-cliente-titulo").textContent = "Nuevo cliente";
  errorCliente.classList.remove("active");
  modalCliente.classList.add("active");
  document.getElementById("c-tipo").focus();
}

function abrirModalClienteEditar(cliente) {
  document.getElementById("c-id").value = cliente.id;
  document.getElementById("c-tipo").value = cliente.tipo_cliente || "Individual";
  document.getElementById("c-codigo").value = cliente.codigo || "";
  document.getElementById("c-nombre").value = cliente.nombre || "";
  document.getElementById("c-rnc").value = cliente.rnc_cedula || "";
  document.getElementById("c-telefono").value = cliente.telefono || "";
  document.getElementById("c-telefono-alt").value = cliente.telefono_alt || "";
  document.getElementById("c-correo").value = cliente.correo || "";
  document.getElementById("c-direccion").value = cliente.direccion || "";
  document.getElementById("c-limite-credito").value = cliente.limite_credito;
  document.getElementById("c-dias-credito").value = cliente.dias_credito;
  document.getElementById("c-notas").value = cliente.notas || "";

  document.getElementById("modal-cliente-titulo").textContent = "Editar cliente";
  errorCliente.classList.remove("active");
  modalCliente.classList.add("active");
}

function cerrarModalCliente() {
  modalCliente.classList.remove("active");
}

document.getElementById("btn-nuevo-cliente").addEventListener("click", abrirModalClienteNuevo);
document.getElementById("btn-cancelar-cliente").addEventListener("click", cerrarModalCliente);
document.getElementById("modal-cliente-cerrar").addEventListener("click", cerrarModalCliente);
modalCliente.addEventListener("click", (e) => {
  if (e.target === modalCliente) cerrarModalCliente();
});

document.getElementById("c-tipo").addEventListener("change", (e) => {
  const label = document.getElementById("c-nombre-label");
  const campoNombre = document.getElementById("c-nombre");
  if (e.target.value === "Empresa") {
    label.textContent = "Razón social *";
    campoNombre.placeholder = "Ej. Distribuidora El Buen Sabor SRL";
  } else {
    label.textContent = "Nombre completo *";
    campoNombre.placeholder = "Ej. Rosa Martínez";
  }
});

document.getElementById("btn-generar-codigo-cliente").addEventListener("click", async () => {
  const api = apiCliente();
  if (!api) return;
  const codigo = await api.generar_codigo_cliente();
  document.getElementById("c-codigo").value = codigo;
});

formCliente.addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiCliente();
  if (!api) return;

  const id = document.getElementById("c-id").value;

  const datos = {
    tipo_cliente: document.getElementById("c-tipo").value,
    codigo: document.getElementById("c-codigo").value,
    nombre: document.getElementById("c-nombre").value,
    rnc_cedula: document.getElementById("c-rnc").value,
    telefono: document.getElementById("c-telefono").value,
    telefono_alt: document.getElementById("c-telefono-alt").value,
    correo: document.getElementById("c-correo").value,
    direccion: document.getElementById("c-direccion").value,
    limite_credito: document.getElementById("c-limite-credito").value,
    dias_credito: document.getElementById("c-dias-credito").value,
    notas: document.getElementById("c-notas").value,
  };

  if (!datos.nombre.trim()) {
    mostrarErrorCliente("Ponle un nombre (o razón social) al cliente.");
    return;
  }

  const resultado = id
    ? await api.actualizar_cliente(Number(id), datos)
    : await api.crear_cliente(datos);

  if (!resultado.ok) {
    mostrarErrorCliente(resultado.error || "No se pudo guardar el cliente.");
    return;
  }

  cerrarModalCliente();
  cargarClientes();
});

function mostrarErrorCliente(mensaje) {
  errorCliente.textContent = mensaje;
  errorCliente.classList.add("active");
}

cliTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;
  const api = apiCliente();
  if (!api) return;

  if (accion === "editar") {
    const cliente = await api.obtener_cliente(id);
    if (cliente) abrirModalClienteEditar(cliente);
  } else if (accion === "desactivar") {
    await api.cambiar_estado_cliente(id, false);
    cargarClientes();
  } else if (accion === "activar") {
    await api.cambiar_estado_cliente(id, true);
    cargarClientes();
  }
});

let cliDebounceTimer = null;
cliInputBuscar.addEventListener("input", () => {
  clearTimeout(cliDebounceTimer);
  cliDebounceTimer = setTimeout(cargarClientes, 250);
});
cliCheckVerInactivos.addEventListener("change", cargarClientes);

document.querySelector('.nav-item[data-view="clientes"]').addEventListener("click", cargarClientes);