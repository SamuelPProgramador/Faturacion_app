/* =====================================================================
   cotizaciones.js
   Modulo de Cotizaciones: arma una cotizacion igual que Facturar (cliente
   + productos + carrito), la guarda sin tocar inventario, lista las
   recientes con su estado, y permite convertir una en factura real
   con un clic (eligiendo el metodo de pago en un modal chiquito).
   ===================================================================== */

let carritoCot = [];
let clienteSeleccionadoCot = null;
let impuestoPctCot = 0;
let cotizacionEnEdicionId = null;

const ICONO_PDF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h1"/><path d="M9 12h1"/><path d="M13 12h2"/><path d="M13 15h2"/></svg>`;
const ICONO_EDITAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICONO_ELIMINAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;

function apiCot() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaCot(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtmlCot(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

async function inicializarCotizaciones() {
  const api = apiCot();
  if (!api) return;

  const [numero, info] = await Promise.all([
    api.previsualizar_numero_cotizacion(),
    api.obtener_info_empresa(),
  ]);

  document.getElementById("cotizacion-numero-preview").textContent = numero;
  impuestoPctCot = Number(info.impuesto_pct || 0);
  document.getElementById("cot-resumen-impuesto-pct").textContent = impuestoPctCot;

  cargarCotizacionesRecientes();
}

/* ------------------------- Cliente: autocomplete ------------------------- */

const inputClienteBuscarCot = document.getElementById("cot-cliente-buscar");
const resultadosClienteCot = document.getElementById("cot-cliente-resultados");

let clienteDebounceCot = null;
inputClienteBuscarCot.addEventListener("input", () => {
  clearTimeout(clienteDebounceCot);
  const texto = inputClienteBuscarCot.value.trim();
  if (!texto) {
    resultadosClienteCot.classList.remove("active");
    return;
  }
  clienteDebounceCot = setTimeout(async () => {
    const api = apiCot();
    if (!api) return;
    const clientes = await api.listar_clientes(false, texto);
    pintarResultadosClienteCot(clientes);
  }, 220);
});

function pintarResultadosClienteCot(clientes) {
  resultadosClienteCot.innerHTML = "";
  if (!clientes || clientes.length === 0) {
    resultadosClienteCot.innerHTML = `<div class="autocomplete-empty">Sin resultados. Puedes crearlo en el módulo de Clientes.</div>`;
    resultadosClienteCot.classList.add("active");
    return;
  }
  clientes.forEach((c) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${escapeHtmlCot(c.nombre)}</span>
      <span class="ac-sub">${escapeHtmlCot(c.telefono || c.codigo || "")}</span>
    `;
    item.addEventListener("click", () => seleccionarClienteCot(c));
    resultadosClienteCot.appendChild(item);
  });
  resultadosClienteCot.classList.add("active");
}

function seleccionarClienteCot(cliente) {
  clienteSeleccionadoCot = { id: cliente.id, nombre: cliente.nombre };
  document.getElementById("cot-cliente-chip-nombre").textContent = cliente.nombre;
  document.getElementById("cot-cliente-quitar").style.display = "inline-block";
  inputClienteBuscarCot.value = "";
  resultadosClienteCot.classList.remove("active");
}

document.getElementById("cot-cliente-quitar").addEventListener("click", () => {
  clienteSeleccionadoCot = null;
  document.getElementById("cot-cliente-chip-nombre").textContent = "Consumidor final";
  document.getElementById("cot-cliente-quitar").style.display = "none";
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("cot-cliente-wrapper").contains(e.target)) {
    resultadosClienteCot.classList.remove("active");
  }
});

/* ------------------------- Productos: autocomplete ------------------------- */

const inputProductoBuscarCot = document.getElementById("cot-producto-buscar");
const resultadosProductoCot = document.getElementById("cot-producto-resultados");

let productoDebounceCot = null;
inputProductoBuscarCot.addEventListener("input", () => {
  clearTimeout(productoDebounceCot);
  const texto = inputProductoBuscarCot.value.trim();
  if (!texto) {
    resultadosProductoCot.classList.remove("active");
    return;
  }
  productoDebounceCot = setTimeout(async () => {
    const api = apiCot();
    if (!api) return;
    const productos = await api.listar_productos(false, texto);
    pintarResultadosProductoCot(productos);
  }, 220);
});

function pintarResultadosProductoCot(productos) {
  resultadosProductoCot.innerHTML = "";
  if (!productos || productos.length === 0) {
    resultadosProductoCot.innerHTML = `<div class="autocomplete-empty">Sin resultados.</div>`;
    resultadosProductoCot.classList.add("active");
    return;
  }
  productos.forEach((p) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.innerHTML = `
      <span class="ac-main">${escapeHtmlCot(p.nombre)}</span>
      <span class="ac-sub">${formatoMonedaCot(p.precio_venta)} · disp. ${p.existencia}</span>
    `;
    item.addEventListener("click", () => agregarAlCarritoCot(p));
    resultadosProductoCot.appendChild(item);
  });
  resultadosProductoCot.classList.add("active");
}

document.addEventListener("click", (e) => {
  if (!document.getElementById("cot-producto-wrapper").contains(e.target)) {
    resultadosProductoCot.classList.remove("active");
  }
});

/* ------------------------- Carrito ------------------------- */

function agregarAlCarritoCot(producto) {
  const existente = carritoCot.find((l) => l.producto_id === producto.id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    carritoCot.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio_unit: producto.precio_venta,
      cantidad: 1,
      aplica_impuesto: !!producto.aplica_impuesto,
    });
  }
  inputProductoBuscarCot.value = "";
  resultadosProductoCot.classList.remove("active");
  pintarCarritoCot();
}

function pintarCarritoCot() {
  const tbody = document.getElementById("carrito-cot-tbody");
  const empty = document.getElementById("carrito-cot-empty");
  const tabla = document.getElementById("tabla-carrito-cot");

  tbody.innerHTML = "";

  if (carritoCot.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    calcularTotalesCot();
    return;
  }

  empty.style.display = "none";
  tabla.style.display = "table";

  carritoCot.forEach((linea, idx) => {
    const totalLinea = linea.precio_unit * linea.cantidad;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="cell-strong">${escapeHtmlCot(linea.nombre)}</td>
      <td><input type="number" class="price-input" min="0" step="0.01" value="${linea.precio_unit}" data-idx="${idx}" data-campo="precio" /></td>
      <td><input type="number" class="qty-input" min="1" step="1" value="${linea.cantidad}" data-idx="${idx}" data-campo="cantidad" /></td>
      <td class="cell-mono">${formatoMonedaCot(totalLinea)}</td>
      <td><button class="row-action danger" data-idx="${idx}" data-accion="quitar" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button></td>
    `;
    tbody.appendChild(tr);
  });

  calcularTotalesCot();
}

document.getElementById("carrito-cot-tbody").addEventListener("input", (e) => {
  const idx = Number(e.target.dataset.idx);
  const campo = e.target.dataset.campo;
  if (isNaN(idx)) return;

  if (campo === "precio") {
    carritoCot[idx].precio_unit = Number(e.target.value) || 0;
  } else if (campo === "cantidad") {
    carritoCot[idx].cantidad = Number(e.target.value) || 0;
  }
  const totalLinea = carritoCot[idx].precio_unit * carritoCot[idx].cantidad;
  const fila = e.target.closest("tr");
  fila.querySelector(".cell-mono").textContent = formatoMonedaCot(totalLinea);
  calcularTotalesCot();
});

document.getElementById("carrito-cot-tbody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion='quitar']");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  carritoCot.splice(idx, 1);
  pintarCarritoCot();
});

