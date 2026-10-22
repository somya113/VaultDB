// ==========================================================================
// VAULTDB AUDIT PORTAL DASHBOARD CONTROLLER - REAL-TIME LEDGER & METRICS
// ==========================================================================

// Global state holding the active pagination page index
let currentPage = 1;
// Global state holding the current maximum available page count
let totalPages = 1;
// Global state defining rows displayed per page view
const pageSize = 20;

// Format an ISO timestamp string into a readable UTC date-time string
function formatTimestamp(isoString) {
  // Return placeholder if timestamp is undefined or empty
  if (!isoString) return '—';
  // Parse date from ISO string
  const date = new Date(isoString);
  // Return fallback if date is invalid
  if (isNaN(date.getTime())) return isoString;
  // Format as YYYY-MM-DD HH:mm:ss in UTC standard
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// Generate styled badge HTML for database SQL operations
function getActionBadge(action) {
  // Normalize SQL action to uppercase string
  const normalized = String(action || 'SELECT').toUpperCase();
  // Map SQL action to designated CSS badge class
  switch (normalized) {
    // Green badge for INSERT operations
    case 'INSERT':
      return `<span class="badge badge-action-insert">INSERT</span>`;
    // Orange badge for UPDATE operations
    case 'UPDATE':
      return `<span class="badge badge-action-update">UPDATE</span>`;
    // Red badge for destructive DELETE operations
    case 'DELETE':
      return `<span class="badge badge-action-delete">DELETE</span>`;
    // Blue badge for read SELECT operations
    case 'SELECT':
    default:
      return `<span class="badge badge-action-select">SELECT</span>`;
  }
}

// Calculate and generate styled badge HTML for event risk severity level
function getSeverityBadge(tableName, isSensitive) {
  // Elevated to HIGH if payload contains sensitive data fields
  if (isSensitive) {
    return `<span class="badge badge-high">HIGH</span>`;
  }
  // Table baseline classification lookup table
  const tableRiskMap = {
    customers: 'HIGH',
    transactions: 'HIGH',
    users: 'HIGH',
    accounts: 'MEDIUM',
    loans: 'MEDIUM',
  };
  // Determine severity based on table category or default to LOW
  const level = tableRiskMap[String(tableName || '').toLowerCase()] || 'LOW';
  // Return corresponding styled badge element
  if (level === 'HIGH') return `<span class="badge badge-high">HIGH</span>`;
  if (level === 'MEDIUM') return `<span class="badge badge-medium">MEDIUM</span>`;
  return `<span class="badge badge-low">LOW</span>`;
}

// Generate styled badge HTML for user role classifications
function getRoleBadge(role) {
  // Normalize user role to lowercase
  const normalized = String(role || 'reader').toLowerCase();
  // Return appropriate badge variant for user role
  if (normalized === 'admin') return `<span class="badge badge-admin">ADMIN</span>`;
  if (normalized === 'writer') return `<span class="badge badge-writer">WRITER</span>`;
  return `<span class="badge badge-reader">READER</span>`;
}

// Truncate long query text strings with ellipsis and tooltip title
function truncateText(value, maxLength = 36) {
  // Serialize query object to string if JSON details provided
  let text = '';
  if (typeof value === 'object' && value !== null) {
    // If query property is explicitly present, use it
    text = value.query || JSON.stringify(value);
  } else {
    // Cast value directly to string
    text = String(value || '');
  }
  // Remove line breaks for uniform table cell height
  text = text.replace(/[\r\n]+/g, ' ');
  // If string length is within limit, return escaped string
  if (text.length <= maxLength) {
    return `<span class="text-truncate" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
  }
  // Truncate text and append ellipsis
  const truncated = text.substring(0, maxLength) + '...';
  // Return truncated span with full query visible in tooltip
  return `<span class="text-truncate" title="${escapeHtml(text)}">${escapeHtml(truncated)}</span>`;
}

// Escape dangerous HTML entities to prevent Cross-Site Scripting (XSS)
function escapeHtml(string) {
  // Return empty string for null or undefined input
  if (!string) return '';
  // Map special characters to HTML safe entity strings
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Populate authenticated user details and role badge in sticky navigation header
function loadUserInfo() {
  // Retrieve current user profile object
  const user = getCurrentUser();
  // Fallback to anonymous state if user is unauthenticated
  if (!user) {
    // Redirect to login if user object missing
    logout();
    return;
  }
  // Find email display label in header
  const emailElem = document.getElementById('userEmail');
  // Find role badge container in header
  const roleBadgeElem = document.getElementById('userRoleBadge');
  // Set user email text
  if (emailElem) emailElem.textContent = user.email || 'authenticated user';
  // Style and render role badge with corresponding color class
  if (roleBadgeElem) {
    const role = (user.role || 'reader').toLowerCase();
    roleBadgeElem.textContent = role.toUpperCase();
    roleBadgeElem.className = `badge badge-${role}`;
  }
  // Bind logout button click handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }
}

// Fetch aggregate audit statistics from backend and update metric cards
async function loadStats() {
  try {
    // Fetch stats endpoint using authorized Bearer header
    const response = await fetch(`${API_BASE}/audit/stats`, {
      method: 'GET',
      headers: getAuthHeader(),
    });
    // If unauthorized, redirect to login view
    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }
    // Parse stats JSON response
    const stats = await response.json();
    // Update Total Queries statistic card
    const totalElem = document.getElementById('statTotal');
    if (totalElem) totalElem.textContent = (stats.total_logs || 0).toLocaleString();
    // Update Sensitive Queries statistic card
    const sensitiveElem = document.getElementById('statSensitive');
    if (sensitiveElem) sensitiveElem.textContent = (stats.sensitive_count || 0).toLocaleString();
    // Update Unique Users statistic card
    const usersElem = document.getElementById('statUsers');
    if (usersElem) usersElem.textContent = (stats.unique_users || 0).toLocaleString();
    // Update Queries Today statistic card
    const todayElem = document.getElementById('statToday');
    if (todayElem) todayElem.textContent = (stats.logs_today || 0).toLocaleString();
  } catch (error) {
    // Log metric fetch errors for debugging
    console.error('Failed to load audit statistics:', error);
  }
}

// Query audit ledger from backend with filters and render matching table rows
async function loadLogs(filters = {}, page = 1) {
  // Cache table body and pagination DOM nodes
  const tbody = document.getElementById('auditTableBody');
  const recordCountElem = document.getElementById('recordCount');
  const pageInfoElem = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  // Display animated loading spinner row inside table body
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

  // Construct URLSearchParams query string from filter object
  const params = new URLSearchParams();
  // Include target page index
  params.set('page', String(page));
  // Include configured page size limit
  params.set('limit', String(pageSize));
  // Forward user email filter if defined
  if (filters.user_email) params.set('user_email', filters.user_email);
  // Forward accessed table filter if defined
  if (filters.table_accessed) params.set('table_accessed', filters.table_accessed);
  // Forward start date range filter if defined
  if (filters.date_from) params.set('date_from', filters.date_from);
  // Forward end date range filter if defined
  if (filters.date_to) params.set('date_to', filters.date_to);
  // Forward sensitivity filter if defined
  if (filters.is_sensitive !== undefined && filters.is_sensitive !== '') {
    params.set('is_sensitive', String(filters.is_sensitive));
  }

  try {
    // Execute GET request to ledger logs endpoint
    const response = await fetch(`${API_BASE}/audit/logs?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    // Handle token expiration or unauthenticated state
    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }

    // Parse JSON response data
    const data = await response.json();
    const logs = data.logs || [];
    const total = data.total || 0;

    // Update global pagination state tracking
    currentPage = page;
    totalPages = Math.max(Math.ceil(total / pageSize), 1);

    // Render table rows into tbody
    renderTable(logs, (page - 1) * pageSize);

    // Update record count status indicator
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

    // Update pagination page display label
    if (pageInfoElem) {
      pageInfoElem.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    // Toggle Previous page button disabled state
    if (prevBtn) {
      prevBtn.disabled = currentPage <= 1;
    }

    // Toggle Next page button disabled state
    if (nextBtn) {
      nextBtn.disabled = currentPage >= totalPages;
    }
  } catch (error) {
    // Log query execution error
    console.error('Failed to load audit logs:', error);
    // Display error notification row in table body
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

// Render generated table row elements for array of audit log entries
function renderTable(logs, startIndex = 0) {
  // Cache table body DOM reference
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;

  // Clear existing table content
  tbody.innerHTML = '';

  // Handle empty search result state
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

  // Iterate over each log record and build table row
  logs.forEach((log, index) => {
    // Create new tr table row element
    const tr = document.createElement('tr');

    // CRITICAL REQUIREMENT: Apply .row-sensitive class if log entry is flagged sensitive
    if (log.is_sensitive === true) {
      tr.classList.add('row-sensitive');
    }

    // Calculate row sequence index
    const sequenceNumber = log.sequence_id || (startIndex + index + 1);

    // Format sensitive column badge
    const sensitiveBadge = log.is_sensitive
      ? `<span class="badge badge-sensitive">🚨 SENSITIVE</span>`
      : `<span class="badge badge-normal">NORMAL</span>`;

    // Construct row HTML with all 10 required columns
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

    // Append constructed row to table body
    tbody.appendChild(tr);
  });
}

// Bind pagination button controls and initial dashboard lifecycle
document.addEventListener('DOMContentLoaded', () => {
  // Enforce authentication gate check
  if (!checkAuth()) return;

  // Initialize navigation user details and role badge
  loadUserInfo();

  // Load aggregate metrics for the 4 stat cards
  loadStats();

  // Load first page of audit logs with default filters
  loadLogs(window.currentFilters || {}, 1);

  // Bind Previous page button click listener
  const prevBtn = document.getElementById('prevPageBtn');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        loadLogs(window.currentFilters || {}, currentPage - 1);
      }
    });
  }

  // Bind Next page button click listener
  const nextBtn = document.getElementById('nextPageBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        loadLogs(window.currentFilters || {}, currentPage + 1);
      }
    });
  }
});
