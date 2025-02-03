document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    const response = await window.electron.performLogin({ username, password });
  
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = response.message;
    messageDiv.style.color = response.success ? 'green' : 'red';
    if (response.success) {
        document.getElementById('loginForm').reset();
        sessionStorage.setItem('isLoggedIn', 'true');
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        await window.electron.setDefaultTab(isLoggedIn);
        await window.electron.updateTab('ui/index.html');
    }
});
