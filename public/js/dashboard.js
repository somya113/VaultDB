let currentPage = 1;

let totalPages = 1;

const pageSize = 20;


function formatTimestamp(isoString) {

  if (!isoString) return '—';

  const date = new Date(isoString);

  if (isNaN(date.getTime())) return isoString;

  return date.toISOString().replace('T', ' ').substring(0, 19);
}


function getActionBadge(action) {

  const normalized = String(action || 'SELECT').toUpperCase();

  switch (normalized) {

    case 'INSERT':
      return `<span class="badge badge-action-insert">INSERT</span>`;

    case 'UPDATE':
      return `<span class="badge badge-action-update">UPDATE</span>`;

    case 'DELETE':
      return `<span class="badge badge-action-delete">DELETE</span>`;

    case 'SELECT':
    default:
      return `<span class="badge badge-action-select">SELECT</span>`;
  }
}


function getSeverityBadge(tableName, isSensitive) {

  if (isSensitive) {
    return `<span class="badge badge-high">HIGH</span>`;
  }

  const tableRiskMap = {
    customers: 'HIGH',
    transactions: 'HIGH',
    users: 'HIGH',
    accounts: 'MEDIUM',
    loans: 'MEDIUM',
  };

  const level = tableRiskMap[String(tableName || '').toLowerCase()] || 'LOW';

  if (level === 'HIGH') return `<span class="badge badge-high">HIGH</span>`;
  if (level === 'MEDIUM') return `<span class="badge badge-medium">MEDIUM</span>`;
  return `<span class="badge badge-low">LOW</span>`;
}


function getRoleBadge(role) {

  const normalized = String(role || 'reader').toLowerCase();

  if (normalized === 'admin') return `<span class="badge badge-admin">ADMIN</span>`;
  if (normalized === 'writer') return `<span class="badge badge-writer">WRITER</span>`;
  return `<span class="badge badge-reader">READER</span>`;
}


function truncateText(value, maxLength = 36) {

  let text = '';
  if (typeof value === 'object' && value !== null) {

    text = value.query || JSON.stringify(value);
  } else {

    text = String(value || '');
  }

  text = text.replace(/[\r\n]+/g, ' ');

  if (text.length <= maxLength) {
    return `<span class="text-truncate" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
  }

  const truncated = text.substring(0, maxLength) + '...';

  return `<span class="text-truncate" title="${escapeHtml(text)}">${escapeHtml(truncated)}</span>`;
}


function escapeHtml(string) {

  if (!string) return '';

  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadUserInfo() {
  const user = getCurrentUser();
  if (!user) {
    logout();
    return;
  }
  const emailElem = document.getElementById('userEmail');
  const roleBadgeElem = document.getElementById('userRoleBadge');
  if (emailElem) emailElem.textContent = user.email || 'authenticated user';
  if (roleBadgeElem) {
    const role = (user.role || 'reader').toLowerCase();
    roleBadgeElem.textContent = role.toUpperCase();
    roleBadgeElem.className = `badge badge-${role}`;
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/audit/stats`, {
      method: 'GET',
      headers: getAuthHeader(),
    });
    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }
    const stats = await response.json();
    const totalElem = document.getElementById('statTotal');
    if (totalElem) totalElem.textContent = (stats.total_logs || 0).toLocaleString();
    const sensitiveElem = document.getElementById('statSensitive');
    if (sensitiveElem) sensitiveElem.textContent = (stats.sensitive_count || 0).toLocaleString();
    const usersElem = document.getElementById('statUsers');
    if (usersElem) usersElem.textContent = (stats.unique_users || 0).toLocaleString();
    const todayElem = document.getElementById('statToday');
    if (todayElem) todayElem.textContent = (stats.logs_today || 0).toLocaleString();
  } catch (error) {
    console.error('Failed to load audit statistics:', error);
  }
}

async function loadLogs(filters = {}, page = 1) {
  const tbody = document.getElementById('auditTableBody');
  const recordCountElem = document.getElementById('recordCount');
  const pageInfoElem = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 3rem;">
          <div class="spinner spinner-lg"></div>
          <p style="margin-top: 1rem; color: var(--text-secondary);">Querying ImmuDB ledger records...</p>
        </td>
      </tr>
    `;
  }

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(pageSize));
  if (filters.user_email) params.set('user_email', filters.user_email);
  if (filters.table_accessed) params.set('table_accessed', filters.table_accessed);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.is_sensitive !== undefined && filters.is_sensitive !== '') {
    params.set('is_sensitive', String(filters.is_sensitive));
  }

  try {
    const response = await fetch(`${API_BASE}/audit/logs?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }

    const data = await response.json();
    const logs = data.logs || [];
    const total = data.total || 0;

    currentPage = page;
    totalPages = Math.max(Math.ceil(total / pageSize), 1);

    renderTable(logs, (page - 1) * pageSize);

    if (recordCountElem) {
      if (total === 0) {
        recordCountElem.innerHTML = `<span>📋</span><span>No matching audit records found</span>`;
      } else {
        const startRecord = (page - 1) * pageSize + 1;
        const endRecord = Math.min(page * pageSize, total);
        recordCountElem.innerHTML = `
          <span>📋</span>
          <span>Showing <strong class="record-count-highlight">${startRecord}–${endRecord}</strong> of <strong class="record-count-highlight">${total.toLocaleString()}</strong> verified ledger records</span>
        `;
      }
    }

    if (pageInfoElem) {
      pageInfoElem.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }
  } catch (error) {
    console.error('Failed to load audit logs:', error);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--red);">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
            <strong>Failed to connect to ImmuDB audit service.</strong>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(error.message)}</p>
          </td>
        </tr>
      `;
    }
  }
}

function renderTable(logs, startIndex = 0) {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <h3 class="empty-title">No Audit Records Found</h3>
            <p class="empty-desc">No immutable ledger entries matched your configured filter criteria. Try adjusting or resetting filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  logs.forEach((log, index) => {
    const tr = document.createElement('tr');

    if (log.is_sensitive === true) {
      tr.classList.add('row-sensitive');
    }

    const sequenceNumber = log.sequence_id || (startIndex + index + 1);

    const sensitiveBadge = log.is_sensitive
      ? `<span class="badge badge-sensitive">🚨 SENSITIVE</span>`
      : `<span class="badge badge-normal">NORMAL</span>`;

    tr.innerHTML = `
      <td class="cell-index">${sequenceNumber}</td>
      <td class="cell-timestamp">${formatTimestamp(log.timestamp)}</td>
      <td><span style="font-family: monospace; font-size: 0.8rem;">${escapeHtml(log.user_email || 'system')}</span></td>
      <td>${getRoleBadge(log.user_role)}</td>
      <td>${getActionBadge(log.action)}</td>
      <td><span style="font-family: monospace; color: var(--gold);">${escapeHtml(log.table_accessed || '—')}</span></td>
      <td>${truncateText(log.query_details, 38)}</td>
      <td>${sensitiveBadge}</td>
      <td>${getSeverityBadge(log.table_accessed, log.is_sensitive)}</td>
      <td class="cell-latency">${Number(log.response_time_ms || 0).toFixed(0)} ms</td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  loadUserInfo();

  loadStats();

  loadLogs(window.currentFilters || {}, 1);

  const prevBtn = document.getElementById('prevPageBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        loadLogs(window.currentFilters || {}, currentPage - 1);
      }
    });
  }

  const nextBtn = document.getElementById('nextPageBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        loadLogs(window.currentFilters || {}, currentPage + 1);
      }
    });
  }
});
