async function exportPdfReport() {

  const exportBtn = document.getElementById('exportPdfBtn');

  const exportBtnText = document.getElementById('exportPdfBtnText');

  const originalHtml = exportBtn ? exportBtn.innerHTML : '';


  const filters = window.currentFilters || {};

  const user_email = filters.user_email || (document.getElementById('filterUser')?.value.trim() || '');

  const date_from = filters.date_from || (document.getElementById('filterDateFrom')?.value || '');

  const date_to = filters.date_to || (document.getElementById('filterDateTo')?.value || '');


  const params = new URLSearchParams();

  if (user_email) params.set('user_email', user_email);

  if (date_from) params.set('date_from', date_from);

  if (date_to) params.set('date_to', date_to);


  if (exportBtn) {

    exportBtn.disabled = true;

    exportBtn.innerHTML = '<span>⏳ Generating PDF...</span>';
  }

  try {

    const response = await fetch(`${API_BASE}/export/pdf?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });


    if (response.status === 401 || response.status === 403) {

      logout();
      return;
    }


    if (!response.ok) {

      let errorMsg = 'Failed to generate compliance report.';
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch (_) {

      }
      throw new Error(errorMsg);
    }


    const blob = await response.blob();


    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF document from server.');
    }


    const downloadUrl = window.URL.createObjectURL(blob);


    const downloadLink = document.createElement('a');

    downloadLink.href = downloadUrl;

    const reportDate = new Date().toISOString().slice(0, 10);

    downloadLink.download = `VaultDB_Audit_Report_${reportDate}.pdf`;

    document.body.appendChild(downloadLink);

    downloadLink.click();

    document.body.removeChild(downloadLink);

    window.URL.revokeObjectURL(downloadUrl);


    if (typeof showToast === 'function') {
      showToast('VaultDB Audit Report downloaded successfully.', 'success');
    }
  } catch (error) {

    console.error('PDF compliance report export failed:', error);

    if (typeof showToast === 'function') {
      showToast(error.message || 'Unable to generate PDF report.', 'error');
    }
  } finally {

    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalHtml || '<span>📄</span><span id="exportPdfBtnText">Export PDF Report</span>';
    }
  }
}


document.addEventListener('DOMContentLoaded', () => {

  const exportBtn = document.getElementById('exportPdfBtn');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportPdfReport();
    });
  }
});
