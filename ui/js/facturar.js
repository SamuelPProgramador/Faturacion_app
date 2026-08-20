/* =====================================================================
   facturar.js
   Modulo de Facturar: busca cliente y productos, arma el carrito,
   calcula subtotal/impuesto/total en vivo, y guarda la factura.
   ===================================================================== */

let carrito = [];
let clienteSeleccionado = null;
let impuestoPct = 0;

function apiFact() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaFact(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function inicializarFacturar() {
  const api = apiFact();
  if (!api) return;

  const [numero, info] = await Promise.all([
    api.previsualizar_numero_factura(),
    api.obtener_info_empresa(),
  ]);

  document.getElementById("factura-numero-preview").textContent = numero;
  impuestoPct = Number(info.impuesto_pct || 0);
  document.getElementById("resumen-impuesto-pct").textContent = impuestoPct;

  cargarVentasRecientes();
}

const inputClienteBuscar = document.getElementById("fact-cliente-buscar");
const resultadosCliente = document.getElementById("fact-cliente-resultados");

let clienteDebounce = null;
inputClienteBuscar.addEventListener("input", () => {
  clearTimeout(clienteDebounce);
  const texto = inputClienteBuscar.value.trim();
  if (!texto) {
    resultadosCliente.classList.remove("active");
    return;
  }
  clienteDebounce = setTimeout(async () => {
    const api = apiFact();
    if (!api) return;
    const clientes = await api.listar_clientes(false, texto);
    pintarResultadosCliente(clientes);
  }, 220);
});

function pintarResultadosCliente(clientes) {
  resultadosCliente.innerHTML = "";
  if (!clientes || clientes.length === 0) {
    resultadosCliente.innerHTML = `<div class="autocomplete-empty">Sin resultados. Puedes crearlo en el módulo de Clientes.</div>`;
    resultadosCliente.classList.add("active");
    return;
  }
  clientes.forEach((c) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${c.nombre}</span>
      <span class="ac-sub">${c.telefono || c.codigo || ""}</span>
    `;
    item.addEventListener("click", () => seleccionarCliente(c));
    resultadosCliente.appendChild(item);
  });
  resultadosCliente.classList.add("active");
}

function seleccionarCliente(cliente) {
  clienteSeleccionado = { id: cliente.id, nombre: cliente.nombre };
  document.getElementById("fact-cliente-chip-nombre").textContent = cliente.nombre;
  document.getElementById("fact-cliente-quitar").style.display = "inline-block";
  inputClienteBuscar.value = "";
  resultadosCliente.classList.remove("active");
}

document.getElementById("fact-cliente-quitar").addEventListener("click", () => {
  clienteSeleccionado = null;
  document.getElementById("fact-cliente-chip-nombre").textContent = "Consumidor final";
  document.getElementById("fact-cliente-quitar").style.display = "none";
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("fact-cliente-wrapper").contains(e.target)) {
    resultadosCliente.classList.remove("active");
  }
});

const inputProductoBuscar = document.getElementById("fact-producto-buscar");
const resultadosProducto = document.getElementById("fact-producto-resultados");

let productoDebounce = null;
inputProductoBuscar.addEventListener("input", () => {
  clearTimeout(productoDebounce);
  const texto = inputProductoBuscar.value.trim();
  if (!texto) {
    resultadosProducto.classList.remove("active");
    return;
  }
  productoDebounce = setTimeout(async () => {
    const api = apiFact();
    if (!api) return;
    const productos = await api.listar_productos(false, texto);
    pintarResultadosProducto(productos);
  }, 220);
});

function pintarResultadosProducto(productos) {
  resultadosProducto.innerHTML = "";
  if (!productos || productos.length === 0) {
    resultadosProducto.innerHTML = `<div class="autocomplete-empty">Sin resultados.</div>`;
    resultadosProducto.classList.add("active");
    return;
  }
  productos.forEach((p) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${p.nombre}</span>
      <span class="ac-sub">${formatoMonedaFact(p.precio_venta)} · disp. ${p.existencia}</span>
    `;
    item.addEventListener("click", () => agregarAlCarrito(p));
    resultadosProducto.appendChild(item);
  });
  resultadosProducto.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("fact-producto-wrapper").contains(e.target)) {
    resultadosProducto.classList.remove("active");
  }
});

function agregarAlCarrito(producto) {
  const existente = carrito.find((l) => l.producto_id === producto.id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio_unit: producto.precio_venta,
      cantidad: 1,
      aplica_impuesto: !!producto.aplica_impuesto,
      existencia: producto.existencia,
    });
  }
  inputProductoBuscar.value = "";
  resultadosProducto.classList.remove("active");
  pintarCarrito();
}

