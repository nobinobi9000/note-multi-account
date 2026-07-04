let accounts = [];
let activeId = null;
const deleteTimers = {};

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

// ── 描画 ──────────────────────────────────
const render = () => {
  const list = document.getElementById('accountList');
  const welcome = document.getElementById('welcome');

  welcome.style.display = accounts.length === 0 ? 'flex' : 'none';

  list.innerHTML = accounts.map(acc => `
    <div class="account-item ${acc.id === activeId ? 'active' : ''}" data-id="${acc.id}">
      <div class="account-avatar">${esc(acc.name.charAt(0))}</div>
      <div class="account-name"  title="${esc(acc.name)}">${esc(acc.name)}</div>
      <button class="del-btn" data-id="${acc.id}" title="削除（2回クリックで確定）">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.account-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.del-btn')) return;
      switchTo(el.dataset.id);
    });
  });

  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleDelete(btn.dataset.id);
    });
  });
};

// ── アカウント操作 ────────────────────────
const switchTo = async id => {
  activeId = await window.api.switchAccount(id);
  render();
};

const handleDelete = async id => {
  const btn = document.querySelector(`.del-btn[data-id="${id}"]`);

  if (deleteTimers[id]) {
    clearTimeout(deleteTimers[id]);
    delete deleteTimers[id];
    const result = await window.api.deleteAccount(id);
    accounts = result.accounts;
    activeId = result.activeId;
    render();
  } else {
    if (btn) { btn.textContent = '?'; btn.classList.add('confirm'); }
    deleteTimers[id] = setTimeout(() => {
      delete deleteTimers[id];
      render();
    }, 2500);
  }
};

// ── インライン追加フォーム ────────────────
const addBtn   = document.getElementById('addBtn');
const addForm  = document.getElementById('addForm');
const nameInput = document.getElementById('nameInput');

const openForm = () => {
  addBtn.classList.add('hidden');
  addForm.classList.remove('hidden');
  nameInput.value = '';
  nameInput.focus();
};

const closeForm = () => {
  addForm.classList.add('hidden');
  addBtn.classList.remove('hidden');
};

const submitForm = async () => {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  closeForm();
  const result = await window.api.addAccount(name);
  accounts = result.accounts;
  activeId = result.activeId;
  render();
};

addBtn.addEventListener('click', openForm);
document.getElementById('cancelBtn').addEventListener('click', closeForm);
document.getElementById('okBtn').addEventListener('click', submitForm);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  submitForm();
  if (e.key === 'Escape') closeForm();
});

// ── ナビゲーション ────────────────────────
document.getElementById('backBtn').addEventListener('click',   () => window.api.navigate('back'));
document.getElementById('fwdBtn').addEventListener('click',    () => window.api.navigate('forward'));
document.getElementById('reloadBtn').addEventListener('click', () => window.api.navigate('reload'));

// ── URL コピー ────────────────────────────
document.getElementById('copyUrlBtn').addEventListener('click', async () => {
  const url = await window.api.copyURL();
  if (!url) return;
  const toast = document.getElementById('copyToast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
});

// ── 初期化 ───────────────────────────────
window.api.onInit(({ accounts: a, activeId: id }) => {
  accounts = a;
  activeId = id;
  render();
});
