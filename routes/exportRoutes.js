// Import Express to define the compliance-report endpoint.
const express = require('express'); // Use the application's established routing framework.
// Import PDFKit for streaming a generated report.
const PDFDocument = require('pdfkit'); // This dependency is already declared in package.json.
// Import JWT authentication.
const verifyToken = require('../middleware/authMiddleware'); // Restrict compliance reports to authenticated users.
// Import the ledger's read-only report query.
const { getAllLogs } = require('../config/immudb'); // Fetch all matching entries without mutating the ledger.

// Create the report router mounted at /api/export.
const router = express.Router(); // Keep the endpoint path relative to server.js.

// Normalize arbitrary values into safe single-line report text.
function printable(value) { // Protect the PDF layout from line breaks and missing fields.
  return String(value === undefined || value === null ? '—' : value).replace(/[\r\n]+/g, ' '); // Render absent values consistently.
}

// Add a new page when the current report content would run past the footer area.
function ensureSpace(document, requiredHeight) { // Maintain readable margins across long audit histories.
  if (document.y + requiredHeight > document.page.height - 60) document.addPage(); // Keep the legal footer away from table rows.
}

// Draw a repeated table heading for each report page.
function drawTableHeader(document) { // Keep column labels visible when the report spans multiple pages.
  const columns = [ // Use a compact, fixed-width layout that fits a landscape Letter page.
    { label: 'Timestamp', width: 105 }, // Reserve space for ISO date-time values.
    { label: 'User / Role', width: 83 }, // Group identity with the user's role.
    { label: 'Action / Table', width: 78 }, // Group operation and table context.
    { label: 'Sensitive', width: 77 }, // Highlight sensitive access distinctly.
    { label: 'Query details', width: 195 }, // Give query metadata the largest share of the row.
    { label: 'Response / IP', width: 112 }, // Display latency and source address together.
  ];
  const startX = document.page.margins.left; // Align the table with the document's body margin.
  let x = startX; // Track each column's left edge.
  document.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff'); // Style labels for contrast against the navy header.
  document.rect(startX, document.y, columns.reduce((sum, column) => sum + column.width, 0), 19).fill('#172554'); // Draw a full-width dark table header.
  columns.forEach((column) => { // Render each label at its defined horizontal position.
    document.fillColor('#ffffff').text(column.label, x + 3, document.y + 5, { width: column.width - 6, height: 12, lineBreak: false }); // Keep labels inside their cells.
    x += column.width; // Move to the next column.
  });
  document.y += 23; // Leave a small gap before the data rows.
  return columns; // Reuse these widths when laying out each record.
}

// Draw one audit record as a wrapped row and return the next vertical position.
function drawRecord(document, record, columns) { // Preserve all requested audit fields in a compact table.
  const queryDetails = typeof record.query_details === 'string' ? record.query_details : JSON.stringify(record.query_details || {}); // Support both string and structured query metadata.
  const sensitiveText = record.is_sensitive ? '🚨 SENSITIVE' : 'No'; // Mark sensitive entries with the requested red alert tag.
  const values = [ // Match data values to the table columns in order.
    printable(record.timestamp), // Show when the event occurred.
    `${printable(record.user_email)} / ${printable(record.user_role)}`, // Include the actor and role.
    `${printable(record.action)} / ${printable(record.table_accessed)}`, // Include operation and accessed table.
    sensitiveText, // Explicitly flag sensitive data access.
    printable(queryDetails), // Include the stored query or request details.
    `${printable(record.response_time_ms)} ms / ${printable(record.ip_address)}`, // Include response time and source IP.
  ];
  const startX = document.page.margins.left; // Use the same left alignment as the header.
  const rowHeight = Math.max(...columns.map((column, index) => document.heightOfString(values[index], { width: column.width - 6, font: 'Helvetica', fontSize: 6 }))) + 8; // Size the row to its tallest wrapped cell.
  ensureSpace(document, rowHeight + 4); // Start a new page before the row collides with the footer.
  let x = startX; // Track current cell's horizontal position.
  values.forEach((value, index) => { // Render each value within its matching column.
    const color = index === 3 && record.is_sensitive ? '#b91c1c' : '#111827'; // Highlight sensitive entries in red.
    document.font(index === 3 && record.is_sensitive ? 'Helvetica-Bold' : 'Helvetica').fontSize(6).fillColor(color).text(value, x + 3, document.y + 4, { width: columns[index].width - 6, height: rowHeight - 4 }); // Wrap long details within the cell bounds.
    x += columns[index].width; // Advance to the next cell.
  });
  document.moveTo(startX, document.y + rowHeight).lineTo(startX + columns.reduce((sum, column) => sum + column.width, 0), document.y + rowHeight).strokeColor('#cbd5e1').lineWidth(0.4).stroke(); // Separate this record from the next.
  document.y += rowHeight; // Position the next record below the current row.
}

