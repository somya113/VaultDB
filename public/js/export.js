// ==========================================================================
// VAULTDB PDF EXPORT CONTROLLER - CRYPTOGRAPHIC AUDIT REPORT GENERATION
// ==========================================================================

// Handle PDF compliance report generation and streaming download trigger
async function exportPdfReport() {
  // Target Export PDF Report button element
  const exportBtn = document.getElementById('exportPdfBtn');
  // Target button label text container
  const exportBtnText = document.getElementById('exportPdfBtnText');
  // Store reference to original button inner content
  const originalHtml = exportBtn ? exportBtn.innerHTML : '';

  // Extract active query filters from global state or DOM inputs
  const filters = window.currentFilters || {};
  // Extract user email filter
  const user_email = filters.user_email || (document.getElementById('filterUser')?.value.trim() || '');
  // Extract start date filter
  const date_from = filters.date_from || (document.getElementById('filterDateFrom')?.value || '');
  // Extract end date filter
  const date_to = filters.date_to || (document.getElementById('filterDateTo')?.value || '');

  // Construct URL parameters object
  const params = new URLSearchParams();
  // Include user email parameter if present
  if (user_email) params.set('user_email', user_email);
  // Include date from parameter if present
  if (date_from) params.set('date_from', date_from);
  // Include date to parameter if present
  if (date_to) params.set('date_to', date_to);

  // Transition button into active loading state
  if (exportBtn) {
    // Disable button to prevent concurrent duplicate download requests
    exportBtn.disabled = true;
    // Set requested loading label state
    exportBtn.innerHTML = '<span>⏳ Generating PDF...</span>';
  }

  try {
    // Dispatch GET request with Bearer authentication header to export endpoint
    const response = await fetch(`${API_BASE}/export/pdf?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeader(),
    });

    // Check for authorization denial
    if (response.status === 401 || response.status === 403) {
      // Invalidate session if credentials expired
      logout();
      return;
    }

    // Verify successful HTTP response status
    if (!response.ok) {
      // Parse error payload or create generic error
      let errorMsg = 'Failed to generate compliance report.';
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch (_) {
        // Response was not JSON
      }
      throw new Error(errorMsg);
    }

    // Convert raw binary response into a PDF Blob
    const blob = await response.blob();

    // Verify blob payload validity
    if (!blob || blob.size === 0) {
      throw new Error('Received empty PDF document from server.');
    }

    // Create an object URL representing the PDF binary blob
    const downloadUrl = window.URL.createObjectURL(blob);

    // Create temporary hidden anchor DOM element to trigger browser file download
    const downloadLink = document.createElement('a');
    // Set object URL as download target
    downloadLink.href = downloadUrl;
    // Format UTC date stamp string in YYYY-MM-DD format
    const reportDate = new Date().toISOString().slice(0, 10);
    // Assign expected standardized file name
    downloadLink.download = `VaultDB_Audit_Report_${reportDate}.pdf`;
    // Attach hidden element to DOM tree
    document.body.appendChild(downloadLink);
    // Programmatically execute mouse click on anchor
    downloadLink.click();
    // Remove temporary anchor element from DOM tree
    document.body.removeChild(downloadLink);
    // Revoke binary object URL to prevent memory leaks
    window.URL.revokeObjectURL(downloadUrl);

    // Notify user with success toast alert
    if (typeof showToast === 'function') {
      showToast('VaultDB Audit Report downloaded successfully.', 'success');
    }
  } catch (error) {
    // Log export failure for diagnostics
    console.error('PDF compliance report export failed:', error);
    // Notify user with error toast alert
    if (typeof showToast === 'function') {
      showToast(error.message || 'Unable to generate PDF report.', 'error');
    }
  } finally {
    // Restore original button interactive state
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalHtml || '<span>📄</span><span id="exportPdfBtnText">Export PDF Report</span>';
    }
  }
}

// Attach click event listener to Export PDF button upon document readiness
document.addEventListener('DOMContentLoaded', () => {
  // Target Export PDF Report button
  const exportBtn = document.getElementById('exportPdfBtn');
  // Register click event listener
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportPdfReport();
    });
  }
});