function calcularTotalesCot() {
  let subtotal = 0;
  let impuesto = 0;

  carritoCot.forEach((linea) => {
    const totalLinea = linea.precio_unit * linea.cantidad;
    subtotal += totalLinea;
    if (linea.aplica_impuesto) {
      impuesto += totalLinea * (impuestoPctCot / 100);
    }
  });

  const total = subtotal + impuesto;

  document.getElementById("cot-resumen-subtotal").textContent = formatoMonedaCot(subtotal);
  document.getElementById("cot-resumen-impuesto").textContent = formatoMonedaCot(impuesto);
  document.getElementById("cot-resumen-total").textContent = formatoMonedaCot(total);
}

/* ------------------------- Guardar cotizacion ------------------------- */

document.getElementById("btn-guardar-cotizacion").addEventListener("click", async () => {
  const api = apiCot();
  if (!api) return;
  const errorBox = document.getElementById("cot-error");
  errorBox.classList.remove("active");

  if (carritoCot.length === 0) {
    errorBox.textContent = "Agrega al menos un producto antes de guardar la cotización.";
    errorBox.classList.add("active");
    return;
  }

  const datos = {
    cliente_id: clienteSeleccionadoCot ? clienteSeleccionadoCot.id : null,
    dias_validez: Number(document.getElementById("cot-dias-validez").value) || 15,
    notas: document.getElementById("cot-notas").value,
    lineas: carritoCot.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      precio_unit: l.precio_unit,
    })),
  };

  const btn = document.getElementById("btn-guardar-cotizacion");
  const editando = !!cotizacionEnEdicionId;
  btn.disabled = true;
  btn.textContent = editando ? "Guardando cambios..." : "Guardando...";

  try {
    const resultado = editando
      ? await api.actualizar_cotizacion(cotizacionEnEdicionId, datos)
      : await api.crear_cotizacion(datos);

    if (!resultado.ok) {
      errorBox.textContent = resultado.error || "No se pudo guardar la cotización.";
      errorBox.classList.add("active");
      return;
    }

    if (editando) {
      mostrarBannerCot(`Cotización actualizada — Total ${formatoMonedaCot(resultado.total)}`, "success");
    } else {
      mostrarBannerCot(`Cotización ${resultado.numero} guardada — Total ${formatoMonedaCot(resultado.total)}`, "success");
    }
    salirModoEdicionCot();
    reiniciarCotizacion();
    inicializarCotizaciones();
  } catch (err) {
    console.error("Error guardando cotización:", err);
    errorBox.textContent = "Error: " + (err && err.message ? err.message : JSON.stringify(err));
    errorBox.classList.add("active");
  } finally {
    btn.disabled = false;
    btn.textContent = cotizacionEnEdicionId ? "Guardar cambios" : "Guardar cotización";
  }
});

