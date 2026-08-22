/* =====================================================================
   proveedores.js
   Modulo de Proveedores: tabla con resumen de compras/deuda, modal de
   crear/editar, y una vista de detalle por proveedor (historial de
   compras + deudas pendientes con opcion de registrar pago).
   ===================================================================== */

const modalProveedor = document.getElementById("modal-proveedor");
const formProveedor = document.getElementById("form-proveedor");
const errorProveedor = document.getElementById("form-proveedor-error");
const provTbody = document.getElementById("prov-tbody");
const provEmptyState = document.getElementById("prov-empty");
const provInputBuscar = document.getElementById("prov-buscar");
const provCheckVerInactivos = document.getElementById("prov-ver-inactivos");

let proveedorDetalleActualId = null;

function apiProv() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaProv(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtmlProv(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

async function cargarProveedores() {
  const api = apiProv();
  if (!api) return;

  const busqueda = provInputBuscar.value.trim();
  const incluirInactivos = provCheckVerInactivos.checked;

  const proveedores = await api.listar_proveedores(incluirInactivos, busqueda || null);

  const conResumen = await Promise.all(
    proveedores.map(async (p) => {
      const resumen = await api.obtener_resumen_proveedor(p.id);
      return { ...p, ...resumen };
    })
  );

  pintarTablaProveedores(conResumen);
}

function pintarTablaProveedores(proveedores) {
  provTbody.innerHTML = "";

  if (!proveedores || proveedores.length === 0) {
    provEmptyState.style.display = "block";
    document.getElementById("tabla-proveedores").style.display = "none";
    return;
  }

  provEmptyState.style.display = "none";
  document.getElementById("tabla-proveedores").style.display = "table";

  proveedores.forEach((p) => {
    const tr = document.createElement("tr");
    if (!p.activo) tr.classList.add("inactivo");

    const deudaBadge = p.deuda_pendiente > 0
      ? `<span class="badge badge-warning">${formatoMonedaProv(p.deuda_pendiente)}</span>`
      : `<span class="cell-mono">${formatoMonedaProv(0)}</span>`;

    tr.innerHTML = `
      <td class="cell-mono">${p.codigo || "—"}</td>
      <td class="cell-strong" style="cursor:pointer;" data-accion="ver" data-id="${p.id}">${escapeHtmlProv(p.nombre)}</td>
      <td class="cell-mono">${escapeHtmlProv(p.telefono || "—")}</td>
      <td class="cell-sub">${escapeHtmlProv(p.productos_suministra || "—")}</td>
      <td class="cell-mono">${formatoMonedaProv(p.total_comprado)}</td>
      <td>${deudaBadge}</td>
      <td>
        ${p.activo
          ? `<span class="badge badge-success">Activo</span>`
          : `<span class="badge badge-muted">Inactivo</span>`}
      </td>
      <td>
        <div class="cell-actions">
          <button class="row-action" title="Editar" data-accion="editar" data-id="${p.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          ${p.activo
            ? `<button class="row-action danger" title="Desactivar" data-accion="desactivar" data-id="${p.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
               </button>`
            : `<button class="row-action success" title="Reactivar" data-accion="activar" data-id="${p.id}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
               </button>`}
        </div>
      </td>
    `;
    provTbody.appendChild(tr);
  });
}

function abrirModalProveedorNuevo() {
  formProveedor.reset();
  document.getElementById("p-id").value = "";
  document.getElementById("modal-proveedor-titulo").textContent = "Nuevo proveedor";
  errorProveedor.classList.remove("active");
  modalProveedor.classList.add("active");
  document.getElementById("p-nombre").focus();
}

function abrirModalProveedorEditar(proveedor) {
  document.getElementById("p-id").value = proveedor.id;
  document.getElementById("p-nombre").value = proveedor.nombre || "";
  document.getElementById("p-codigo").value = proveedor.codigo || "";
  document.getElementById("p-telefono").value = proveedor.telefono || "";
  document.getElementById("p-correo").value = proveedor.correo || "";
  document.getElementById("p-direccion").value = proveedor.direccion || "";
  document.getElementById("p-productos").value = proveedor.productos_suministra || "";
  document.getElementById("p-dias-credito").value = proveedor.dias_credito;
  document.getElementById("p-notas").value = proveedor.notas || "";

  document.getElementById("modal-proveedor-titulo").textContent = "Editar proveedor";
  errorProveedor.classList.remove("active");
  modalProveedor.classList.add("active");
}

function cerrarModalProveedor() {
  modalProveedor.classList.remove("active");
}

document.getElementById("btn-nuevo-proveedor").addEventListener("click", abrirModalProveedorNuevo);
document.getElementById("btn-cancelar-proveedor").addEventListener("click", cerrarModalProveedor);
document.getElementById("modal-proveedor-cerrar").addEventListener("click", cerrarModalProveedor);
modalProveedor.addEventListener("click", (e) => {
  if (e.target === modalProveedor) cerrarModalProveedor();
});

document.getElementById("btn-generar-codigo-proveedor").addEventListener("click", async () => {
  const api = apiProv();
  if (!api) return;
  const codigo = await api.generar_codigo_proveedor();
  document.getElementById("p-codigo").value = codigo;
});

formProveedor.addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiProv();
  if (!api) return;

  const id = document.getElementById("p-id").value;

  const datos = {
    nombre: document.getElementById("p-nombre").value,
    codigo: document.getElementById("p-codigo").value,
    telefono: document.getElementById("p-telefono").value,
    correo: document.getElementById("p-correo").value,
    direccion: document.getElementById("p-direccion").value,
    productos_suministra: document.getElementById("p-productos").value,
    dias_credito: document.getElementById("p-dias-credito").value,
    notas: document.getElementById("p-notas").value,
  };

  if (!datos.nombre.trim()) {
    errorProveedor.textContent = "Ponle un nombre al proveedor.";
    errorProveedor.classList.add("active");
    return;
  }

  const resultado = id
    ? await api.actualizar_proveedor(Number(id), datos)
    : await api.crear_proveedor(datos);

  if (!resultado.ok) {
    errorProveedor.textContent = resultado.error || "No se pudo guardar el proveedor.";
    errorProveedor.classList.add("active");
    return;
  }

  cerrarModalProveedor();
  cargarProveedores();
});

provTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-accion]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;
  const api = apiProv();
  if (!api) return;

  if (accion === "ver") {
    abrirDetalleProveedor(id);
  } else if (accion === "editar") {
    const proveedor = await api.obtener_proveedor(id);
    if (proveedor) abrirModalProveedorEditar(proveedor);
  } else if (accion === "desactivar") {
    await api.cambiar_estado_proveedor(id, false);
    cargarProveedores();
  } else if (accion === "activar") {
    await api.cambiar_estado_proveedor(id, true);
    cargarProveedores();
  }
});

let provDebounceTimer = null;
provInputBuscar.addEventListener("input", () => {
  clearTimeout(provDebounceTimer);
  provDebounceTimer = setTimeout(cargarProveedores, 250);
});
provCheckVerInactivos.addEventListener("change", cargarProveedores);

async function abrirDetalleProveedor(proveedorId) {
  const api = apiProv();
  if (!api) return;

  proveedorDetalleActualId = proveedorId;

  const [proveedor, resumen, deudas, compras] = await Promise.all([
    api.obtener_proveedor(proveedorId),
    api.obtener_resumen_proveedor(proveedorId),
    api.listar_deudas_proveedor(proveedorId),
    api.listar_compras_proveedor(proveedorId, 30),
  ]);

  if (!proveedor) return;

  document.getElementById("provdet-nombre").textContent = proveedor.nombre;
  document.getElementById("provdet-suministra").textContent =
    proveedor.productos_suministra || "Sin productos especificados";
  document.getElementById("provdet-total-comprado").textContent = formatoMonedaProv(resumen.total_comprado);
  document.getElementById("provdet-deuda").textContent = formatoMonedaProv(resumen.deuda_pendiente);

  pintarDeudasProveedor(deudas);
  pintarComprasProveedor(compras);

  goToView("proveedor-detalle");
}

