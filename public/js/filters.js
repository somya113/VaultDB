window.currentFilters = {};


function showToast(message, type = 'info') {

  const container = document.getElementById('toastContainer');

  if (!container) return;


  const toast = document.createElement('div');

  toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;


  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';


  toast.innerHTML = `
    <span>${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;


  container.appendChild(toast);


  setTimeout(() => {

    toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';

    setTimeout(() => {

      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3000);
}


function getFilterValues() {

  const userElem = document.getElementById('filterUser');
  const user_email = userElem ? userElem.value.trim() : '';


  const tableElem = document.getElementById('filterTable');
  const table_accessed = tableElem ? tableElem.value : '';


  const fromElem = document.getElementById('filterDateFrom');
  const date_from = fromElem ? fromElem.value : '';


  const toElem = document.getElementById('filterDateTo');
  const date_to = toElem ? toElem.value : '';


  const sensitiveElem = document.getElementById('filterSensitive');
  const is_sensitive = sensitiveElem ? sensitiveElem.value : '';


  return {
    user_email,
    table_accessed,
    date_from,
    date_to,
    is_sensitive,
  };
}


function applyFilters() {

  const filters = getFilterValues();


  if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {

    showToast('Start date cannot be later than end date.', 'error');
    return;
  }


  window.currentFilters = filters;


  if (typeof loadLogs === 'function') {
    loadLogs(window.currentFilters, 1);
  }


  showToast('Filters applied successfully.', 'success');
}


function resetFilters() {

  const userElem = document.getElementById('filterUser');
  if (userElem) userElem.value = '';


  const tableElem = document.getElementById('filterTable');
  if (tableElem) tableElem.value = '';


  const fromElem = document.getElementById('filterDateFrom');
  if (fromElem) fromElem.value = '';


  const toElem = document.getElementById('filterDateTo');
  if (toElem) toElem.value = '';


  const sensitiveElem = document.getElementById('filterSensitive');
  if (sensitiveElem) sensitiveElem.value = '';


  window.currentFilters = {};


  if (typeof loadLogs === 'function') {
    loadLogs({}, 1);
  }


  showToast('Filters reset to default.', 'info');
}


document.addEventListener('DOMContentLoaded', () => {

  const applyBtn = document.getElementById('applyFiltersBtn');

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyFilters();
    });
  }


  const resetBtn = document.getElementById('resetFiltersBtn');

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetFilters();
    });
  }


  const filterInputs = [
    document.getElementById('filterUser'),
    document.getElementById('filterTable'),
    document.getElementById('filterDateFrom'),
    document.getElementById('filterDateTo'),
    document.getElementById('filterSensitive'),
  ].filter(Boolean);


  filterInputs.forEach((input) => {

    input.addEventListener('keydown', (event) => {

      if (event.key === 'Enter') {

        event.preventDefault();

        applyFilters();
      }
    });
  });
});
