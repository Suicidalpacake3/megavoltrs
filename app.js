// ===== MegaVolt RS - Repair Management App =====
const STATUSES = ['Received','Awaiting Approval','Approved','Quotation','Report','In Repair','No Fault Found','Do Not Repair','Unrepairable','Ready for Collection','Collected','Recall','Dispose'];

// ---------- Data Layer ----------
const DB = {
  load() {
    return JSON.parse(localStorage.getItem('megavolt_db') || '{"clients":[],"jobs":[],"seq":1}');
  },
  save(d) { localStorage.setItem('megavolt_db', JSON.stringify(d)); },
  nextJobNumber() {
    const d = this.load();
    const year = new Date().getFullYear().toString().slice(-2);
    const num = String(d.seq).padStart(4,'0');
    d.seq++; this.save(d);
    return `MV${year}-${num}`;
  }
};

// ---------- State ----------
let currentView = 'dashboard';

// ---------- Utilities ----------
const $ = s => document.querySelector(s);
const esc = s => (s||'').toString().replace(/[&<>"]/g, c => ({'&':'&','<':'<','>':'>','"':'"'}[c]));
const statusClass = s => 'status status-' + s.replace(/ /g,'-');
const today = () => new Date().toISOString().slice(0,10);
const daysSince = d => Math.floor((Date.now() - new Date(d)) / 86400000);

function flash(msg) {
  const el = document.createElement('div');
  el.className = 'flash'; el.textContent = msg;
  $('#app').prepend(el);
  setTimeout(() => el.remove(), 3000);
}

function modal(html) {
  $('#modalContent').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

// ---------- Views ----------
function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  const views = { dashboard: renderDashboard, clients: renderClients, jobs: renderJobs, history: renderHistory };
  views[currentView]();
}

function renderDashboard() {
  const d = DB.load();
  const active = d.jobs.filter(j => !['Collected','Dispose'].includes(j.status));
  const ready = d.jobs.filter(j => j.status === 'Ready for Collection');
  const old = active.filter(j => daysSince(j.dateIn) > 14);
  const recent = [...d.jobs].reverse().slice(0, 10);

  let notifs = '';
  if (ready.length) notifs += `<div class="notification"><strong>${ready.length} job(s) ready for collection</strong> — remind clients to pick up.</div>`;
  if (old.length) notifs +=