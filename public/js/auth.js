const API_BASE = window.location.port === '5000'
  ? window.location.origin + '/api'
  : 'http://localhost:5000/api';


function getCurrentUser() {

  const userJson = localStorage.getItem('vaultdb_user');

  if (!userJson) return null;

  try {

    return JSON.parse(userJson);
  } catch (error) {

    console.error('Failed to parse stored user profile:', error);
    return null;
  }
}


function getAuthHeader() {

  const token = localStorage.getItem('vaultdb_token') || '';

  return {

    'Authorization': 'Bearer ' + token,

    'Content-Type': 'application/json',
  };
}


function checkAuth() {

  const token = localStorage.getItem('vaultdb_token');

  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');

  if (!token && !isLoginPage) {

    window.location.href = 'index.html';
    return false;
  }

  if (token && isLoginPage) {

    window.location.href = 'dashboard.html';
    return true;
  }

  return Boolean(token);
}


function logout() {

  localStorage.removeItem('vaultdb_token');

  localStorage.removeItem('vaultdb_user');

  window.location.href = 'index.html';
}


document.addEventListener('DOMContentLoaded', () => {

  const loginForm = document.getElementById('loginForm');

  if (!loginForm) return;


  if (localStorage.getItem('vaultdb_token')) {

    window.location.href = 'dashboard.html';
    return;
  }


  loginForm.addEventListener('submit', async (event) => {

    event.preventDefault();


    const errorContainer = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const btnText = document.getElementById('loginBtnText');


    if (errorContainer) errorContainer.classList.add('hidden');


    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;


    if (!email || !password) {

      if (errorContainer && errorText) {
        errorText.textContent = 'Please enter both email and password.';
        errorContainer.classList.remove('hidden');
      }
      return;
    }


    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Verifying credentials...';


    try {

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });


      const data = await response.json();


      if (!response.ok) {

        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }


      localStorage.setItem('vaultdb_token', data.token);

      localStorage.setItem('vaultdb_user', JSON.stringify(data.user));


      window.location.href = 'dashboard.html';
    } catch (error) {

      console.error('Authentication request failed:', error);

      if (errorContainer && errorText) {
        errorText.textContent = error.message || 'Unable to connect to authentication server.';
        errorContainer.classList.remove('hidden');
      }
    } finally {

      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.textContent = 'Authenticate to Vault';
    }
  });
});
