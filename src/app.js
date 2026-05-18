/* =============================================
   AI SDLC Sprint Board — App Logic
   ============================================= */

const STORAGE_KEY = 'ai-sdlc-tasks';

const COLUMNS = ['backlog', 'inprogress', 'review', 'done'];

const PRIORITY_LABELS = {
  low: '🟢 Low',
  medium: '🟡 Medium',
  high: '🔴 High',
};

const COL_LABELS = {
  backlog: 'Backlog',
  inprogress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

// ── State ──────────────────────────────────────
let tasks = [];
let dragSrcId = null;
let editingTaskId = null;

// ── Init ───────────────────────────────────────
function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    tasks = JSON.parse(stored);
  } else {
    tasks = defaultTasks();
    save();
  }
  render();
  bindGlobalEvents();
}

function defaultTasks() {
  return [
    { id: uid(), title: 'Define sprint goals with PM', priority: 'high',   assignee: '@alice',   status: 'done' },
    { id: uid(), title: 'Design system — dark mode tokens', priority: 'medium', assignee: '@bob', status: 'done' },
    { id: uid(), title: 'Implement drag-and-drop board', priority: 'high',  assignee: '@agent🤖', status: 'done' },
    { id: uid(), title: 'Add CI lint + HTML validation', priority: 'medium', assignee: '@agent🤖', status: 'review' },
    { id: uid(), title: 'Set up GitHub Actions deploy',  priority: 'high',  assignee: '@agent🤖', status: 'review' },
    { id: uid(), title: 'Write unit tests for board logic', priority: 'medium', assignee: '@carol', status: 'inprogress' },
    { id: uid(), title: 'Accessibility audit (WCAG AA)',  priority: 'low',   assignee: '@carol',   status: 'backlog' },
    { id: uid(), title: 'Add keyboard navigation support', priority: 'low', assignee: '',         status: 'backlog' },
  ];
}

// ── Persist ────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Search ─────────────────────────────────────
let searchQuery = '';

function renderStats() {
  const wrap = document.getElementById('stats-wrap');
  const total = tasks.length;
  const high  = tasks.filter(t => t.priority === 'high').length;
  const done  = tasks.filter(t => t.status  === 'done').length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  wrap.innerHTML = `
    <div class="stat-chip">Total <span class="stat-val">${total}</span></div>
    <div class="stat-chip">🔴 High <span class="stat-val">${high}</span></div>
    <div class="stat-chip">✅ Done <span class="stat-val">${done}</span></div>
    <div class="stat-chip">Progress <span class="stat-val">${pct}%</span></div>`;
}

