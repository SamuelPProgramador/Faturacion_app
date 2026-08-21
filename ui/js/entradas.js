/* =====================================================================
   entradas.js
   Modulo de Entradas: busca un producto, muestra su existencia actual,
   y registra una entrada de inventario (aumenta existencia y opcionalmente
   actualiza el costo del producto).
   ===================================================================== */

let entradaProductoSeleccionado = null;

function apiEntrada() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaEntrada(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputEntradaProducto = document.getElementById("entrada-producto-buscar");
const resultadosEntradaProducto = document.getElementById("entrada-producto-resultados");

let entradaProductoDebounce = null;
inputEntradaProducto.addEventListener("input", () => {
  clearTimeout(entradaProductoDebounce);
  const texto = inputEntradaProducto.value.trim();
  if (!texto) {
    resultadosEntradaProducto.classList.remove("active");
    return;
  }
  entradaProductoDebounce = setTimeout(async () => {
    const api = apiEntrada();
    if (!api) return;
    const productos = await api.listar_productos(false, texto);
    pintarResultadosEntradaProducto(productos);
  }, 220);
});

function pintarResultadosEntradaProducto(productos) {
  resultadosEntradaProducto.innerHTML = "";
  if (!productos || productos.length === 0) {
    resultadosEntradaProducto.innerHTML = `<div class="autocomplete-empty">Sin resultados.</div>`;
    resultadosEntradaProducto.classList.add("active");
    return;
  }
  productos.forEach((p) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${p.nombre}</span>
      <span class="ac-sub">Existencia: ${p.existencia} · Costo: ${formatoMonedaEntrada(p.costo)}</span>
    `;
    item.addEventListener("click", () => seleccionarEntradaProducto(p));
    resultadosEntradaProducto.appendChild(item);
  });
  resultadosEntradaProducto.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("entrada-producto-wrapper").contains(e.target)) {
    resultadosEntradaProducto.classList.remove("active");
  }
});

function seleccionarEntradaProducto(producto) {
  entradaProductoSeleccionado = producto;

  document.getElementById("entrada-producto-chip").style.display = "flex";
  document.getElementById("entrada-producto-chip-nombre").textContent = producto.nombre;
  document.getElementById("entrada-producto-chip-existencia").textContent =
    `Existencia actual: ${producto.existencia}`;

  document.getElementById("entrada-costo").placeholder = `Costo actual: ${formatoMonedaEntrada(producto.costo)}`;

  inputEntradaProducto.value = "";
  resultadosEntradaProducto.classList.remove("active");

  actualizarResumenEntrada();
}

document.getElementById("entrada-producto-quitar").addEventListener("click", () => {
  entradaProductoSeleccionado = null;
  document.getElementById("entrada-producto-chip").style.display = "none";
  document.getElementById("entrada-costo").placeholder = "Se usa el costo actual si lo dejas vacío";
  actualizarResumenEntrada();
});

function actualizarResumenEntrada() {
  const cantidad = Number(document.getElementById("entrada-cantidad").value) || 0;

  if (!entradaProductoSeleccionado) {
    document.getElementById("entrada-resumen-existencia").textContent = "—";
    document.getElementById("entrada-resumen-entra").textContent = "—";
    document.getElementById("entrada-resumen-nueva").textContent = "—";
    return;
  }

  const actual = entradaProductoSeleccionado.existencia;
  document.getElementById("entrada-resumen-existencia").textContent = actual;
  document.getElementById("entrada-resumen-entra").textContent = "+ " + cantidad;
  document.getElementById("entrada-resumen-nueva").textContent = actual + cantidad;
}

document.getElementById("entrada-cantidad").addEventListener("input", actualizarResumenEntrada);

document.getElementById("btn-guardar-entrada").addEventListener("click", async () => {
  const api = apiEntrada();
  if (!api) return;
  const errorBox = document.getElementById("entrada-error");
  errorBox.classList.remove("active");

  if (!entradaProductoSeleccionado) {
    errorBox.textContent = "Busca y selecciona un producto primero.";
    errorBox.classList.add("active");
    return;
  }

  const cantidad = Number(document.getElementById("entrada-cantidad").value) || 0;
  const costoInput = document.getElementById("entrada-costo").value;

  const datos = {
    producto_id: entradaProductoSeleccionado.id,
    cantidad: cantidad,
    costo_unit: costoInput === "" ? null : Number(costoInput),
    proveedor: document.getElementById("entrada-proveedor").value,
    notas: document.getElementById("entrada-notas").value,
    actualizar_costo: document.getElementById("entrada-actualizar-costo").checked,
  };

  const btn = document.getElementById("btn-guardar-entrada");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const resultado = await api.crear_entrada(datos);

  btn.disabled = false;
  btn.textContent = "Registrar entrada";

  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo registrar la entrada.";
    errorBox.classList.add("active");
    return;
  }

  mostrarBannerEntrada(
    `Entrada registrada: +${cantidad} de "${entradaProductoSeleccionado.nombre}"`,
    "success"
  );
  reiniciarEntrada();
  cargarEntradasRecientes();
});

function mostrarBannerEntrada(mensaje, tipo) {
  const banner = document.getElementById("entrada-banner");
  banner.textContent = mensaje;
  banner.className = "banner active banner-" + tipo;
  setTimeout(() => banner.classList.remove("active"), 5000);
}

function reiniciarEntrada() {
  entradaProductoSeleccionado = null;
  document.getElementById("entrada-producto-chip").style.display = "none";
  document.getElementById("entrada-cantidad").value = "";
  document.getElementById("entrada-costo").value = "";
  document.getElementById("entrada-costo").placeholder = "Se usa el costo actual si lo dejas vacío";
  document.getElementById("entrada-proveedor").value = "";
  document.getElementById("entrada-notas").value = "";
  document.getElementById("entrada-actualizar-costo").checked = true;
  actualizarResumenEntrada();
}

async function cargarEntradasRecientes() {
  const api = apiEntrada();
  if (!api) return;
  const entradas = await api.listar_entradas_recientes(15);
  const tbody = document.getElementById("entradas-tbody");
  const empty = document.getElementById("entradas-empty");
  const tabla = document.getElementById("tabla-entradas");

  tbody.innerHTML = "";

  if (!entradas || entradas.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    return;
  }

  empty.style.display = "none";
  tabla.style.display = "table";

  entradas.forEach((e) => {
    const fecha = (e.fecha || "").split(" ")[0];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td class="cell-strong">${e.producto_nombre}</td>
      <td class="cell-mono">+${e.cantidad}</td>
      <td class="cell-mono">${formatoMonedaEntrada(e.costo_unit)}</td>
      <td>${e.proveedor || "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.querySelector('.nav-item[data-view="entradas"]').addEventListener("click", cargarEntradasRecientes);
window.addEventListener("pywebviewready", cargarEntradasRecientes);