function mostrarBannerCot(mensaje, tipo) {
  const banner = document.getElementById("cot-banner");
  banner.textContent = mensaje;
  banner.className = "banner active banner-" + tipo;
  setTimeout(() => {
    banner.classList.remove("active");
  }, 5000);
}

function reiniciarCotizacion() {
  carritoCot = [];
  clienteSeleccionadoCot = null;
  document.getElementById("cot-cliente-chip-nombre").textContent = "Consumidor final";
  document.getElementById("cot-cliente-quitar").style.display = "none";
  document.getElementById("cot-dias-validez").value = "15";
  document.getElementById("cot-notas").value = "";
  pintarCarritoCot();
}

function salirModoEdicionCot() {
  cotizacionEnEdicionId = null;
  document.getElementById("cot-modo-edicion").style.display = "none";
  document.getElementById("btn-guardar-cotizacion").textContent = "Guardar cotización";
}

document.getElementById("cot-cancelar-edicion").addEventListener("click", (e) => {
  e.preventDefault();
  salirModoEdicionCot();
  reiniciarCotizacion();
});

async function editarCotizacion(id) {
  const api = apiCot();
  if (!api) return;

  const cot = await api.obtener_cotizacion(id);
  if (!cot) return;

  reiniciarCotizacion();

  if (cot.cliente_id) {
    clienteSeleccionadoCot = { id: cot.cliente_id, nombre: cot.cliente_nombre };
    document.getElementById("cot-cliente-chip-nombre").textContent = cot.cliente_nombre;
    document.getElementById("cot-cliente-quitar").style.display = "inline-block";
  }

  document.getElementById("cot-notas").value = cot.notas || "";

  // Aproxima la opción de "Válida por" según los días restantes hasta el vencimiento
  const hoy = new Date();
  const venc = new Date(cot.vencimiento);
  const diasRestantes = Math.max(1, Math.round((venc - hoy) / (1000 * 60 * 60 * 24)));
  const opciones = [7, 15, 30, 60];
  const masCercana = opciones.reduce((a, b) => (Math.abs(b - diasRestantes) < Math.abs(a - diasRestantes) ? b : a));
  document.getElementById("cot-dias-validez").value = String(masCercana);

  for (const linea of cot.lineas) {
    let aplicaImpuesto = true;
    try {
      const prod = await api.obtener_producto(linea.producto_id);
      if (prod) aplicaImpuesto = !!prod.aplica_impuesto;
    } catch (e) {
      /* si el producto ya no existe, se asume que aplica impuesto */
    }
    carritoCot.push({
      producto_id: linea.producto_id,
      nombre: linea.descripcion,
      precio_unit: linea.precio_unit,
      cantidad: linea.cantidad,
      aplica_impuesto: aplicaImpuesto,
    });
  }
  pintarCarritoCot();

  cotizacionEnEdicionId = id;
  document.getElementById("cot-modo-edicion-numero").textContent = cot.numero;
  document.getElementById("cot-modo-edicion").style.display = "block";
  document.getElementById("btn-guardar-cotizacion").textContent = "Guardar cambios";

  document.getElementById("view-cotizaciones").scrollIntoView({ behavior: "smooth" });
}

