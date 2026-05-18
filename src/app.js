const calculator = window.AutoServiceCalculator;

const state = {
  rows: [],
  selection: { brand: "", model: "", year: "", service: "", services: [], query: "" },
};

const el = {
  version: document.querySelector("#dataVersion"),
  brand: document.querySelector("#brandSelect"),
  model: document.querySelector("#modelSelect"),
  year: document.querySelector("#yearSelect"),
  search: document.querySelector("#serviceSearch"),
  quick: document.querySelector("#quickActions"),
  service: document.querySelector("#serviceSelect"),
  add: document.querySelector("#addServiceButton"),
  empty: document.querySelector("#emptyState"),
  result: document.querySelector("#resultState"),
  title: document.querySelector("#estimateTitle"),
  price: document.querySelector("#resultPrice"),
  duration: document.querySelector("#resultDuration"),
  items: document.querySelector("#estimateItems"),
  noteBox: document.querySelector("#commentBox"),
  note: document.querySelector("#resultComment"),
  badge: document.querySelector("#statusBadge"),
};

const quickQueries = ["масло", "колодки", "диагностика", "акб", "развал"];

function fillSelect(select, placeholder, values, selected = "") {
  select.innerHTML = "";
  select.append(new Option(placeholder, ""));
  values.forEach((value) => select.append(new Option(String(value), String(value), false, String(value) === String(selected))));
}

function show(node, visible) {
  node.classList.toggle("hidden", !visible);
}

function renderVehicle() {
  const options = calculator.buildVehicleOptions(state.rows, state.selection);
  fillSelect(el.brand, "Выберите марку", options.brands, state.selection.brand);
  fillSelect(el.model, state.selection.brand ? "Выберите модель" : "Сначала марка", options.models, state.selection.model);
  fillSelect(el.year, state.selection.model ? "Выберите год" : "Сначала модель", options.years, state.selection.year);
  el.model.disabled = !state.selection.brand;
  el.year.disabled = !state.selection.model;
}

function renderServices() {
  const services = calculator.findServices(state.rows, state.selection);
  if (state.selection.service && !services.some((row) => row.service === state.selection.service)) state.selection.service = "";
  fillSelect(el.service, state.selection.year ? "Выберите услугу" : "Выберите автомобиль", services.map((row) => row.service), state.selection.service);
  el.service.disabled = !state.selection.year || services.length === 0;
  el.add.disabled = !state.selection.service || state.selection.services.includes(state.selection.service);
}

function renderQuickActions() {
  el.quick.innerHTML = "";
  quickQueries.forEach((query) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = query;
    button.className = state.selection.query === query ? "active" : "";
    button.addEventListener("click", () => {
      state.selection.query = state.selection.query === query ? "" : query;
      state.selection.service = "";
      el.search.value = state.selection.query;
      render();
    });
    el.quick.append(button);
  });
}

function makeItem(item) {
  const row = document.createElement("div");
  row.className = `estimate-item ${item.status === "missing" ? "missing" : ""}`;
  const info = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.service;
  const meta = document.createElement("span");
  meta.textContent = item.result
    ? `${item.result.service_group || "Работа"} · ${calculator.formatDuration(item.result.duration_min)}${item.result.comment ? ` · ${item.result.comment}` : ""}`
    : "Данных по этой работе пока нет";
  info.append(title, meta);

  const controls = document.createElement("div");
  controls.className = "estimate-item-controls";
  const price = document.createElement("span");
  price.textContent = item.result ? calculator.formatPrice(item.result.price) : "уточнить";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Убрать работу";
  remove.addEventListener("click", () => {
    state.selection.services = state.selection.services.filter((service) => service !== item.service);
    render();
  });
  controls.append(price, remove);
  row.append(info, controls);
  return row;
}

function renderResult() {
  const hasServices = state.selection.services.length > 0;
  const estimate = calculator.calculateEstimate(state.rows, state.selection);
  show(el.empty, !hasServices);
  show(el.result, hasServices);
  if (!hasServices) return;

  el.title.textContent = `Выбрано работ: ${state.selection.services.length}`;
  el.price.textContent = calculator.formatPrice(estimate.totalPrice);
  el.duration.textContent = calculator.formatDuration(estimate.totalDurationMin);
  el.badge.textContent = estimate.needsCheck || estimate.missingServices.length ? "есть уточнения" : "актуально";
  el.badge.className = `status-badge ${estimate.needsCheck || estimate.missingServices.length ? "needs-check" : ""}`;
  el.items.innerHTML = "";
  estimate.items.forEach((item) => el.items.append(makeItem(item)));

  const notes = [];
  if (estimate.missingServices.length) notes.push(`Нет данных: ${estimate.missingServices.join(", ")}.`);
  if (estimate.needsCheck) notes.push('Есть работы со статусом "уточнить".');
  show(el.noteBox, notes.length > 0);
  el.note.textContent = notes.join(" ");
}

function render() {
  renderVehicle();
  renderServices();
  renderQuickActions();
  renderResult();
}

function resetVehicle(part) {
  if (part === "brand") state.selection.model = "";
  state.selection.year = "";
  state.selection.service = "";
  state.selection.services = [];
}

el.brand.addEventListener("change", (event) => {
  state.selection.brand = event.target.value;
  resetVehicle("brand");
  render();
});
el.model.addEventListener("change", (event) => {
  state.selection.model = event.target.value;
  resetVehicle("model");
  render();
});
el.year.addEventListener("change", (event) => {
  state.selection.year = event.target.value;
  state.selection.service = "";
  state.selection.services = [];
  render();
});
el.search.addEventListener("input", (event) => {
  state.selection.query = event.target.value;
  state.selection.service = "";
  render();
});
el.service.addEventListener("change", (event) => {
  state.selection.service = event.target.value;
  render();
});
el.add.addEventListener("click", () => {
  if (!state.selection.service || state.selection.services.includes(state.selection.service)) return;
  state.selection.services = [...state.selection.services, state.selection.service];
  state.selection.service = "";
  render();
});

fetch("./data/services.json")
  .then((response) => response.json())
  .then((payload) => {
    state.rows = calculator.normalizeRows(payload.services || []);
    el.version.textContent = `Данные обновлены: ${payload.version || "не указано"}`;
    render();
  })
  .catch(() => {
    el.version.textContent = "Не удалось загрузить данные";
    render();
  });
