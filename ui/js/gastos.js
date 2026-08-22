/* =====================================================================
   gastos.js
   Modulo de Gastos: tarjetas de resumen por categoria, filtros de
   fecha/categoria/busqueda, y modal de crear/editar con proveedor
   opcional (autocompletar, igual que en Entradas).
   ===================================================================== */

const modalGasto = document.getElementById("modal-gasto");
const formGasto = document.getElementById("form-gasto");
const errorGasto = document.getElementById("form-gasto-error");
const gastoTbody = document.getElementById("gastos-tbody");
const gastoEmptyState = document.getElementById("gastos-empty");

let gastoProveedorSeleccionado = null;

const CATEGORIAS_GASTO = ["Materia Prima", "Gas", "Transporte", "Electricidad/Servicios", "Otros"];

function apiGasto() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaGasto(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtmlGasto(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

async function cargarKpisGastos(fechaDesde, fechaHasta) {
  const api = apiGasto();
  if (!api) return;

  const resumen = await api.resumen_gastos_por_categoria(fechaDesde || null, fechaHasta || null);
  const cont = document.getElementById("gastos-kpi-row");
  cont.innerHTML = "";

  CATEGORIAS_GASTO.forEach((cat) => {
    const div = document.createElement("div");
    div.className = "card kpi-card";
    div.innerHTML = `
      <div class="kpi-label">${cat}</div>
      <div class="kpi-value" style="font-size:18px;">${formatoMonedaGasto(resumen.por_categoria[cat])}</div>
    `;
    cont.appendChild(div);
  });

  const totalDiv = document.createElement("div");
  totalDiv.className = "card kpi-card";
  totalDiv.innerHTML = `
    <div class="kpi-label">Total</div>
    <div class="kpi-value" style="font-size:18px; color:var(--accent);">${formatoMonedaGasto(resumen.total)}</div>
  `;
  cont.appendChild(totalDiv);
}

async function cargarGastos() {
  const api = apiGasto();
  if (!api) return;

  const busqueda = document.getElementById("gasto-buscar").value.trim();
  const categoria = document.getElementById("gasto-filtro-categoria").value;
  const desde = document.getElementById("gasto-filtro-desde").value;
  const hasta = document.getElementById("gasto-filtro-hasta").value;

  const gastos = await api.listar_gastos(desde || null, hasta || null, categoria || null, busqueda || null, 200);
  pintarTablaGastos(gastos);
  cargarKpisGastos(desde, hasta);
}

function pintarTablaGastos(gastos) {
  gastoTbody.innerHTML = "";

  if (!gastos || gastos.length === 0) {
    gastoEmptyState.style.display = "block";
    document.getElementById("tabla-gastos").style.display = "none";
    return;
  }

  gastoEmptyState.style.display = "none";
  document.getElementById("tabla-gastos").style.display = "table";

  gastos.forEach((g) => {
    const fecha = (g.fecha || "").split(" ")[0];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td><span class="badge badge-muted">${escapeHtmlGasto(g.categoria)}</span></td>
      <td class="cell-strong">${escapeHtmlGasto(g.concepto || "—")}</td>
      <td>${escapeHtmlGasto(g.proveedor_nombre || "—")}</td>
      <td>${escapeHtmlGasto(g.metodo_pago)}</td>
      <td class="cell-mono">${formatoMonedaGasto(g.monto)}</td>
      <td>
        <div class="cell-actions">
          <button class="row-action" title="Editar" data-accion="editar" data-id="${g.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="row-action danger" title="Eliminar" data-accion="eliminar" data-id="${g.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </td>
    `;
    gastoTbody.appendChild(tr);
  });
}

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function abrirModalGastoNuevo() {
  formGasto.reset();
  document.getElementById("g-id").value = "";
  document.getElementById("g-fecha").value = hoyISO();
  gastoProveedorSeleccionado = null;
  document.getElementById("gasto-prov-chip").style.display = "none";
  document.getElementById("modal-gasto-titulo").textContent = "Nuevo gasto";
  errorGasto.classList.remove("active");
  modalGasto.classList.add("active");
  document.getElementById("g-concepto").focus();
}

function abrirModalGastoEditar(gasto) {
  document.getElementById("g-id").value = gasto.id;
  document.getElementById("g-categoria").value = gasto.categoria;
  document.getElementById("g-fecha").value = (gasto.fecha || "").split(" ")[0];
  document.getElementById("g-concepto").value = gasto.concepto || "";
  document.getElementById("g-monto").value = gasto.monto;
  document.getElementById("g-metodo-pago").value = gasto.metodo_pago || "Efectivo";
  document.getElementById("g-notas").value = gasto.notas || "";

  if (gasto.proveedor_id && gasto.proveedor_nombre) {
    gastoProveedorSeleccionado = { id: gasto.proveedor_id, nombre: gasto.proveedor_nombre };
    document.getElementById("gasto-prov-chip").style.display = "flex";
    document.getElementById("gasto-prov-chip-nombre").textContent = gasto.proveedor_nombre;
  } else {
    gastoProveedorSeleccionado = null;
    document.getElementById("gasto-prov-chip").style.display = "none";
  }

  document.getElementById("modal-gasto-titulo").textContent = "Editar gasto";
  errorGasto.classList.remove("active");
  modalGasto.classList.add("active");
}

function cerrarModalGasto() {
  modalGasto.classList.remove("active");
}

document.getElementById("btn-nuevo-gasto").addEventListener("click", abrirModalGastoNuevo);
document.getElementById("btn-cancelar-gasto").addEventListener("click", cerrarModalGasto);
document.getElementById("modal-gasto-cerrar").addEventListener("click", cerrarModalGasto);
modalGasto.addEventListener("click", (e) => {
  if (e.target === modalGasto) cerrarModalGasto();
});

const inputGastoProv = document.getElementById("gasto-prov-buscar");
const resultadosGastoProv = document.getElementById("gasto-prov-resultados");

let gastoProvDebounce = null;
inputGastoProv.addEventListener("input", () => {
  clearTimeout(gastoProvDebounce);
  const texto = inputGastoProv.value.trim();
  if (!texto) {
    resultadosGastoProv.classList.remove("active");
    return;
  }
  gastoProvDebounce = setTimeout(async () => {
    const api = apiGasto();
    if (!api) return;
    const proveedores = await api.listar_proveedores(false, texto);
    pintarResultadosGastoProv(proveedores);
  }, 220);
});

function pintarResultadosGastoProv(proveedores) {
  resultadosGastoProv.innerHTML = "";
  if (!proveedores || proveedores.length === 0) {
    resultadosGastoProv.innerHTML = `<div class="autocomplete-empty">Sin resultados.</div>`;
    resultadosGastoProv.classList.add("active");
    return;
  }
  proveedores.forEach((p) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `<span class="ac-main">${p.nombre}</span><span class="ac-sub">${p.telefono || p.codigo || ""}</span>`;
    item.addEventListener("click", () => {
      gastoProveedorSeleccionado = { id: p.id, nombre: p.nombre };
      document.getElementById("gasto-prov-chip").style.display = "flex";
      document.getElementById("gasto-prov-chip-nombre").textContent = p.nombre;
      inputGastoProv.value = "";
      resultadosGastoProv.classList.remove("active");
    });
    resultadosGastoProv.appendChild(item);
  });
  resultadosGastoProv.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("gasto-prov-wrapper").contains(e.target)) {
    resultadosGastoProv.classList.remove("active");
  }
});

document.getElementById("gasto-prov-quitar").addEventListener("click", () => {
  gastoProveedorSeleccionado = null;
  document.getElementById("gasto-prov-chip").style.display = "none";
});

formGasto.addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiGasto();
  if (!api) return;

  const id = document.getElementById("g-id").value;

  const datos = {
    categoria: document.getElementById("g-categoria").value,
    fecha: document.getElementById("g-fecha").value,
    concepto: document.getElementById("g-concepto").value,
    monto: document.getElementById("g-monto").value,
    metodo_pago: document.getElementById("g-metodo-pago").value,
    proveedor_id: gastoProveedorSeleccionado ? gastoProveedorSeleccionado.id : null,
    notas: document.getElementById("g-notas").value,
  };

  if (!datos.concepto.trim()) {
    errorGasto.textContent = "Ponle un concepto al gasto.";
    errorGasto.classList.add("active");
    return;
  }
  if (!datos.monto || Number(datos.monto) <= 0) {
    errorGasto.textContent = "El monto debe ser mayor a cero.";
    errorGasto.classList.add("active");
    return;
  }

  const resultado = id
    ? await api.actualizar_gasto(Number(id), datos)
    : await api.crear_gasto(datos);

  if (!resultado.ok) {
    errorGasto.textContent = resultado.error || "No se pudo guardar el gasto.";
    errorGasto.classList.add("active");
    return;
  }

  cerrarModalGasto();
  cargarGastos();
});

gastoTbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;
  const api = apiGasto();
  if (!api) return;

  if (accion === "editar") {
    const gasto = await api.obtener_gasto(id);
    if (gasto) abrirModalGastoEditar(gasto);
  } else if (accion === "eliminar") {
    if (confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) {
      await api.eliminar_gasto(id);
      cargarGastos();
    }
  }
});

let gastoDebounceTimer = null;
document.getElementById("gasto-buscar").addEventListener("input", () => {
  clearTimeout(gastoDebounceTimer);
  gastoDebounceTimer = setTimeout(cargarGastos, 250);
});
document.getElementById("gasto-filtro-categoria").addEventListener("change", cargarGastos);
document.getElementById("gasto-filtro-desde").addEventListener("change", cargarGastos);
document.getElementById("gasto-filtro-hasta").addEventListener("change", cargarGastos);

document.querySelector('.nav-item[data-view="gastos"]').addEventListener("click", cargarGastos);