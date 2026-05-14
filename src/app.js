const calculator = window.AutoServiceCalculator;

const state = {
  rows: [],
  selection: {
    brand: '',
    model: '',
    year: '',
    service: '',
    services: [],
    query: '',
  },
};

const elements = {
  dataVersion: document.querySelector('#dataVersion'),
  brandSelect: document.querySelector('#brandSelect'),
  modelSelect: document.querySelector('#modelSelect'),
  yearSelect: document.querySelector('#yearSelect'),
  serviceSearch: document.querySelector('#serviceSearch'),
  quickActions: document.querySelector('#quickActions'),
  serviceSelect: document.querySelector('#serviceSelect'),
  addServiceButton: document.querySelector('#addServiceButton'),
  emptyState: document.querySelector('#emptyState'),
  resultState: document.querySelector('#resultState'),
  estimateTitle: document.querySelector('#estimateTitle'),
  estimateItems: document.querySelector('#estimateItems'),
  resultPrice: document.querySelector('#resultPrice'),
  resultDuration: document.querySelector('#resultDuration'),
  resultComment: document.querySelector('#resultComment'),
  commentBox: document.querySelector('#commentBox'),
  statusBadge: document.querySelector('#statusBadge'),
};

const quickQueries = ['масло', 'колодки', 'диагностика', 'акб', 'развал'];

function fillSelect(select, placeholder, options, selectedValue = '') {
  select.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  select.append(placeholderOption);

  options.forEach((option) => {
    const item = document.createElement('option');
    item.value = String(option);
    item.textContent = String(option);
    item.selected = String(option) === String(selectedValue);
    select.append(item);
  });
}

function setVisible(element, visible) {
  element.classList.toggle('hidden', !visible);
}

function renderVehicleControls() {
  const options = calculator.buildVehicleOptions(state.rows, state.selection);

  fillSelect(elements.brandSelect, 'Выберите марку', options.brands, state.selection.brand);
  fillSelect(
    elements.modelSelect,
    state.selection.brand ? 'Выберите модель' : 'Сначала марка',
    options.models,
    state.selection.model,
  );
  fillSelect(
    elements.yearSelect,
    state.selection.model ? 'Выберите год' : 'Сначала модель',
    options.years,
    state.selection.year,
  );

  elements.modelSelect.disabled = !state.selection.brand;
  elements.yearSelect.disabled = !state.selection.model;
}

function renderServices() {
  const services = calculator.findServices(state.rows, state.selection);

  fillSelect(
    elements.serviceSelect,
    getServicePlaceholder(services),
    services.map((row) => row.service),
    state.selection.service,
  );

  if (state.selection.service && !services.some((row) => row.service === state.selection.service)) {
    state.selection.service = '';
  }

  elements.serviceSelect.disabled = !state.selection.year || services.length === 0;
  elements.addServiceButton.disabled =
    !state.selection.service || state.selection.services.includes(state.selection.service);
}

function getServicePlaceholder(services) {
  if (!state.selection.year) {
    return 'Выберите автомобиль';
  }
  if (services.length === 0) {
    return 'Нет услуг по запросу';
  }
  return 'Выберите услугу';
}

function renderQuickActions() {
  elements.quickActions.innerHTML = '';

  quickQueries.forEach((query) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = query;
    button.className = state.selection.query === query ? 'active' : '';
    button.addEventListener('click', () => {
      state.selection.query = state.selection.query === query ? '' : query;
      elements.serviceSearch.value = state.selection.query;
      state.selection.service = '';
      render();
    });
    elements.quickActions.append(button);
  });
}

function renderResult() {
  const hasServices = state.selection.services.length > 0;
  const estimate = calculator.calculateEstimate(state.rows, state.selection);

  setVisible(elements.emptyState, !hasServices);
  setVisible(elements.resultState, hasServices);

  if (!hasServices) {
    return;
  }

  const selectedCount = state.selection.services.length;
  elements.estimateTitle.textContent = `Выбрано работ: ${selectedCount}`;
  elements.resultPrice.textContent = calculator.formatPrice(estimate.totalPrice);
  elements.resultDuration.textContent = calculator.formatDuration(estimate.totalDurationMin);
  elements.statusBadge.textContent = estimate.needsCheck || estimate.missingServices.length ? 'есть уточнения' : 'актуально';
  elements.statusBadge.className = `status-badge ${estimate.needsCheck || estimate.missingServices.length ? 'needs-check' : ''}`;
  elements.estimateItems.innerHTML = '';

  estimate.items.forEach((item) => {
    elements.estimateItems.append(createEstimateItem(item));
  });

  const notes = [];
  if (estimate.missingServices.length) {
    notes.push(`Нет данных: ${estimate.missingServices.join(', ')}.`);
  }
  if (estimate.needsCheck) {
    notes.push('Есть работы со статусом "уточнить".');
  }

  setVisible(elements.commentBox, notes.length > 0);
  elements.resultComment.textContent = notes.join(' ');
}

function createEstimateItem(item) {
  const row = document.createElement('div');
  row.className = `estimate-item ${item.status === 'missing' ? 'missing' : ''}`;

  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.service;
  const meta = document.createElement('span');

  if (item.result) {
    const comment = item.result.comment ? ` · ${item.result.comment}` : '';
    meta.textContent = `${item.result.service_group || 'Работа'} · ${calculator.formatDuration(item.result.duration_min)}${comment}`;
  } else {
    meta.textContent = 'Данных по этой работе пока нет';
  }

  info.append(title, meta);

  const controls = document.createElement('div');
  controls.className = 'estimate-item-controls';

  const price = document.createElement('span');
  price.textContent = item.result ? calculator.formatPrice(item.result.price) : 'уточнить';
  price.className = item.result ? '' : 'missing-price';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'Убрать работу';
  remove.addEventListener('click', () => {
    state.selection.services = state.selection.services.filter((service) => service !== item.service);
    render();
  });

  controls.append(price, remove);
  row.append(info, controls);
  return row;
}

function render() {
  renderVehicleControls();
  renderServices();
  renderQuickActions();
  renderResult();
}

function bindEvents() {
  elements.brandSelect.addEventListener('change', (event) => {
    state.selection.brand = event.target.value;
    state.selection.model = '';
    state.selection.year = '';
    state.selection.service = '';
    state.selection.services = [];
    render();
  });

  elements.modelSelect.addEventListener('change', (event) => {
    state.selection.model = event.target.value;
    state.selection.year = '';
    state.selection.service = '';
    state.selection.services = [];
    render();
  });

  elements.yearSelect.addEventListener('change', (event) => {
    state.selection.year = event.target.value;
    state.selection.service = '';
    state.selection.services = [];
    render();
  });

  elements.serviceSearch.addEventListener('input', (event) => {
    state.selection.query = event.target.value;
    state.selection.service = '';
    render();
  });

  elements.serviceSelect.addEventListener('change', (event) => {
    state.selection.service = event.target.value;
    render();
  });

  elements.addServiceButton.addEventListener('click', () => {
    if (!state.selection.service || state.selection.services.includes(state.selection.service)) {
      return;
    }

    state.selection.services = [...state.selection.services, state.selection.service];
    state.selection.service = '';
    render();
  });
}

async function init() {
  bindEvents();

  try {
    const response = await fetch('./data/services.json');
    const payload = await response.json();
    state.rows = calculator.normalizeRows(payload.services || []);
    elements.dataVersion.textContent = `Данные обновлены: ${payload.version || 'не указано'}`;
  } catch (error) {
    elements.dataVersion.textContent = 'Не удалось загрузить данные';
  }

  render();
}

init();
