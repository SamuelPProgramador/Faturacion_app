/* =====================================================================
   entradas.js
   Modulo de Entradas: busca un producto, opcionalmente elige un proveedor
   de la lista, y registra una entrada de inventario (aumenta existencia,
   opcionalmente actualiza costo, y si es a credito genera CxP).
   ===================================================================== */

let entradaProductoSeleccionado = null; // {id, nombre, existencia, costo}
let entradaProveedorSeleccionado = null; // {id, nombre}

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

const inputEntradaProv = document.getElementById("entrada-prov-buscar");
const resultadosEntradaProv = document.getElementById("entrada-prov-resultados");

let entradaProvDebounce = null;
inputEntradaProv.addEventListener("input", () => {
  clearTimeout(entradaProvDebounce);
  const texto = inputEntradaProv.value.trim();
  if (!texto) {
    resultadosEntradaProv.classList.remove("active");
    return;
  }
  entradaProvDebounce = setTimeout(async () => {
    const api = apiEntrada();
    if (!api) return;
    const proveedores = await api.listar_proveedores(false, texto);
    pintarResultadosEntradaProv(proveedores);
  }, 220);
});

function pintarResultadosEntradaProv(proveedores) {
  resultadosEntradaProv.innerHTML = "";
  if (!proveedores || proveedores.length === 0) {
    resultadosEntradaProv.innerHTML = `<div class="autocomplete-empty">Sin resultados. Puedes crearlo en el módulo de Proveedores.</div>`;
    resultadosEntradaProv.classList.add("active");
    return;
  }
  proveedores.forEach((p) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${p.nombre}</span>
      <span class="ac-sub">${p.telefono || p.codigo || ""}</span>
    `;
    item.addEventListener("click", () => seleccionarEntradaProv(p));
    resultadosEntradaProv.appendChild(item);
  });
  resultadosEntradaProv.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("entrada-prov-wrapper").contains(e.target)) {
    resultadosEntradaProv.classList.remove("active");
  }
});

function seleccionarEntradaProv(proveedor) {
  entradaProveedorSeleccionado = { id: proveedor.id, nombre: proveedor.nombre };
  document.getElementById("entrada-prov-chip").style.display = "flex";
  document.getElementById("entrada-prov-chip-nombre").textContent = proveedor.nombre;
  inputEntradaProv.value = "";
  resultadosEntradaProv.classList.remove("active");
}

document.getElementById("entrada-prov-quitar").addEventListener("click", () => {
  entradaProveedorSeleccionado = null;
  document.getElementById("entrada-prov-chip").style.display = "none";
  document.getElementById("entrada-metodo-pago").value = "Contado";
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

  const metodoPago = document.getElementById("entrada-metodo-pago").value;

  if (metodoPago === "Crédito" && !entradaProveedorSeleccionado) {
    errorBox.textContent = "Para una compra a crédito debes elegir un proveedor.";
    errorBox.classList.add("active");
    return;
  }

  const cantidad = Number(document.getElementById("entrada-cantidad").value) || 0;
  const costoInput = document.getElementById("entrada-costo").value;

  const datos = {
    producto_id: entradaProductoSeleccionado.id,
    cantidad: cantidad,
    costo_unit: costoInput === "" ? null : Number(costoInput),
    proveedor_id: entradaProveedorSeleccionado ? entradaProveedorSeleccionado.id : null,
    metodo_pago: metodoPago,
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
  entradaProveedorSeleccionado = null;
  document.getElementById("entrada-producto-chip").style.display = "none";
  document.getElementById("entrada-prov-chip").style.display = "none";
  document.getElementById("entrada-cantidad").value = "";
  document.getElementById("entrada-costo").value = "";
  document.getElementById("entrada-costo").placeholder = "Se usa el costo actual si lo dejas vacío";
  document.getElementById("entrada-metodo-pago").value = "Contado";
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
    const badgeMetodo = e.metodo_pago === "Crédito"
      ? `<span class="badge badge-warning">Crédito</span>`
      : `<span class="badge badge-success">Contado</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${fecha}</td>
      <td class="cell-strong">${e.producto_nombre}</td>
      <td class="cell-mono">+${e.cantidad}</td>
      <td class="cell-mono">${formatoMonedaEntrada(e.costo_unit)}</td>
      <td>${e.proveedor_nombre || "—"}</td>
      <td>${badgeMetodo}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.querySelector('.nav-item[data-view="entradas"]').addEventListener("click", cargarEntradasRecientes);
window.addEventListener("pywebviewready", cargarEntradasRecientes);