// Generate and stream a filtered audit report in PDF format.
router.get('/pdf', verifyToken, (req, res) => { // Require a valid token before exposing compliance records.
  const filters = { user_email: req.query.user_email, date_from: req.query.date_from, date_to: req.query.date_to }; // Limit report filters to the requested criteria.
  let records; // Hold all matching ledger entries before starting the PDF response.
  try { // Query the ledger before committing response headers.
    records = getAllLogs(filters); // Fetch every matching record without pagination.
  } catch (error) { // Handle any synchronous ledger query error.
    console.error('Preparing audit PDF failed:', error); // Record diagnostic details on the server.
    return res.status(500).json({ error: 'Unable to prepare the audit report.' }); // Send JSON while headers remain unset.
  }
  const reportDate = new Date().toISOString().slice(0, 10); // Use a filename-safe UTC date.
  res.setHeader('Content-Type', 'application/pdf'); // Identify the response as a PDF document.
  res.setHeader('Content-Disposition', `attachment; filename="VaultDB_Audit_Report_${reportDate}.pdf"`); // Prompt a predictable compliance-report download.
  const document = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 36, bufferPages: false }); // Choose a wide page for the requested audit columns.
  document.on('error', (error) => { // Surface streaming failures rather than producing a success-shaped fallback.
    console.error('Streaming audit PDF failed:', error); // Log the underlying PDF or response failure.
    if (!res.headersSent) res.status(500).end(); // Send an error status only if streaming has not begun.
    else res.destroy(error); // Terminate a partially streamed response on a late failure.
  });
  document.pipe(res); // Stream PDF bytes directly to the HTTP response.
  document.rect(0, 0, document.page.width, 96).fill('#172554'); // Create a dark navy compliance header across the page.
  document.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text('🏦 VaultDB Compliance Report', 36, 26, { width: document.page.width - 72 }); // Print the requested branded report title.
  document.font('Helvetica').fontSize(9).fillColor('#e2e8f0').text(`Generated by: ${printable(req.user.email)}    Generated at: ${new Date().toISOString()}    Cryptographically sealed by ImmuDB`, 38, 64, { width: document.page.width - 76 }); // Identify the report generator, timestamp, and ledger seal.
  document.moveTo(36, 101).lineTo(document.page.width - 36, 101).strokeColor('#f59e0b').lineWidth(3).stroke(); // Add the requested gold accent rule.
  document.y = 114; // Start report body content below the branded header.
  document.font('Helvetica').fontSize(9).fillColor('#111827').text(`Filters: user_email=${printable(filters.user_email || 'all')}; date_from=${printable(filters.date_from || 'all')}; date_to=${printable(filters.date_to || 'all')}`, 36, document.y, { width: document.page.width - 72 }); // Summarize the report's applied filters.
  document.moveDown(0.4); // Separate the filter summary from its metrics.
  const sensitiveCount = records.filter((record) => record.is_sensitive).length; // Count records flagged sensitive by the immutable ledger.
  document.font('Helvetica-Bold').text(`Matching records: ${records.length}    Sensitive records: ${sensitiveCount}`, 36, document.y, { width: document.page.width - 72 }); // Present total and sensitive counts.
  document.moveDown(0.8); // Leave room before the table header.
  let columns = drawTableHeader(document); // Draw the first page's audit table heading.
  records.forEach((record) => { // Add every filtered ledger record to the report.
    const estimatedHeight = Math.max(...columns.map((column, index) => { // Estimate row height before drawing to support page breaks.
      const queryDetails = typeof record.query_details === 'string' ? record.query_details : JSON.stringify(record.query_details || {}); // Normalize query details for consistent wrapping estimates.
      const values = [printable(record.timestamp), `${printable(record.user_email)} / ${printable(record.user_role)}`, `${printable(record.action)} / ${printable(record.table_accessed)}`, record.is_sensitive ? '🚨 SENSITIVE' : 'No', printable(queryDetails), `${printable(record.response_time_ms)} ms / ${printable(record.ip_address)}`]; // Mirror the rendered table's cell contents.
      return document.heightOfString(values[index], { width: column.width - 6, font: 'Helvetica', fontSize: 6 }); // Measure each cell using its actual width.
    })) + 8; // Include row padding in the page-fit estimate.
    if (document.y + estimatedHeight + 4 > document.page.height - 60) { // Check whether the next row fits above the footer.
      document.addPage(); // Continue long reports on a fresh landscape page.
      columns = drawTableHeader(document); // Repeat headings so every page is self-describing.
    }
    drawRecord(document, record, columns); // Render the current record as a wrapped table row.
  });
  ensureSpace(document, 34); // Keep the compliance footer together.
  document.moveDown(0.8); // Separate the footer from the final record.
  document.font('Helvetica').fontSize(7).fillColor('#475569').text('Legal notice: This report contains confidential audit information. Handle and retain it in accordance with applicable financial, privacy, and records-retention requirements.', 36, document.y, { width: document.page.width - 72, align: 'center' }); // Include the required legal compliance footer.
  document.end(); // Finalize the PDF stream and close the HTTP response when complete.
});

// Export the router for mounting by the main application.
module.exports = router; // server.js mounts this endpoint at /api/export.
