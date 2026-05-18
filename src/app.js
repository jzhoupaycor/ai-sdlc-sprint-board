/* =============================================
   AI SDLC Sprint Board — App Logic
   ============================================= */

const STORAGE_KEY = 'ai-sdlc-tasks';
const SPRINT_KEY = 'ai-sdlc-sprint';
const SPRINT_HISTORY_KEY = 'ai-sdlc-sprint-history';

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

// ── Sprint State ────────────────────────────────
let sprint = null;          // { name, startTs, endTs }
let sprintHistory = [];     // last 6 completed sprints
let timerRafId = null;
let lastTimerTick = 0;
let barRects = [];          // canvas bar hit areas for click detection

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
  initSprint();
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

// ── Sprint ─────────────────────────────────────
function initSprint() {
  const stored = localStorage.getItem(SPRINT_KEY);
  sprint = stored ? JSON.parse(stored) : null;
  const hist = localStorage.getItem(SPRINT_HISTORY_KEY);
  sprintHistory = hist ? JSON.parse(hist) : [];
  renderSprintTimer();
  if (sprint && Date.now() < sprint.endTs) startTimerLoop();
  else if (sprint) renderSprintTimer(); // show expired state
}

function openSprintModal() {
  document.getElementById('sprint-modal-overlay').classList.remove('hidden');
  const nameInput = document.getElementById('sprint-name-input');
  nameInput.value = '';
  nameInput.focus();
}

function closeSprintModal() {
  document.getElementById('sprint-modal-overlay').classList.add('hidden');
}

function confirmStartSprint() {
  const nameInput = document.getElementById('sprint-name-input');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  const weeks = parseInt(document.getElementById('sprint-duration').value, 10);
  const now = Date.now();
  sprint = { name, startTs: now, endTs: now + weeks * 7 * 24 * 60 * 60 * 1000 };
  localStorage.setItem(SPRINT_KEY, JSON.stringify(sprint));
  closeSprintModal();
  renderSprintTimer();
  startTimerLoop();
  toast(`Sprint "${name}" started! 🚀`, 'success');
}