function confirmarAccion(mensaje, tituloBoton) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirmar");
    document.getElementById("modal-confirmar-mensaje").textContent = mensaje;
    const btnAceptar = document.getElementById("btn-confirmar-aceptar");
    const btnCancelar = document.getElementById("btn-confirmar-cancelar");
    const btnCerrar = document.getElementById("modal-confirmar-cerrar");
    btnAceptar.textContent = tituloBoton || "Eliminar";

    modal.classList.add("active");

    function limpiar() {
      modal.classList.remove("active");
      btnAceptar.removeEventListener("click", onAceptar);
      btnCancelar.removeEventListener("click", onCancelar);
      btnCerrar.removeEventListener("click", onCancelar);
    }
    function onAceptar() {
      limpiar();
      resolve(true);
    }
    function onCancelar() {
      limpiar();
      resolve(false);
    }

    btnAceptar.addEventListener("click", onAceptar);
    btnCancelar.addEventListener("click", onCancelar);
    btnCerrar.addEventListener("click", onCancelar);
  });
}

async function eliminarCotizacion(id, numero) {
  const api = apiCot();
  if (!api) return;
  const confirmado = await confirmarAccion(`¿Eliminar la cotización ${numero}? Esta acción no se puede deshacer.`);
  if (!confirmado) return;

  const resultado = await api.eliminar_cotizacion(id);
  if (!resultado.ok) {
    mostrarBannerCot(resultado.error || "No se pudo eliminar la cotización.", "error");
    return;
  }
  if (cotizacionEnEdicionId === id) {
    salirModoEdicionCot();
    reiniciarCotizacion();
  }
  mostrarBannerCot(`Cotización ${numero} eliminada.`, "success");
  cargarCotizacionesRecientes();
}

let rutaPdfActual = null;

function inicialesEmpresa(nombre) {
  const limpio = (nombre || "").trim();
  if (!limpio) return "?";
  const partes = limpio.split(/\s+/).slice(0, 2);
  return partes.map((p) => p[0].toUpperCase()).join("");
}

function fechaLegibleCot(valor) {
  if (!valor) return "—";
  const texto = String(valor).slice(0, 10);
  const partes = texto.split("-");
  if (partes.length !== 3) return texto;
  const [y, m, d] = partes;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return texto;
  return `${d} ${meses[idx]} ${y}`;
}

