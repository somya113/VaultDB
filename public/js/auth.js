// ==========================================================================
// VAULTDB AUTHENTICATION MODULE - JWT STORAGE, SESSION & RBAC MANAGEMENT
// ==========================================================================

// Base API endpoint URL for backend authentication and audit services
const API_BASE = window.location.port === '5000'
  ? window.location.origin + '/api'
  : 'http://localhost:5000/api';

// Retrieve the currently authenticated user profile from local browser storage
function getCurrentUser() {
  // Read raw serialized JSON user string from localStorage
  const userJson = localStorage.getItem('vaultdb_user');
  // Return null if no stored session profile is found
  if (!userJson) return null;
  // Parse and return the structured JSON user object
  try {
    // Attempt JSON parse
    return JSON.parse(userJson);
  } catch (error) {
    // Return null if stored token payload is corrupted
    console.error('Failed to parse stored user profile:', error);
    return null;
  }
}

// Construct authorized HTTP headers with Bearer JWT token for protected API calls
function getAuthHeader() {
  // Retrieve raw JWT string from localStorage
  const token = localStorage.getItem('vaultdb_token') || '';
  // Return request header object with Bearer token authorization
  return {
    // Supply standard Authorization Bearer header
    'Authorization': 'Bearer ' + token,
    // Specify JSON payload format
    'Content-Type': 'application/json',
  };
}

// Verify active authentication state and enforce route protection
function checkAuth() {
  // Retrieve token from browser storage
  const token = localStorage.getItem('vaultdb_token');
  // Determine if current window path is the login screen
  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
  // If token is missing on a protected page, redirect user to the login portal
  if (!token && !isLoginPage) {
    // Redirect unauthenticated user to index.html
    window.location.href = 'index.html';
    return false;
  }
  // If user is already authenticated and lands on the login page, redirect to dashboard
  if (token && isLoginPage) {
    // Redirect authenticated user directly to the audit portal
    window.location.href = 'dashboard.html';
    return true;
  }
  // Return authentication status flag
  return Boolean(token);
}

// Invalidate local session credentials and return user to login screen
function logout() {
  // Remove cryptographic JWT access token from browser storage
  localStorage.removeItem('vaultdb_token');
  // Remove stored user profile data
  localStorage.removeItem('vaultdb_user');
  // Redirect browser navigation to the login view
  window.location.href = 'index.html';
}

// Bind event listeners for login form submission when DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  // Look for login form on current page
  const loginForm = document.getElementById('loginForm');
  // Exit handler if not on login page
  if (!loginForm) return;

  // Check if user is already authenticated and redirect to dashboard
  if (localStorage.getItem('vaultdb_token')) {
    // Redirect to dashboard immediately
    window.location.href = 'dashboard.html';
    return;
  }

  // Handle form submission event for login credentials
  loginForm.addEventListener('submit', async (event) => {
    // Prevent standard browser full-page reload
    event.preventDefault();

    // Cache DOM references for error banner and submit button
    const errorContainer = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const btnText = document.getElementById('loginBtnText');

    // Hide any previously displayed error message
    if (errorContainer) errorContainer.classList.add('hidden');

    // Read and trim user input credentials
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate that required credentials are provided
    if (!email || !password) {
      // Display client-side validation error
      if (errorContainer && errorText) {
        errorText.textContent = 'Please enter both email and password.';
        errorContainer.classList.remove('hidden');
      }
      return;
    }

    // Set submit button into active loading state
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Verifying credentials...';

    // Dispatch POST authentication request to backend service
    try {
      // Make asynchronous fetch call to backend login endpoint
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Parse JSON response body
      const data = await response.json();

      // Check for non-200 HTTP status response
      if (!response.ok) {
        // Throw error with server message or default text
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      // Persist signed JWT token into localStorage
      localStorage.setItem('vaultdb_token', data.token);
      // Persist safe user profile into localStorage
      localStorage.setItem('vaultdb_user', JSON.stringify(data.user));

      // Redirect user to the secure audit dashboard portal
      window.location.href = 'dashboard.html';
    } catch (error) {
      // Log authentication error for diagnostic tracing
      console.error('Authentication request failed:', error);
      // Reveal error banner with human-readable error description
      if (errorContainer && errorText) {
        errorText.textContent = error.message || 'Unable to connect to authentication server.';
        errorContainer.classList.remove('hidden');
      }
    } finally {
      // Restore submit button interactivity
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Authenticate to Vault';
    }
  });
});
