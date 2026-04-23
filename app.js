const qs = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);
let publicSettings = { salonName: 'Agenda do Salão', salonSubtitle: 'Agendamento online para clientes', hours: [], workingDays: [1,2,3,4,5,6], bookingLimitDays: 15 };
let services = [];
let adminBookings = [];
let adminServices = [];
const today = new Date();

function showMessage(message) { alert(message); }
function money(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function dateOnly(d) { return d.toISOString().slice(0,10); }

function applyDateLimits() {
  const min = dateOnly(today);
  const maxObj = new Date(today);
  maxObj.setDate(maxObj.getDate() + Number(publicSettings.bookingLimitDays || 15));
  qs('#clienteData').min = min;
  qs('#clienteData').max = dateOnly(maxObj);
  if (!qs('#clienteData').value) qs('#clienteData').value = min;
}

function setBrand() {
  qs('#brandTitle').textContent = publicSettings.salonName;
  qs('#brandSubtitle').textContent = publicSettings.salonSubtitle;
}

function renderPublicServices() {
  const publicEl = qs('#publicServices');
  if (!services.length) {
    publicEl.innerHTML = '<div class="empty">Nenhum serviço cadastrado.</div>';
    qs('#clienteServico').innerHTML = '<option value="">Sem serviços</option>';
    return;
  }
  publicEl.innerHTML = services.map(item => `
    <div class="list-item">
      <div class="list-top"><strong>${item.name}</strong><span>${money(item.price)}</span></div>
      <div class="label">Duração: ${item.duration} min</div>
    </div>
  `).join('');
  qs('#clienteServico').innerHTML = '<option value="">Selecione</option>' + services.map(item => `<option value="${item.id}">${item.name} - ${money(item.price)}</option>`).join('');
}

async function loadPublicData() {
  const res = await fetch('/api/public-data');
  const data = await res.json();
  publicSettings = data.settings;
  services = data.services;
  setBrand();
  applyDateLimits();
  renderPublicServices();
  await loadAvailability();
}

async function loadAvailability() {
  const date = qs('#clienteData').value;
  if (!date) return;
  const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
  const data = await res.json();
  if (data.blocked) {
    qs('#clienteHora').innerHTML = '<option value="">Data indisponível</option>';
    return;
  }
  qs('#clienteHora').innerHTML = '<option value="">Selecione</option>' + data.availableHours.map(hour => `<option value="${hour}">${hour}</option>`).join('');
}

qs('#clienteData').addEventListener('change', loadAvailability);

qs('#bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    clientName: qs('#clienteNome').value.trim(),
    phone: qs('#clienteTelefone').value.trim(),
    serviceId: qs('#clienteServico').value,
    bookingDate: qs('#clienteData').value,
    bookingTime: qs('#clienteHora').value,
    notes: qs('#clienteObs').value.trim()
  };
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || 'Erro ao enviar agendamento.');
  e.target.reset();
  applyDateLimits();
  await loadAvailability();
  showMessage('Agendamento enviado com sucesso.');
});

qsa('.nav-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    qsa('.nav-btn').forEach(b => b.classList.remove('active'));
    qsa('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    qs(`#view-${btn.dataset.view}`).classList.add('active');
    if (btn.dataset.view === 'admin') await refreshAdminState();
  });
});

async function refreshAdminState() {
  const res = await fetch('/api/admin/me');
  const data = await res.json();
  qs('#loginArea').classList.toggle('hidden', data.authenticated);
  qs('#adminArea').classList.toggle('hidden', !data.authenticated);
  if (data.authenticated) {
    await loadAdminAll();
  }
}

qs('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: qs('#loginUser').value.trim(), password: qs('#loginPassword').value.trim() })
  });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || 'Erro ao entrar.');
  await refreshAdminState();
});

qs('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  await refreshAdminState();
});

async function loadAdminAll() {
  const [bookingsRes, servicesRes, settingsRes] = await Promise.all([
    fetch('/api/admin/bookings'),
    fetch('/api/admin/services'),
    fetch('/api/admin/settings')
  ]);
  adminBookings = await bookingsRes.json();
  adminServices = await servicesRes.json();
  const settings = await settingsRes.json();
  fillAdminSettings(settings);
  renderAdminBookings();
  renderAdminServices();
  renderAdminStats();
}

