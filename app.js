// ===== MegaVolt RS - Repair Management App =====
const STATUSES = ['Received','Awaiting Approval','Approved','Quotation','Report','In Repair','No Fault Found','Do Not Repair','Unrepairable','Ready for Collection','Collected','Recall','Dispose'];

const DB = {
  load() { return JSON.parse(localStorage.getItem('megavolt_db') || '{"clients":[],"jobs":[],"seq":1}'); },
  save(d) { localStorage.setItem('megavolt_db', JSON.stringify(d)); },
  nextJobNumber() {
    const d = this.load();
    const year = new Date().getFullYear().toString().slice(-2);
    const num = String(d.seq).padStart(4,'0');
    d.seq++; this.save(d);
    return `MV${year}-${num}`;
  }
};

let currentView = 'dashboard';
const $ = s => document.querySelector(s);
const esc = s => (s==null?'':s.toString()).replace(/[&<>"]/g, c => ({'&':'&','<':'<','>':'>','"':'"'}[c]));
const statusClass = s => 'status status-' + (s||'').replace(/ /g,'-');
const today = () => new Date().toISOString().slice(0,10);
const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

function flash(msg) {
  const el = document.createElement('div');
  el.className = 'flash'; el.textContent = msg;
  $('#app').prepend(el);
  setTimeout(() => el.remove(), 2500);
}
function modal(html) { $('#modalContent').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }

function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  ({dashboard:renderDashboard, clients:renderClients, jobs:renderJobs, history:renderHistory}[currentView])();
}

// ---------- DASHBOARD ----------
function renderDashboard() {
  const d = DB.load();
  const active = d.jobs.filter(j => !['Collected','Dispose'].includes(j.status));
  const ready = d.jobs.filter(j => j.status === 'Ready for Collection');
  const old = active.filter(j => daysSince(j.dateIn) > 14);
  const recent = [...d.jobs].reverse().slice(0,10);

  let notifs = '';
  if (ready.length) notifs += `<div class="notification"><strong>${ready.length} job(s) ready for collection</strong> — remind clients to pick up.</div>`;
  if (old.length) notifs += `<div class="notification"><strong>${old.length} job(s) open over 14 days</strong> — may need follow-up.</div>`;

  $('#app').innerHTML = `
    <h1>Dashboard</h1>
    ${notifs}
    <div class="stats">
      <div class="stat-card"><h3>${d.clients.length}</h3><p>Total Clients</p></div>
      <div class="stat-card active"><h3>${active.length}</h3><p>Active Jobs</p></div>
      <div class="stat-card done"><h3>${ready.length}</h3><p>Ready for Pickup</p></div>
      <div class="stat-card urgent"><h3>${old.length}</h3><p>Over 14 Days</p></div>
    </div>
    <h2>Recent Jobs</h2>
    ${recent.length ? `<div class="table-wrap"><table>
      <tr><th>Job #</th><th>Client</th><th>Device</th><th>Status</th><th>Date In</th></tr>
      ${recent.map(j => {
        const c = d.clients.find(c => c.id === j.clientId) || {name:'Unknown'};
        return `<tr onclick="openJob('${j.id}')"><td><span class="link">${esc(j.jobNumber)}</span></td><td>${esc(c.name)}</td><td>${esc(j.deviceType)} ${esc(j.brand||'')}</td><td><span class="${statusClass(j.status)}">${esc(j.status)}</span></td><td>${esc(j.dateIn)}</td></tr>`;
      }).join('')}
    </table></div>` : `<div class="empty">No jobs yet. Click "+ New Job" to start.</div>`}
  `;
}

// ---------- CLIENTS ----------
function renderClients(q='') {
  const d = DB.load();
  const list = d.clients.filter(c => !q || (c.name+c.phone+c.email).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  $('#app').innerHTML = `
    <h1>Clients</h1>
    <div class="search-bar">
      <input id="clientSearch" placeholder="Search name, phone, email..." value="${esc(q)}">
      <button class="btn-primary" onclick="openClientForm()">+ Add Client</button>
    </div>
    ${list.length ? `<div class="table-wrap"><table>
      <tr><th>Name</th><th>Phone</th><th>Email</th><th>Jobs</th></tr>
      ${list.map(c => {
        const n = d.jobs.filter(j => j.clientId === c.id).length;
        return `<tr onclick="openClient('${c.id}')"><td><span class="link">${esc(c.name)}</span></td><td>${esc(c.phone||'-')}</td><td>${esc(c.email||'-')}</td><td>${n}</td></tr>`;
      }).join('')}
    </table></div>` : `<div class="empty">No clients yet.</div>`}
  `;
  $('#clientSearch').addEventListener('input', e => renderClients(e.target.value));
}

function openClientForm(clientId) {
  const d = DB.load();
  const c = clientId ? d.clients.find(x=>x.id===clientId) : {name:'',phone:'',email:'',address:'',notes:''};
  modal(`
    <h2>${clientId?'Edit':'Add'} Client</h2>
    <div class="form-grid">
      <div><label>Full Name *</label><input id="cf_name" value="${esc(c.name)}"></div>
      <div class="form-row">
        <div><label>Phone</label><input id="cf_phone" value="${esc(c.phone)}"></div>
        <div><label>Email</label><input id="cf_email" value="${esc(c.email)}"></div>
      </div>
      <div><label>Address</label><input id="cf_address" value="${esc(c.address)}"></div>
      <div><label>Notes</label><textarea id="cf_notes">${esc(c.notes)}</textarea></div>
      <div class="actions">
        <button class="btn-primary" onclick="saveClient('${clientId||''}')">Save</button>
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  `);
}

function saveClient(id) {
  const name = $('#cf_name').value.trim();
  if (!name) { alert('Name is required'); return; }
  const d = DB.load();
  const data = { name, phone:$('#cf_phone').value, email:$('#cf_email').value, address:$('#cf_address').value, notes:$('#cf_notes').value };
  if (id) { Object.assign(d.clients.find(c=>c.id===id), data); }
  else { data.id = uid(); data.createdAt = today(); d.clients.push(data); }
  DB.save(d); closeModal(); flash('Client saved'); render();
}

function openClient(id) {
  const d = DB.load();
  const c = d.clients.find(x=>x.id===id); if (!c) return;
  const jobs = d.jobs.filter(j=>j.clientId===id).reverse();
  currentView = 'clients';
  $('#app').innerHTML = `
    <p><span class="link" onclick="render()">← Back to Clients</span></p>
    <h1>${esc(c.name)}</h1>
    <div class="card-box">
      <p><strong>Phone:</strong> ${esc(c.phone||'-')}</p>
      <p><strong>Email:</strong> ${esc(c.email||'-')}</p>
      <p><strong>Address:</strong> ${esc(c.address||'-')}</p>
      <p><strong>Notes:</strong> ${esc(c.notes||'-')}</p>
      <div class="actions">
        <button class="btn-primary" onclick="openClientForm('${c.id}')">Edit</button>
        <button class="btn-primary" onclick="openJobForm(null,'${c.id}')">+ New Job for this Client</button>
        <button class="btn-danger" onclick="deleteClient('${c.id}')">Delete</button>
      </div>
    </div>
    <h2>Job History (${jobs.length})</h2>
    ${jobs.length ? `<div class="table-wrap"><table>
      <tr><th>Job #</th><th>Device</th><th>Issue</th><th>Status</th><th>Date In</th></tr>
      ${jobs.map(j=>`<tr onclick="openJob('${j.id}')"><td><span class="link">${esc(j.jobNumber)}</span></td><td>${esc(j.deviceType)} ${esc(j.brand||'')}</td><td>${esc((j.issue||'').slice(0,60))}</td><td><span class="${statusClass(j.status)}">${esc(j.status)}</span></td><td>${esc(j.dateIn)}</td></tr>`).join('')}
    </table></div>` : `<div class="empty">No jobs yet.</div>`}
  `;
}

function deleteClient(id) {
  if (!confirm('Delete this client and ALL their jobs?')) return;
  const d = DB.load();
  d.clients = d.clients.filter(c=>c.id!==id);
  d.jobs = d.jobs.filter(j=>j.clientId!==id);
  DB.save(d); flash('Client deleted'); currentView='clients'; render();
}

// ---------- JOBS ----------
function renderJobs(q='', status='') {
  const d = DB.load();
  const list = [...d.jobs].reverse().filter(j => {
    const c = d.clients.find(x=>x.id===j.clientId) || {name:''};
    const text = (j.jobNumber+' '+c.name+' '+j.deviceType+' '+j.brand+' '+j.issue).toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!status || j.status===status);
  });
  $('#app').innerHTML = `
    <h1>Jobs</h1>
    <div class="search-bar">
      <input id="jobSearch" placeholder="Search..." value="${esc(q)}">
      <select id="jobStatus"><option value="">All Statuses</option>${STATUSES.map(s=>`<option ${s===status?'selected':''}>${s}</option>`).join('')}</select>
      <button class="btn-primary" onclick="openJobForm()">+ New Job</button>
    </div>
    ${list.length ? `<div class="table-wrap"><table>
      <tr><th>Job #</th><th>
