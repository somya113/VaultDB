// ==========================================================================
// VAULTDB FILTER CONTROLLER - AUDIT LEDGER QUERY STATE & TOAST ALERTS
// ==========================================================================

// Initialize global filters state object accessible to dashboard and export modules
window.currentFilters = {};

// Display temporary floating toast notification
function showToast(message, type = 'info') {
  // Find or target the persistent toast container element
  const container = document.getElementById('toastContainer');
  // Exit gracefully if container is missing from current DOM
  if (!container) return;

  // Create new div element for individual toast
  const toast = document.createElement('div');
  // Assign base toast class and variant modifier
  toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;

  // Select suitable icon based on notification category
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  // Construct internal toast HTML with icon and text
  toast.innerHTML = `
    <span>${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  // Append new toast to the fixed container
  container.appendChild(toast);

  // Automatically initiate slide-out and removal after 3 seconds
  setTimeout(() => {
    // Apply exit slide-out animation
    toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    // Remove element from DOM after transition finishes
    setTimeout(() => {
      // Remove toast from parent container
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3000);
}

// Read current values from filter input controls and serialize into an active filter object
function getFilterValues() {
  // Read and trim user email input value
  const userElem = document.getElementById('filterUser');
  const user_email = userElem ? userElem.value.trim() : '';

  // Read selected table dropdown value
  const tableElem = document.getElementById('filterTable');
  const table_accessed = tableElem ? tableElem.value : '';

  // Read start date range picker value
  const fromElem = document.getElementById('filterDateFrom');
  const date_from = fromElem ? fromElem.value : '';

  // Read end date range picker value
  const toElem = document.getElementById('filterDateTo');
  const date_to = toElem ? toElem.value : '';

  // Read sensitivity selection dropdown value
  const sensitiveElem = document.getElementById('filterSensitive');
  const is_sensitive = sensitiveElem ? sensitiveElem.value : '';

  // Return normalized filters object
  return {
    user_email,
    table_accessed,
    date_from,
    date_to,
    is_sensitive,
  };
}

// Apply configured filters, trigger audit ledger query reload, and notify user
function applyFilters() {
  // Extract values from DOM inputs
  const filters = getFilterValues();

  // Validate date range chronology if both dates are specified
  if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
    // Alert user if from date is later than to date
    showToast('Start date cannot be later than end date.', 'error');
    return;
  }

  // Persist into global window state
  window.currentFilters = filters;

  // Reload audit log records starting at page 1 with active filters
  if (typeof loadLogs === 'function') {
    loadLogs(window.currentFilters, 1);
  }

  // Display confirmation toast
  showToast('Filters applied successfully.', 'success');
}

// Reset all filter controls to their default state and refresh data
function resetFilters() {
  // Clear user email input field
  const userElem = document.getElementById('filterUser');
  if (userElem) userElem.value = '';

  // Reset table dropdown to all tables
  const tableElem = document.getElementById('filterTable');
  if (tableElem) tableElem.value = '';

  // Clear start date picker
  const fromElem = document.getElementById('filterDateFrom');
  if (fromElem) fromElem.value = '';

  // Clear end date picker
  const toElem = document.getElementById('filterDateTo');
  if (toElem) toElem.value = '';

  // Reset sensitivity dropdown to all records
  const sensitiveElem = document.getElementById('filterSensitive');
  if (sensitiveElem) sensitiveElem.value = '';

  // Clear global filters state object
  window.currentFilters = {};

  // Reload default unfiltered audit log ledger from page 1
  if (typeof loadLogs === 'function') {
    loadLogs({}, 1);
  }

  // Notify user with informational toast
  showToast('Filters reset to default.', 'info');
}

// Initialize filter event handlers once DOM content has loaded
document.addEventListener('DOMContentLoaded', () => {
  // Target Apply Filters button element
  const applyBtn = document.getElementById('applyFiltersBtn');
  // Bind click listener to trigger filter application
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyFilters();
    });
  }

  // Target Reset Filters button element
  const resetBtn = document.getElementById('resetFiltersBtn');
  // Bind click listener to reset all input values
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetFilters();
    });
  }

  // Collect array of all interactive filter input elements
  const filterInputs = [
    document.getElementById('filterUser'),
    document.getElementById('filterTable'),
    document.getElementById('filterDateFrom'),
    document.getElementById('filterDateTo'),
    document.getElementById('filterSensitive'),
  ].filter(Boolean);

  // Attach Enter keydown listener to each input control for keyboard efficiency
  filterInputs.forEach((input) => {
    // Listen for keydown events
    input.addEventListener('keydown', (event) => {
      // Check if Enter key was pressed
      if (event.key === 'Enter') {
        // Prevent default form behavior
        event.preventDefault();
        // Trigger filter execution
        applyFilters();
      }
    });
  });
});