function pintarDeudasProveedor(deudas) {
  const tbody = document.getElementById("provdet-deudas-tbody");
  const empty = document.getElementById("provdet-deudas-empty");
  const tabla = document.getElementById("tabla-provdet-deudas");
  tbody.innerHTML = "";

  if (!deudas || deudas.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    return;
  }
  empty.style.display = "none";
  tabla.style.display = "table";

  deudas.forEach((d) => {
    const fecha = (d.fecha || "").split(" ")[0];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td class="cell-mono">${d.fecha_vencim || "—"}</td>
      <td class="cell-mono">${formatoMonedaProv(d.monto_original)}</td>
      <td class="cell-mono">${formatoMonedaProv(d.saldo_pendiente)}</td>
      <td>
        <button class="btn btn-ghost" style="padding:6px 12px; font-size:12.5px;" data-accion="pagar" data-id="${d.id}" data-saldo="${d.saldo_pendiente}">
          Registrar pago
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function pintarComprasProveedor(compras) {
  const tbody = document.getElementById("provdet-compras-tbody");
  const empty = document.getElementById("provdet-compras-empty");
  const tabla = document.getElementById("tabla-provdet-compras");
  tbody.innerHTML = "";

  if (!compras || compras.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    return;
  }
  empty.style.display = "none";
  tabla.style.display = "table";

  compras.forEach((c) => {
    const fecha = (c.fecha || "").split(" ")[0];
    const total = c.cantidad * c.costo_unit;
    const badgeMetodo = c.metodo_pago === "Crédito"
      ? `<span class="badge badge-warning">Crédito</span>`
      : `<span class="badge badge-success">Contado</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td class="cell-strong">${escapeHtmlProv(c.producto_nombre)}</td>
      <td class="cell-mono">${c.cantidad}</td>
      <td class="cell-mono">${formatoMonedaProv(c.costo_unit)}</td>
      <td class="cell-mono">${formatoMonedaProv(total)}</td>
      <td>${badgeMetodo}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("btn-volver-proveedores").addEventListener("click", () => {
  goToView("proveedores");
  cargarProveedores();
});

const modalPagarCxp = document.getElementById("modal-pagar-cxp");

document.getElementById("provdet-deudas-tbody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion='pagar']");
  if (!btn) return;

  document.getElementById("pagar-cxp-id").value = btn.dataset.id;
  document.getElementById("pagar-cxp-saldo").textContent = formatoMonedaProv(btn.dataset.saldo);
  document.getElementById("pagar-cxp-monto").value = "";
  document.getElementById("pagar-cxp-monto").max = btn.dataset.saldo;
  document.getElementById("pagar-cxp-error").classList.remove("active");
  modalPagarCxp.classList.add("active");
});

document.getElementById("modal-pagar-cxp-cerrar").addEventListener("click", () => {
  modalPagarCxp.classList.remove("active");
});
document.getElementById("btn-cancelar-pagar-cxp").addEventListener("click", () => {
  modalPagarCxp.classList.remove("active");
});
modalPagarCxp.addEventListener("click", (e) => {
  if (e.target === modalPagarCxp) modalPagarCxp.classList.remove("active");
});

document.getElementById("btn-confirmar-pagar-cxp").addEventListener("click", async () => {
  const api = apiProv();
  if (!api) return;

  const cxpId = Number(document.getElementById("pagar-cxp-id").value);
  const monto = Number(document.getElementById("pagar-cxp-monto").value);
  const metodo = document.getElementById("pagar-cxp-metodo").value;
  const errorBox = document.getElementById("pagar-cxp-error");
  errorBox.classList.remove("active");

  if (!monto || monto <= 0) {
    errorBox.textContent = "Ingresa un monto válido.";
    errorBox.classList.add("active");
    return;
  }

  const resultado = await api.registrar_pago_cxp(cxpId, monto, metodo);
  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo registrar el pago.";
    errorBox.classList.add("active");
    return;
  }

  modalPagarCxp.classList.remove("active");
  if (proveedorDetalleActualId) abrirDetalleProveedor(proveedorDetalleActualId);
});

document.querySelector('.nav-item[data-view="proveedores"]').addEventListener("click", cargarProveedores);