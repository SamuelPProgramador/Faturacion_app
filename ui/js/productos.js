/* =====================================================================
   productos.js
   Modulo de Productos: tabla, busqueda, modal de crear/editar y
   activar/desactivar. Habla con Python via window.pywebview.api
   ===================================================================== */

const modalProducto = document.getElementById("modal-producto");
const formProducto = document.getElementById("form-producto");
const errorProducto = document.getElementById("form-producto-error");
const tbody = document.getElementById("prod-tbody");
const emptyState = document.getElementById("prod-empty");
const inputBuscar = document.getElementById("prod-buscar");
const checkVerInactivos = document.getElementById("prod-ver-inactivos");

let cacheProductos = [];

// -----------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------

function formatoMoneda(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function apiLista() {
  return window.pywebview ? window.pywebview.api : null;
}

// -----------------------------------------------------------------
// Cargar y pintar la tabla
// -----------------------------------------------------------------

async function cargarProductos() {
  const api = apiLista();
  if (!api) return;

  const busqueda = inputBuscar.value.trim();
  const incluirInactivos = checkVerInactivos.checked;

  cacheProductos = await api.listar_productos(incluirInactivos, busqueda || null);
  pintarTabla(cacheProductos);
}

function pintarTabla(productos) {
  tbody.innerHTML = "";

  if (!productos || productos.length === 0) {
    emptyState.style.display = "block";
    document.getElementById("tabla-productos").style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  document.getElementById("tabla-productos").style.display = "table";

  productos.forEach((p) => {
    const bajoStock = p.existencia <= p.stock_minimo;
    const tr = document.createElement("tr");
    if (!p.activo) tr.classList.add("inactivo");

    tr.innerHTML = `
      <td class="cell-mono">${p.codigo || "—"}</td>
      <td>
        <div class="cell-strong">${escapeHtml(p.nombre)}</div>
        ${p.descripcion ? `<div class="cell-sub">${escapeHtml(p.descripcion)}</div>` : ""}
      </td>
      <td>${escapeHtml(p.categoria || "—")}</td>
      <td>${escapeHtml(p.unidad_venta || "Unidad")}</td>
      <td class="cell-mono">${formatoMoneda(p.precio_venta)}</td>
      <td class="cell-mono">
        ${p.existencia}
        ${bajoStock ? `<span class="badge badge-warning" style="margin-left:6px;">Bajo stock</span>` : ""}
      </td>
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
    tbody.appendChild(tr);
  });
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

// -----------------------------------------------------------------
// Modal: abrir / cerrar
// -----------------------------------------------------------------

function abrirModalNuevo() {
  formProducto.reset();
  document.getElementById("f-id").value = "";
  document.getElementById("modal-producto-titulo").textContent = "Nuevo producto";
  errorProducto.classList.remove("active");
  modalProducto.classList.add("active");
  document.getElementById("f-categoria").focus();
}

function abrirModalEditar(producto) {
  document.getElementById("f-id").value = producto.id;
  document.getElementById("f-categoria").value = producto.categoria || "Otros";
  document.getElementById("f-codigo").value = producto.codigo || "";
  document.getElementById("f-nombre").value = producto.nombre || "";
  document.getElementById("f-descripcion").value = producto.descripcion || "";
  document.getElementById("f-unidad").value = producto.unidad_venta || "Unidad";
  document.getElementById("f-impuesto").value = producto.aplica_impuesto ? "1" : "0";
  document.getElementById("f-precio").value = producto.precio_venta;
  document.getElementById("f-costo").value = producto.costo;
  document.getElementById("f-existencia").value = producto.existencia;
  document.getElementById("f-stock-minimo").value = producto.stock_minimo;

  document.getElementById("modal-producto-titulo").textContent = "Editar producto";
  errorProducto.classList.remove("active");
  modalProducto.classList.add("active");
}

function cerrarModal() {
  modalProducto.classList.remove("active");
}

document.getElementById("btn-nuevo-producto").addEventListener("click", abrirModalNuevo);
document.getElementById("btn-cancelar-producto").addEventListener("click", cerrarModal);
document.getElementById("modal-producto-cerrar").addEventListener("click", cerrarModal);
modalProducto.addEventListener("click", (e) => {
  if (e.target === modalProducto) cerrarModal();
});

// --- generar codigo segun categoria elegida ---
document.getElementById("btn-generar-codigo").addEventListener("click", async () => {
  const api = apiLista();
  if (!api) return;
  const categoria = document.getElementById("f-categoria").value;
  const codigo = await api.generar_codigo_producto(categoria);
  document.getElementById("f-codigo").value = codigo;
});

// -----------------------------------------------------------------
// Guardar (crear o actualizar)
// -----------------------------------------------------------------

formProducto.addEventListener("submit", async (e) => {
  e.preventDefault();
  const api = apiLista();
  if (!api) return;

  const id = document.getElementById("f-id").value;

  const datos = {
    categoria: document.getElementById("f-categoria").value,
    codigo: document.getElementById("f-codigo").value,
    nombre: document.getElementById("f-nombre").value,
    descripcion: document.getElementById("f-descripcion").value,
    unidad_venta: document.getElementById("f-unidad").value,
    aplica_impuesto: document.getElementById("f-impuesto").value === "1",
    precio_venta: document.getElementById("f-precio").value,
    costo: document.getElementById("f-costo").value,
    existencia: document.getElementById("f-existencia").value,
    stock_minimo: document.getElementById("f-stock-minimo").value,
  };

  if (!datos.nombre.trim()) {
    mostrarError("Ponle un nombre al producto.");
    return;
  }
  if (!datos.precio_venta || Number(datos.precio_venta) < 0) {
    mostrarError("El precio de venta es obligatorio.");
    return;
  }

  const resultado = id
    ? await api.actualizar_producto(Number(id), datos)
    : await api.crear_producto(datos);

  if (!resultado.ok) {
    mostrarError(resultado.error || "No se pudo guardar el producto.");
    return;
  }

  cerrarModal();
  cargarProductos();
});

function mostrarError(mensaje) {
  errorProducto.textContent = mensaje;
  errorProducto.classList.add("active");
}

// -----------------------------------------------------------------
// Acciones de fila: editar / activar / desactivar
// -----------------------------------------------------------------

tbody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;
  const api = apiLista();
  if (!api) return;

  if (accion === "editar") {
    const producto = await api.obtener_producto(id);
    if (producto) abrirModalEditar(producto);
  } else if (accion === "desactivar") {
    await api.cambiar_estado_producto(id, false);
    cargarProductos();
  } else if (accion === "activar") {
    await api.cambiar_estado_producto(id, true);
    cargarProductos();
  }
});

// -----------------------------------------------------------------
// Busqueda y filtro
// -----------------------------------------------------------------

let debounceTimer = null;
inputBuscar.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cargarProductos, 250);
});
checkVerInactivos.addEventListener("change", cargarProductos);

// -----------------------------------------------------------------
// Cargar la tabla la primera vez que la API este lista, y cada vez
// que el usuario entra a la vista de Productos
// -----------------------------------------------------------------

window.addEventListener("pywebviewready", cargarProductos);

document.querySelector('.nav-item[data-view="productos"]').addEventListener("click", cargarProductos);