function pintarCarrito() {
  const tbody = document.getElementById("carrito-tbody");
  const empty = document.getElementById("carrito-empty");
  const tabla = document.getElementById("tabla-carrito");

  tbody.innerHTML = "";

  if (carrito.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    calcularTotales();
    return;
  }

  empty.style.display = "none";
  tabla.style.display = "table";

  carrito.forEach((linea, idx) => {
    const totalLinea = linea.precio_unit * linea.cantidad;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-strong">${linea.nombre}</td>
      <td><input type="number" class="price-input" min="0" step="0.01" value="${linea.precio_unit}" data-idx="${idx}" data-campo="precio" /></td>
      <td><input type="number" class="qty-input" min="1" step="1" value="${linea.cantidad}" data-idx="${idx}" data-campo="cantidad" /></td>
      <td class="cell-mono">${formatoMonedaFact(totalLinea)}</td>
      <td><button class="row-action danger" data-idx="${idx}" data-accion="quitar" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button></td>
    `;
    tbody.appendChild(tr);
  });

  calcularTotales();
}

document.getElementById("carrito-tbody").addEventListener("input", (e) => {
  const idx = Number(e.target.dataset.idx);
  const campo = e.target.dataset.campo;
  if (isNaN(idx)) return;

  if (campo === "precio") {
    carrito[idx].precio_unit = Number(e.target.value) || 0;
  } else if (campo === "cantidad") {
    carrito[idx].cantidad = Number(e.target.value) || 0;
  }
  const totalLinea = carrito[idx].precio_unit * carrito[idx].cantidad;
  const fila = e.target.closest("tr");
  fila.querySelector(".cell-mono").textContent = formatoMonedaFact(totalLinea);
  calcularTotales();
});

document.getElementById("carrito-tbody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion='quitar']");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  carrito.splice(idx, 1);
  pintarCarrito();
});

function calcularTotales() {
  let subtotal = 0;
  let impuesto = 0;

  carrito.forEach((linea) => {
    const totalLinea = linea.precio_unit * linea.cantidad;
    subtotal += totalLinea;
    if (linea.aplica_impuesto) {
      impuesto += totalLinea * (impuestoPct / 100);
    }
  });

  const total = subtotal + impuesto;

  document.getElementById("resumen-subtotal").textContent = formatoMonedaFact(subtotal);
  document.getElementById("resumen-impuesto").textContent = formatoMonedaFact(impuesto);
  document.getElementById("resumen-total").textContent = formatoMonedaFact(total);
}

document.getElementById("btn-cobrar").addEventListener("click", async () => {
  const api = apiFact();
  if (!api) return;
  const errorBox = document.getElementById("fact-error");
  errorBox.classList.remove("active");

  if (carrito.length === 0) {
    errorBox.textContent = "Agrega al menos un producto antes de guardar la factura.";
    errorBox.classList.add("active");
    return;
  }

  const metodoPago = document.getElementById("fact-metodo-pago").value;

  const datos = {
    cliente_id: clienteSeleccionado ? clienteSeleccionado.id : null,
    metodo_pago: metodoPago,
    notas: document.getElementById("fact-notas").value,
    lineas: carrito.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      precio_unit: l.precio_unit,
    })),
  };

  const btn = document.getElementById("btn-cobrar");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const resultado = await api.crear_factura(datos);

  btn.disabled = false;
  btn.textContent = "Guardar factura";

  if (!resultado.ok) {
    errorBox.textContent = resultado.error || "No se pudo guardar la factura.";
    errorBox.classList.add("active");
    return;
  }

  mostrarBanner(`Factura ${resultado.numero} guardada — Total ${formatoMonedaFact(resultado.total)}`, "success");
  reiniciarFactura();
  inicializarFacturar();
});

function mostrarBanner(mensaje, tipo) {
  const banner = document.getElementById("fact-banner");
  banner.textContent = mensaje;
  banner.className = "banner active banner-" + tipo;
  setTimeout(() => {
    banner.classList.remove("active");
  }, 5000);
}

function reiniciarFactura() {
  carrito = [];
  clienteSeleccionado = null;
  document.getElementById("fact-cliente-chip-nombre").textContent = "Consumidor final";
  document.getElementById("fact-cliente-quitar").style.display = "none";
  document.getElementById("fact-metodo-pago").value = "Efectivo";
  document.getElementById("fact-notas").value = "";
  pintarCarrito();
}

async function cargarVentasRecientes() {
  const api = apiFact();
  if (!api) return;
  const ventas = await api.listar_facturas_recientes(10);
  const tbody = document.getElementById("recientes-tbody");
  tbody.innerHTML = "";

  if (!ventas || ventas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-faint); padding:24px;">Todavía no hay ventas registradas.</td></tr>`;
    return;
  }

  ventas.forEach((v) => {
    const badgeEstado = v.estado === "Pagada"
      ? `<span class="badge badge-success">Pagada</span>`
      : `<span class="badge badge-warning">Pendiente</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-mono">${v.numero}</td>
      <td>${v.cliente_nombre}</td>
      <td>${v.metodo_pago}</td>
      <td>${badgeEstado}</td>
      <td class="cell-mono">${formatoMonedaFact(v.total)}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.querySelector('.nav-item[data-view="facturar"]').addEventListener("click", inicializarFacturar);
window.addEventListener("pywebviewready", inicializarFacturar);