function renderDocPreview(cot, info) {
  const moneda = (info && info.moneda) || "RD$";
  const fmt = (v) => `${moneda} ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const nombreEmpresa = (info && info.nombre_empresa) || "Mi Empresa";

  const filas = (cot.lineas || []).map((l) => `
    <tr>
      <td>${escapeHtmlCot(l.descripcion)}</td>
      <td>${fmt(l.precio_unit)}</td>
      <td>${Number(l.cantidad)}</td>
      <td>${fmt(l.total_linea)}</td>
    </tr>
  `).join("");

  const notasHtml = cot.notas
    ? `<div class="doc-notas"><b>Notas:</b> ${escapeHtmlCot(cot.notas)}</div>`
    : "";

  document.getElementById("pdf-cotizacion-preview").innerHTML = `
    <div class="doc-header">
      <div class="doc-logo">${escapeHtmlCot(inicialesEmpresa(nombreEmpresa))}</div>
      <div class="doc-empresa">${escapeHtmlCot(nombreEmpresa)}</div>
      <div class="doc-subtitulo">Sistema interno de facturación</div>
      <div class="doc-tipo-numero">COTIZACIÓN &nbsp;·&nbsp; ${escapeHtmlCot(cot.numero)}</div>
    </div>

    <div class="doc-meta">
      <div class="doc-meta-item"><span>Cliente</span><span>${escapeHtmlCot(cot.cliente_nombre || "Consumidor final")}</span></div>
      <div class="doc-meta-item"><span>Estado</span><span>${badgeEstadoCot(cot.estado)}</span></div>
      <div class="doc-meta-item"><span>Fecha</span><span>${fechaLegibleCot(cot.fecha)}</span></div>
      <div class="doc-meta-item"><span>Válida hasta</span><span>${fechaLegibleCot(cot.vencimiento) === "—" ? "—" : fechaLegibleCot(cot.vencimiento)}</span></div>
    </div>

    <table class="doc-table">
      <thead>
        <tr><th>Producto</th><th>Precio unit.</th><th>Cant.</th><th>Total línea</th></tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <div class="doc-totales">
      <div class="doc-totales-row"><span>Subtotal</span><span>${fmt(cot.subtotal)}</span></div>
      <div class="doc-totales-row"><span>Impuesto</span><span>${fmt(cot.impuesto)}</span></div>
      <div class="doc-totales-row total"><span>Total</span><span>${fmt(cot.total)}</span></div>
    </div>

    ${notasHtml}

    <div class="doc-footer">Generado automáticamente · ${nombreEmpresa}</div>
  `;
}

function mostrarBannerModalPdf(mensaje, tipo) {
  const banner = document.getElementById("modal-pdf-banner");
  banner.textContent = mensaje;
  banner.className = "banner active banner-" + tipo;
}

function limpiarBannerModalPdf() {
  const banner = document.getElementById("modal-pdf-banner");
  banner.className = "banner";
  banner.textContent = "";
}

async function verPdfCotizacion(id) {
  const api = apiCot();
  if (!api) return;

  const [cot, info, resultadoPdf] = await Promise.all([
    api.obtener_cotizacion(id),
    api.obtener_info_empresa(),
    api.generar_pdf_cotizacion(id),
  ]);

  if (!cot) {
    mostrarBannerCot("La cotización ya no existe.", "error");
    return;
  }
  if (!resultadoPdf.ok) {
    mostrarBannerCot(resultadoPdf.error || "No se pudo generar el PDF.", "error");
    return;
  }

  renderDocPreview(cot, info);

  rutaPdfActual = resultadoPdf.ruta;
  limpiarBannerModalPdf();
  document.getElementById("modal-pdf-titulo").textContent = `Cotización ${cot.numero}`;
  document.getElementById("modal-pdf-cotizacion").classList.add("active");
}

function cerrarModalPdf() {
  document.getElementById("modal-pdf-cotizacion").classList.remove("active");
  document.getElementById("pdf-cotizacion-preview").innerHTML = "";
  limpiarBannerModalPdf();
  rutaPdfActual = null;
}

document.getElementById("modal-pdf-cerrar").addEventListener("click", cerrarModalPdf);
document.getElementById("btn-pdf-cerrar-footer").addEventListener("click", cerrarModalPdf);

document.getElementById("btn-pdf-imprimir").addEventListener("click", async () => {
  const api = apiCot();
  if (!api || !rutaPdfActual) return;

  const resultado = await api.imprimir_pdf(rutaPdfActual);
  if (!resultado.ok) {
    mostrarBannerModalPdf(resultado.error || "No se pudo abrir el PDF.", "error");
  }
});

document.getElementById("btn-pdf-descargar").addEventListener("click", async () => {
  const api = apiCot();
  if (!api || !rutaPdfActual) return;
  const resultado = await api.guardar_pdf_como(rutaPdfActual);
  if (resultado.cancelado) return;
  if (!resultado.ok) {
    mostrarBannerModalPdf(resultado.error || "No se pudo guardar el PDF.", "error");
    return;
  }
  mostrarBannerModalPdf("PDF guardado correctamente.", "success");
});

/* ------------------------- Lista de cotizaciones recientes ------------------------- */

function badgeEstadoCot(estado) {
  if (estado === "Aprobada") return `<span class="badge badge-success">Aprobada</span>`;
  if (estado === "Rechazada") return `<span class="badge badge-danger">Rechazada</span>`;
  if (estado === "Convertida") return `<span class="badge badge-muted">Convertida</span>`;
  return `<span class="badge badge-warning">Pendiente</span>`;
}

async function cargarCotizacionesRecientes() {
  const api = apiCot();
  if (!api) return;
  const cotizaciones = await api.listar_cotizaciones_recientes(20);
  const tbody = document.getElementById("cotizaciones-tbody");
  const tabla = document.getElementById("tabla-cotizaciones");
  const empty = document.getElementById("cotizaciones-empty");

  tbody.innerHTML = "";

  if (!cotizaciones || cotizaciones.length === 0) {
    tabla.style.display = "none";
    empty.style.display = "block";
    return;
  }

  tabla.style.display = "table";
  empty.style.display = "none";

  cotizaciones.forEach((c) => {
    const tr = document.createElement("tr");

    let acciones = "";
    if (c.estado === "Pendiente") {
      acciones += `
        <button class="row-action success" data-accion="aprobar" data-id="${c.id}" title="Aprobar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
        <button class="row-action danger" data-accion="rechazar" data-id="${c.id}" title="Rechazar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
    }
    if (c.estado === "Pendiente" || c.estado === "Aprobada") {
      acciones += `
        <button class="row-action" data-accion="convertir" data-id="${c.id}" data-numero="${escapeHtmlCot(c.numero)}" title="Convertir en factura">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </button>
      `;
    }

    acciones += `
      <button class="row-action" data-accion="pdf" data-id="${c.id}" title="Ver PDF">${ICONO_PDF}</button>
    `;

    acciones += `
      <button class="row-action" data-accion="editar" data-id="${c.id}" title="Editar">${ICONO_EDITAR}</button>
      <button class="row-action danger" data-accion="eliminar" data-id="${c.id}" data-numero="${escapeHtmlCot(c.numero)}" title="Eliminar">${ICONO_ELIMINAR}</button>
    `;

    tr.innerHTML = `
      <td class="cell-mono">${c.numero}</td>
      <td>${escapeHtmlCot(c.cliente_nombre)}</td>
      <td>${c.vencimiento || "—"}</td>
      <td>${badgeEstadoCot(c.estado)}</td>
      <td class="cell-mono">${formatoMonedaCot(c.total)}</td>
      <td><div class="cell-actions">${acciones}</div></td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("cotizaciones-tbody").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  const api = apiCot();
  if (!api) return;
  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;

  if (accion === "aprobar") {
    await api.cambiar_estado_cotizacion(id, "Aprobada");
    cargarCotizacionesRecientes();
  } else if (accion === "rechazar") {
    await api.cambiar_estado_cotizacion(id, "Rechazada");
    cargarCotizacionesRecientes();
  } else if (accion === "convertir") {
    abrirModalConvertir(id, btn.dataset.numero);
  } else if (accion === "pdf") {
    verPdfCotizacion(id);
  } else if (accion === "editar") {
    editarCotizacion(id);
  } else if (accion === "eliminar") {
    eliminarCotizacion(id, btn.dataset.numero);
  }
});

/* ------------------------- Modal: convertir en factura ------------------------- */

const modalConvertirCot = document.getElementById("modal-convertir-cot");
const errorConvertirCot = document.getElementById("convertir-cot-error");

function abrirModalConvertir(id, numero) {
  document.getElementById("convertir-cot-id").value = id;
  document.getElementById("convertir-cot-numero").textContent = numero;
  document.getElementById("convertir-cot-metodo-pago").value = "Efectivo";
  errorConvertirCot.classList.remove("active");
  modalConvertirCot.classList.add("active");
}

function cerrarModalConvertir() {
  modalConvertirCot.classList.remove("active");
}

document.getElementById("modal-convertir-cot-cerrar").addEventListener("click", cerrarModalConvertir);
document.getElementById("btn-cancelar-convertir-cot").addEventListener("click", cerrarModalConvertir);

document.getElementById("btn-confirmar-convertir-cot").addEventListener("click", async () => {
  const api = apiCot();
  if (!api) return;

  const id = Number(document.getElementById("convertir-cot-id").value);
  const metodoPago = document.getElementById("convertir-cot-metodo-pago").value;

  const btn = document.getElementById("btn-confirmar-convertir-cot");
  btn.disabled = true;
  btn.textContent = "Convirtiendo...";

  try {
    const resultado = await api.convertir_cotizacion_a_factura(id, metodoPago);

    if (!resultado.ok) {
      errorConvertirCot.textContent = resultado.error || "No se pudo convertir la cotización.";
      errorConvertirCot.classList.add("active");
      return;
    }

    cerrarModalConvertir();
    mostrarBannerCot(`Factura ${resultado.numero} creada desde la cotización — Total ${formatoMonedaCot(resultado.total)}`, "success");
    cargarCotizacionesRecientes();
  } catch (err) {
    console.error("Error convirtiendo cotización:", err);
    errorConvertirCot.textContent = "Error: " + (err && err.message ? err.message : JSON.stringify(err));
    errorConvertirCot.classList.add("active");
  } finally {
    btn.disabled = false;
    btn.textContent = "Convertir en factura";
  }
});

document.querySelector('.nav-item[data-view="cotizaciones"]').addEventListener("click", inicializarCotizaciones);
window.addEventListener("pywebviewready", inicializarCotizaciones);