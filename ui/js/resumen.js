/* =====================================================================
   resumen.js
   Modulo de Resumen de ventas (dashboard): KPIs reales, grafico de
   barras por periodo (dia/semana/mes) y ranking de productos mas
   vendidos segun el periodo elegido.
   ===================================================================== */

let resumenPeriodoActual = "dia";

function apiResumen() {
  return window.pywebview ? window.pywebview.api : null;
}

function formatoMonedaResumen(valor) {
  const num = Number(valor || 0);
  return "RD$ " + num.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function cargarKpisResumen() {
  const api = apiResumen();
  if (!api) return;

  const datos = await api.obtener_resumen_dashboard();
  document.getElementById("resumen-kpi-ventas-hoy").textContent = formatoMonedaResumen(datos.ventas_hoy);
  document.getElementById("resumen-kpi-facturas-hoy").textContent = datos.facturas_hoy;
  document.getElementById("resumen-kpi-cxc").textContent = formatoMonedaResumen(datos.cxc_pendiente);
  document.getElementById("resumen-kpi-bajo-stock").textContent = datos.bajo_stock;
}

document.querySelectorAll("#resumen-periodo-tabs .cfg-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#resumen-periodo-tabs .cfg-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    resumenPeriodoActual = tab.dataset.periodo;
    cargarGraficoYTopProductos();
  });
});

const ETIQUETAS_PERIODO = {
  dia: "Producto más vendido — hoy",
  semana: "Producto más vendido — esta semana",
  mes: "Producto más vendido — este mes",
};

async function cargarGraficoYTopProductos() {
  const api = apiResumen();
  if (!api) return;

  const [serie, topProductos] = await Promise.all([
    api.ventas_por_periodo(resumenPeriodoActual),
    api.productos_mas_vendidos_periodo(resumenPeriodoActual, 8),
  ]);

  pintarBarChart(serie);
  pintarTopProductos(topProductos);

  document.getElementById("resumen-top-productos-header").textContent = ETIQUETAS_PERIODO[resumenPeriodoActual];
}

function pintarBarChart(serie) {
  const cont = document.getElementById("resumen-bar-chart");
  cont.innerHTML = "";

  const max = Math.max(...serie.map((s) => s.total), 1);

  serie.forEach((punto) => {
    const alturaPct = Math.max((punto.total / max) * 100, punto.total > 0 ? 4 : 1.5);
    const col = document.createElement("div");
    col.className = "bar-chart-col";
    col.innerHTML = `
      <span class="bar-chart-value">${punto.total > 0 ? formatoMonedaResumen(punto.total) : ""}</span>
      <div class="bar-chart-bar ${punto.total === 0 ? "bar-chart-bar-empty" : ""}" style="height:${alturaPct}%;" title="${formatoMonedaResumen(punto.total)}"></div>
      <span class="bar-chart-label">${punto.etiqueta}</span>
    `;
    cont.appendChild(col);
  });
}

function pintarTopProductos(productos) {
  const tbody = document.getElementById("top-productos-tbody");
  const empty = document.getElementById("top-productos-empty");
  const tabla = document.getElementById("tabla-top-productos");
  tbody.innerHTML = "";

  if (!productos || productos.length === 0) {
    empty.style.display = "block";
    tabla.style.display = "none";
    return;
  }
  empty.style.display = "none";
  tabla.style.display = "table";

  productos.forEach((p, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-badge ${idx === 0 ? "rank-1" : ""}">${idx + 1}</span></td>
      <td class="cell-strong">${escapeHtmlResumen(p.nombre)}</td>
      <td class="cell-mono">${p.cantidad}</td>
      <td class="cell-mono">${formatoMonedaResumen(p.total)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtmlResumen(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : texto;
  return div.innerHTML;
}

async function cargarResumenCompleto() {
  await cargarKpisResumen();
  await cargarGraficoYTopProductos();
}

document.querySelector('.nav-item[data-view="resumen"]').addEventListener("click", cargarResumenCompleto);