function fillAdminSettings(settings) {
  qs('#salonName').value = settings.salonName;
  qs('#salonSubtitle').value = settings.salonSubtitle;
  qs('#bookingLimitDays').value = settings.bookingLimitDays;
  qs('#hoursInput').value = settings.hours.join(',');
  qsa('.weekday-check').forEach(check => {
    check.checked = settings.workingDays.includes(Number(check.value));
  });
}

function renderAdminStats() {
  const todayStr = dateOnly(today);
  const countToday = adminBookings.filter(b => b.booking_date === todayStr).length;
  const revenue = adminBookings
    .filter(b => b.booking_date === todayStr && b.status === 'Confirmado')
    .reduce((sum, item) => sum + Number(item.price || 0), 0);
  qs('#statHoje').textContent = countToday;
  qs('#statClientes').textContent = new Set(adminBookings.map(b => b.phone)).size;
  qs('#statServicos').textContent = adminServices.length;
  qs('#statFaturamento').textContent = money(revenue);
}

function renderAdminServices() {
  const el = qs('#adminServices');
  if (!adminServices.length) return el.innerHTML = '<div class="empty">Nenhum serviço cadastrado.</div>';
  el.innerHTML = adminServices.map(item => `
    <div class="list-item">
      <div class="list-top"><strong>${item.name}</strong><span>${money(item.price)}</span></div>
      <div class="label">Duração: ${item.duration} min</div>
      <div class="item-actions"><button class="danger" data-delete-service="${item.id}">Excluir</button></div>
    </div>
  `).join('');
  el.querySelectorAll('[data-delete-service]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja excluir este serviço?')) return;
      await fetch(`/api/admin/services/${btn.dataset.deleteService}`, { method: 'DELETE' });
      await loadAdminAll();
      await loadPublicData();
    });
  });
}

function renderAdminBookings() {
  const el = qs('#adminBookings');
  if (!adminBookings.length) return el.innerHTML = '<div class="empty">Nenhum agendamento recebido.</div>';
  el.innerHTML = adminBookings.map(item => `
    <div class="list-item">
      <div class="list-top">
        <strong>${item.client_name}</strong>
        <span class="badge ${item.status.toLowerCase()}">${item.status}</span>
      </div>
      <div class="label">${item.service_name} • ${money(item.price)}</div>
      <div class="label">${item.booking_date} às ${String(item.booking_time).slice(0,5)}</div>
      <div class="label">${item.phone}</div>
      ${item.notes ? `<div class="label">Obs: ${item.notes}</div>` : ''}
      <div class="item-actions">
        <button class="secondary" data-status="Confirmado" data-id="${item.id}">Confirmar</button>
        <button class="secondary" data-status="Cancelado" data-id="${item.id}">Cancelar</button>
        <button class="danger" data-delete-booking="${item.id}">Excluir</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/admin/bookings/${btn.dataset.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: btn.dataset.status })
      });
      await loadAdminAll();
      await loadAvailability();
    });
  });

  el.querySelectorAll('[data-delete-booking]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deseja excluir este agendamento?')) return;
      await fetch(`/api/admin/bookings/${btn.dataset.deleteBooking}`, { method: 'DELETE' });
      await loadAdminAll();
      await loadAvailability();
    });
  });
}

qs('#serviceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/admin/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: qs('#serviceName').value.trim(),
      duration: qs('#serviceDuration').value,
      price: qs('#servicePrice').value
    })
  });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || 'Erro ao cadastrar serviço.');
  e.target.reset();
  await loadAdminAll();
  await loadPublicData();
});

qs('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const workingDays = [...qsa('.weekday-check:checked')].map(item => Number(item.value)).sort((a,b)=>a-b);
  if (!workingDays.length) return showMessage('Selecione pelo menos um dia de atendimento.');
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      salonName: qs('#salonName').value.trim(),
      salonSubtitle: qs('#salonSubtitle').value.trim(),
      bookingLimitDays: qs('#bookingLimitDays').value,
      hours: qs('#hoursInput').value.split(',').map(v=>v.trim()).filter(Boolean),
      workingDays
    })
  });
  const data = await res.json();
  if (!res.ok) return showMessage(data.error || 'Erro ao salvar configurações.');
  await loadPublicData();
  await loadAdminAll();
  showMessage('Configurações salvas.');
});

loadPublicData();
refreshAdminState();
