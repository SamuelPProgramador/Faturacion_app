/* =====================================================================
   cxc.js
   Modulo de Cuentas por Cobrar + Estado de Cuenta.
   ===================================================================== */

function apiCxc() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaCxc(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hoyStrCxc() {
  return new Date().toISOString().split("T")[0];
}

// -----------------------------------------------------------------
// CxC: cargar KPIs + tabla
// -----------------------------------------------------------------

async function cargarCxc() {
  const api = apiCxc();
  if (!api) return;

  const busqueda = document.getElementById("cxc-buscar").value.trim();
  const incluirPagadas = document.getElementById("cxc-ver-pagadas").checked;

  const [resumen, lista] = await Promise.all([
    api.obtener_resumen_cxc(),
    api.listar_cxc(incluirPagadas, busqueda || null),
  ]);

  document.getElementById("cxc-kpi-total").textContent = formatoMonedaCxc(resumen.total_pendiente);
  document.getElementById("cxc-kpi-vencidas").textContent = resumen.facturas_vencidas;
  document.getElementById("cxc-kpi-monto-vencido").textContent = formatoMonedaCxc(resumen.monto_vencido);
  document.getElementById("cxc-kpi-clientes").textContent = resumen.clientes_con_deuda;

  pintarTablaCxc(lista);
}

function pintarTablaCxc(lista) {
  const tbody = document.getElementById("cxc-tbody");
  const empty = document.getElementById("cxc-empty");
  const tabla = document.getElementById("tabla-cxc");
  tbody.innerHTML = "";

  if (!lista || lista.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    return;
  }
  empty.style.display = "none";
  tabla.style.display = "table";

  const hoy = hoyStrCxc();

  lista.forEach((c) => {
    const vencida = c.estado === "Pendiente" && c.fecha_vencim && c.fecha_vencim < hoy;
    const fecha = (c.fecha || "").split(" ")[0];

    let badgeEstado;
    if (c.estado === "Pagada") {
      badgeEstado = `<span class="badge badge-success">Pagada</span>`;
    } else if (vencida) {
      badgeEstado = `<span class="badge badge-warning">Vencida</span>`;
    } else {
      badgeEstado = `<span class="badge badge-muted">Pendiente</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-strong" style="cursor:pointer;" data-accion="ver-cliente" data-id="${c.cliente_id}" data-nombre="${escapeHtmlCxc(c.cliente_nombre)}">${escapeHtmlCxc(c.cliente_nombre)}</td>
      <td class="cell-mono">${c.factura_numero || "—"}</td>
      <td class="cell-mono">${fecha}</td>
      <td class="cell-mono">${c.fecha_vencim || "—"}</td>
      <td class="cell-mono">${formatoMonedaCxc(c.monto_original)}</td>
      <td class="cell-mono">${formatoMonedaCxc(c.saldo_pendiente)}</td>
      <td>${badgeEstado}</td>
      <td>
        ${c.estado === "Pendiente"
          ? `<button class="btn btn-ghost" style="padding:6px 12px; font-size:12.5px;" data-accion="pagar" data-id="${c.id}" data-saldo="${c.saldo_pendiente}">Registrar pago</button>`
          : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtmlCxc(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

document.getElementById("tabla-cxc").addEventListener("click", (e) => {
  const btnCliente = e.target.closest("[data-accion='ver-cliente']");
  if (btnCliente) {
    irAEstadoDeCuenta(Number(btnCliente.dataset.id), btnCliente.dataset.nombre);
    return;
  }
  const btnPagar = e.target.closest("button[data-accion='pagar']");
  if (btnPagar) {
    abrirModalPagarCxc(Number(btnPagar.dataset.id), btnPagar.dataset.saldo);
  }
});

let cxcDebounce = null;
document.getElementById("cxc-buscar").addEventListener("input", () => {
  clearTimeout(cxcDebounce);
  cxcDebounce = setTimeout(cargarCxc, 250);
});
document.getElementById("cxc-ver-pagadas").addEventListener("change", cargarCxc);

document.querySelector('.nav-item[data-view="cxc"]').addEventListener("click", cargarCxc);

// -----------------------------------------------------------------
// Modal: registrar pago de CxC
// -----------------------------------------------------------------

const modalPagarCxc = document.getElementById("modal-pagar-cxc");

function abrirModalPagarCxc(cxcId, saldo) {
  document.getElementById("pagar-cxc-id").value = cxcId;
  document.getElementById("pagar-cxc-saldo").textContent = formatoMonedaCxc(saldo);
  document.getElementById("pagar-cxc-monto").value = "";
  document.getElementById("pagar-cxc-monto").max = saldo;
  document.getElementById("pagar-cxc-error").classList.remove("active");
  modalPagarCxc.classList.add("active");
}

document.getElementById("modal-pagar-cxc-cerrar").addEventListener("click", () => modalPagarCxc.classList.remove("active"));
document.getElementById("btn-cancelar-pagar-cxc").addEventListener("click", () => modalPagarCxc.classList.remove("active"));
modalPagarCxc.addEventListener("click", (e) => {
  if (e.target === modalPagarCxc) modalPagarCxc.classList.remove("active");
});

document.getElementById("btn-confirmar-pagar-cxc").addEventListener("click", async () => {
  const api = apiCxc();
  if (!api) return;

  const cxcId = Number(document.getElementById("pagar-cxc-id").value);
  const monto = Number(document.getElementById("pagar-cxc-monto").value);
  const metodo = document.getElementById("pagar-cxc-metodo").value;
  const errorBox = document.getElementById("pagar-cxc-error");
  errorBox.classList.remove("active");

  if (!monto || monto <= 0) {
    errorBox.textContent = "Ingresa un monto válido.";
    errorBox.classList.add("active");
    return;
  }

  const resultado = await api.registrar_pago_cxc(cxcId, monto, metodo);
  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo registrar el pago.";
    errorBox.classList.add("active");
    return;
  }

  modalPagarCxc.classList.remove("active");
  cargarCxc();
});

// -----------------------------------------------------------------
// Estado de Cuenta: buscador de cliente
// -----------------------------------------------------------------

let edcClienteSeleccionado = null;

const inputEdcCliente = document.getElementById("edc-cliente-buscar");
const resultadosEdcCliente = document.getElementById("edc-cliente-resultados");

let edcDebounce = null;
inputEdcCliente.addEventListener("input", () => {
  clearTimeout(edcDebounce);
  const texto = inputEdcCliente.value.trim();
  if (!texto) {
    resultadosEdcCliente.classList.remove("active");
    return;
  }
  edcDebounce = setTimeout(async () => {
    const api = apiCxc();
    if (!api) return;
    const clientes = await api.listar_clientes(false, texto);
    pintarResultadosEdcCliente(clientes);
  }, 220);
});

function pintarResultadosEdcCliente(clientes) {
  resultadosEdcCliente.innerHTML = "";
  if (!clientes || clientes.length === 0) {
    resultadosEdcCliente.innerHTML = `<div class="autocomplete-empty">Sin resultados.</div>`;
    resultadosEdcCliente.classList.add("active");
    return;
  }
  clientes.forEach((c) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `<span class="ac-main">${c.nombre}</span><span class="ac-sub">${c.telefono || c.codigo || ""}</span>`;
    item.addEventListener("click", () => {
      edcClienteSeleccionado = { id: c.id, nombre: c.nombre };
      mostrarChipEdcCliente();
      inputEdcCliente.value = "";
      resultadosEdcCliente.classList.remove("active");
      cargarEstadoDeCuenta();
    });
    resultadosEdcCliente.appendChild(item);
  });
  resultadosEdcCliente.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("edc-cliente-wrapper").contains(e.target)) {
    resultadosEdcCliente.classList.remove("active");
  }
});

function mostrarChipEdcCliente() {
  document.getElementById("edc-cliente-chip").style.display = "flex";
  document.getElementById("edc-cliente-chip-nombre").textContent = edcClienteSeleccionado.nombre;
}

document.getElementById("edc-cliente-quitar").addEventListener("click", () => {
  edcClienteSeleccionado = null;
  document.getElementById("edc-cliente-chip").style.display = "none";
  document.getElementById("edc-contenido").style.display = "none";
  document.getElementById("edc-vacio").style.display = "block";
});

// Se llama desde la tabla de CxC al hacer clic en el nombre de un cliente
function irAEstadoDeCuenta(clienteId, nombre) {
  edcClienteSeleccionado = { id: clienteId, nombre: nombre };
  goToView("estadocuenta");
  mostrarChipEdcCliente();
  cargarEstadoDeCuenta();
}

async function cargarEstadoDeCuenta() {
  const api = apiCxc();
  if (!api || !edcClienteSeleccionado) return;

  const estado = await api.obtener_estado_cuenta(edcClienteSeleccionado.id);

  document.getElementById("edc-vacio").style.display = "none";
  document.getElementById("edc-contenido").style.display = "block";

  document.getElementById("edc-total-facturado").textContent = formatoMonedaCxc(estado.total_facturado);
  document.getElementById("edc-total-pagado").textContent = formatoMonedaCxc(estado.total_pagado);
  document.getElementById("edc-saldo-actual").textContent = formatoMonedaCxc(estado.saldo_actual);

  const tbody = document.getElementById("edc-tbody");
  tbody.innerHTML = "";

  if (!estado.movimientos || estado.movimientos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:24px;">Este cliente no tiene movimientos a crédito todavía.</td></tr>`;
    return;
  }

  estado.movimientos.forEach((m) => {
    const fecha = (m.fecha || "").split(" ")[0];
    const badgeTipo = m.tipo === "cargo"
      ? `<span class="badge badge-warning">Cargo</span>`
      : `<span class="badge badge-success">Abono</span>`;
    const signo = m.tipo === "cargo" ? "+" : "−";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td>${escapeHtmlCxc(m.descripcion)}</td>
      <td>${badgeTipo}</td>
      <td class="cell-mono">${signo} ${formatoMonedaCxc(m.monto)}</td>
      <td class="cell-mono cell-strong">${formatoMonedaCxc(m.saldo)}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.querySelector('.nav-item[data-view="estadocuenta"]').addEventListener("click", () => {
  if (edcClienteSeleccionado) cargarEstadoDeCuenta();
});