// ── Render ─────────────────────────────────────
function render() {
  renderStats();
  const q = searchQuery.toLowerCase();
  COLUMNS.forEach(col => {
    const list = document.getElementById(`list-${col}`);
    const count = document.getElementById(`count-${col}`);
    const colTasks = tasks.filter(t =>
      t.status === col &&
      (!q || t.title.toLowerCase().includes(q) || (t.assignee || '').toLowerCase().includes(q))
    );
    count.textContent = colTasks.length;
    list.innerHTML = '';
    colTasks.forEach(t => list.appendChild(makeCard(t)));
  });

  document.getElementById('task-count').textContent =
    `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
}

function makeCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = task.id;
  card.draggable = true;

  // Move buttons (prev / next column)
  const colIdx = COLUMNS.indexOf(task.status);
  const prevLabel = colIdx > 0 ? `◀ ${COL_LABELS[COLUMNS[colIdx - 1]]}` : null;
  const nextLabel = colIdx < COLUMNS.length - 1 ? `${COL_LABELS[COLUMNS[colIdx + 1]]} ▶` : null;
  const moveBtns = [prevLabel, nextLabel]
    .filter(Boolean)
    .map((label, i) => {
      const dir = (label.startsWith('◀')) ? 'prev' : 'next';
      return `<button class="move-btn" data-dir="${dir}" data-id="${task.id}">${label}</button>`;
    })
    .join('');

  card.innerHTML = `
    <button class="card-delete" data-id="${task.id}" title="Delete">✕</button>
    <div class="card-title">${escHtml(task.title)}</div>
    <div class="card-meta">
      <span class="priority-tag priority-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
      ${task.assignee ? `<span class="assignee-tag">${escHtml(task.assignee)}</span>` : ''}
    </div>
    <div class="card-move-btns">${moveBtns}</div>`;

  // Drag events
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend', onDragEnd);

  // Delete
  card.querySelector('.card-delete').addEventListener('click', e => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  // Move buttons
  card.querySelectorAll('.move-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      moveTask(btn.dataset.id, btn.dataset.dir);
    });
  });

  // Click to edit
  card.addEventListener('click', () => openModal(task.status, task.id));

  return card;
}

// ── Drag & Drop ────────────────────────────────
function onDragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
}

function bindDropZones() {
  document.querySelectorAll('.card-list').forEach(list => {
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.closest('.column').classList.add('drag-over');
    });
    list.addEventListener('dragleave', e => {
      if (!list.contains(e.relatedTarget)) {
        list.closest('.column').classList.remove('drag-over');
      }
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      list.closest('.column').classList.remove('drag-over');
      const targetStatus = list.dataset.status;
      if (dragSrcId) {
        const task = tasks.find(t => t.id === dragSrcId);
        if (task && task.status !== targetStatus) {
          task.status = targetStatus;
          save();
          render();
          toast(`Moved to ${COL_LABELS[targetStatus]}`, 'success');
        }
        dragSrcId = null;
      }
    });
  });
}

// ── Task Actions ───────────────────────────────
function moveTask(id, dir) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const idx = COLUMNS.indexOf(task.status);
  const newIdx = dir === 'next' ? idx + 1 : idx - 1;
  if (newIdx < 0 || newIdx >= COLUMNS.length) return;
  task.status = COLUMNS[newIdx];
  save();
  render();
  toast(`Moved to ${COL_LABELS[task.status]}`, 'success');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
  toast('Task deleted', 'info');
}

// ── Modal ──────────────────────────────────────
function openModal(defaultCol = 'backlog', taskId = null) {
  editingTaskId = taskId;
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const input   = document.getElementById('modal-input');
  const priority = document.getElementById('modal-priority');
  const assignee = document.getElementById('modal-assignee');
  const col     = document.getElementById('modal-col');

  if (taskId) {
    const task = tasks.find(t => t.id === taskId);
    title.textContent = 'Edit Task';
    input.value = task.title;
    priority.value = task.priority;
    assignee.value = task.assignee || '';
    col.value = task.status;
  } else {
    title.textContent = 'New Task';
    input.value = '';
    priority.value = 'medium';
    assignee.value = '';
    col.value = defaultCol;
  }

  overlay.classList.remove('hidden');
  input.focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingTaskId = null;
}

function saveModal() {
  const input    = document.getElementById('modal-input').value.trim();
  const priority = document.getElementById('modal-priority').value;
  const assignee = document.getElementById('modal-assignee').value.trim();
  const col      = document.getElementById('modal-col').value;

  if (!input) {
    document.getElementById('modal-input').focus();
    return;
  }

  if (editingTaskId) {
    const task = tasks.find(t => t.id === editingTaskId);
    task.title    = input;
    task.priority = priority;
    task.assignee = assignee;
    task.status   = col;
    toast('Task updated ✓', 'success');
  } else {
    tasks.push({ id: uid(), title: input, priority, assignee, status: col });
    toast('Task created ✓', 'success');
  }

  save();
  render();
  closeModal();
}

// ── Global Events ──────────────────────────────
function bindGlobalEvents() {
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    render();
  });

  document.getElementById('add-btn').addEventListener('click', () => openModal('backlog'));
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Clear all tasks? This cannot be undone.')) {
      tasks = [];
      save();
      render();
      toast('Board cleared', 'info');
    }
  });

  document.querySelectorAll('.add-in-col').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.col));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
      saveModal();
    }
  });

  bindDropZones();
}

// ── Toast ──────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Helpers ────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