function endSprint() {
  if (!sprint) return;
  const doneTasks = tasks.filter(t => t.status === 'done');
  if (!confirm(`End sprint "${sprint.name}"?\n${doneTasks.length} Done task${doneTasks.length !== 1 ? 's' : ''} will be archived and the Done column cleared.`)) return;

  const record = {
    name: sprint.name,
    startDate: new Date(sprint.startTs).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    completed: doneTasks.map(t => t.title),
  };
  sprintHistory.push(record);
  if (sprintHistory.length > 6) sprintHistory = sprintHistory.slice(-6);
  localStorage.setItem(SPRINT_HISTORY_KEY, JSON.stringify(sprintHistory));

  tasks = tasks.filter(t => t.status !== 'done');
  save();
  render();

  const sprintName = sprint.name;
  sprint = null;
  localStorage.removeItem(SPRINT_KEY);
  if (timerRafId) { cancelAnimationFrame(timerRafId); timerRafId = null; }
  renderSprintTimer();
  toast(`"${sprintName}" ended — ${doneTasks.length} task${doneTasks.length !== 1 ? 's' : ''} archived 🎉`, 'success');
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Expired';
  const totalSecs = Math.floor(ms / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function renderSprintTimer() {
  const wrap = document.getElementById('sprint-timer-wrap');
  const startBtn = document.getElementById('start-sprint-btn');
  if (!wrap || !startBtn) return;

  if (!sprint) {
    wrap.classList.add('hidden');
    startBtn.classList.remove('hidden');
    return;
  }

  const now = Date.now();
  const remaining = Math.max(0, sprint.endTs - now);
  const total = sprint.endTs - sprint.startTs;
  const pct = Math.min(100, Math.round(((now - sprint.startTs) / total) * 100));
  const expired = remaining === 0;

  startBtn.classList.add('hidden');
  wrap.classList.remove('hidden');
  wrap.innerHTML = `
    <span class="sprint-label">${escHtml(sprint.name)}</span>
    <span class="sprint-countdown${expired ? ' expired' : ''}">⏱ ${formatCountdown(remaining)}</span>
    <div class="sprint-progress-wrap" title="${pct}% elapsed">
      <div class="sprint-progress-fill" style="width:${pct}%"></div>
    </div>
    <button class="end-sprint-btn" id="end-sprint-btn">End Sprint</button>`;
}

function startTimerLoop() {
  if (timerRafId) cancelAnimationFrame(timerRafId);
  lastTimerTick = 0;
  function tick(ts) {
    if (ts - lastTimerTick >= 1000) {
      lastTimerTick = ts;
      renderSprintTimer();
    }
    if (sprint && Date.now() < sprint.endTs) {
      timerRafId = requestAnimationFrame(tick);
    } else {
      timerRafId = null;
      renderSprintTimer();
    }
  }
  timerRafId = requestAnimationFrame(tick);
}

// ── Velocity Chart ──────────────────────────────
function openVelocityModal() {
  document.getElementById('velocity-modal-overlay').classList.remove('hidden');
  document.getElementById('velocity-detail').innerHTML = '';
  requestAnimationFrame(drawVelocityChart);
}

function closeVelocityModal() {
  document.getElementById('velocity-modal-overlay').classList.add('hidden');
}

function drawBarPath(ctx, x, y, w, h, r) {
  const cr = Math.min(r, h > 0 ? h : 0, w / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + cr);
  ctx.quadraticCurveTo(x, y, x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawVelocityChart() {
  const canvas = document.getElementById('velocity-canvas');
  if (!canvas) return;
  barRects = [];

  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = 280;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const history = sprintHistory.slice(-6);

  if (history.length === 0) {
    ctx.fillStyle = '#8b949e';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No sprint history yet. Complete a sprint to see velocity!', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...history.map(s => s.completed.length), 1);
  const pad = { top: 36, bottom: 58, left: 44, right: 16 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const gridLines = 4;

  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (chartH / gridLines) * i;
    const val = Math.round(maxVal * (1 - i / gridLines));
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, pad.left - 6, y);
  }

  const slotW = chartW / history.length;
  const barW = slotW * 0.6;
  const barOffset = slotW * 0.2;

  history.forEach((s, i) => {
    const barH = s.completed.length === 0 ? 0 : Math.max(2, (s.completed.length / maxVal) * chartH);
    const x = pad.left + slotW * i + barOffset;
    const y = pad.top + chartH - barH;

    barRects.push({ x, y: pad.top, w: barW, h: chartH, sprint: s });

    if (barH > 0) {
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, '#bc8cff');
      grad.addColorStop(1, '#58a6ff');
      ctx.fillStyle = grad;
      drawBarPath(ctx, x, y, barW, barH, 4);
      ctx.fill();
    }

    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(s.completed.length, x + barW / 2, y - 4);

    const maxChars = Math.max(4, Math.floor(barW / 6.5));
    const label = s.name.length > maxChars ? s.name.slice(0, maxChars - 1) + '…' : s.name;
    ctx.fillStyle = '#8b949e';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + barW / 2, H - pad.bottom + 8);

    ctx.fillStyle = '#6e7681';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(s.endDate, x + barW / 2, H - pad.bottom + 22);
  });
}

function showSprintDetail(s) {
  const detail = document.getElementById('velocity-detail');
  const taskList = s.completed.length
    ? `<ul class="sprint-task-list">${s.completed.map(t => `<li>${escHtml(t)}</li>`).join('')}</ul>`
    : '<p class="no-tasks-msg">No tasks were completed in this sprint.</p>';
  detail.innerHTML = `
    <div class="sprint-detail">
      <div class="sprint-detail-header">
        <strong>${escHtml(s.name)}</strong>
        <span class="sprint-detail-dates">${s.startDate} → ${s.endDate}</span>
        <span class="sprint-detail-count">${s.completed.length} task${s.completed.length !== 1 ? 's' : ''} completed</span>
      </div>
      ${taskList}
    </div>`;
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
    if (e.key === 'Escape') {
      closeModal();
      closeSprintModal();
      closeVelocityModal();
    }
    if (e.key === 'Enter' && !document.getElementById('modal-overlay').classList.contains('hidden')) {
      saveModal();
    }
    if (e.key === 'Enter' && !document.getElementById('sprint-modal-overlay').classList.contains('hidden')) {
      confirmStartSprint();
    }
  });

  // Sprint events (use delegation for dynamically rendered End Sprint button)
  document.getElementById('sprint-timer-wrap').addEventListener('click', e => {
    if (e.target.id === 'end-sprint-btn') endSprint();
  });
  document.getElementById('start-sprint-btn').addEventListener('click', openSprintModal);
  document.getElementById('sprint-modal-cancel').addEventListener('click', closeSprintModal);
  document.getElementById('sprint-modal-start').addEventListener('click', confirmStartSprint);
  document.getElementById('sprint-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSprintModal();
  });

  // Velocity events
  document.getElementById('velocity-btn').addEventListener('click', openVelocityModal);
  document.getElementById('velocity-close').addEventListener('click', closeVelocityModal);
  document.getElementById('velocity-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeVelocityModal();
  });
  document.getElementById('velocity-canvas').addEventListener('click', e => {
    const canvas = document.getElementById('velocity-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    for (const bar of barRects) {
      if (mouseX >= bar.x && mouseX <= bar.x + bar.w) {
        showSprintDetail(bar.sprint);
        break;
      }
    }
  });

  window.addEventListener('resize', () => {
    if (!document.getElementById('velocity-modal-overlay').classList.contains('hidden')) {
      drawVelocityChart();
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
