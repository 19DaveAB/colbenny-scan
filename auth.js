// Authentication management for user accounts
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.storageKey = 'colbenny_auth';
        
        this.init();
    }

    init() {
        this.loadStoredAuth();
        this.setupEventListeners();
        this.updateUI();
    }

    loadStoredAuth() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const authData = JSON.parse(stored);
                if (authData.user && authData.loginTime) {
                    // Check if login is still valid (24 hours)
                    const loginAge = Date.now() - authData.loginTime;
                    if (loginAge < 24 * 60 * 60 * 1000) {
                        this.currentUser = authData.user;
                        this.isLoggedIn = true;
                    } else {
                        this.logout();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading stored auth:', error);
        }
    }

    setupEventListeners() {
        // Login button
        document.getElementById('login-btn').addEventListener('click', () => {
            this.showLoginModal();
        });

        // Register button
        document.getElementById('register-btn').addEventListener('click', () => {
            this.showRegisterModal();
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Profile settings
        document.getElementById('profile-settings').addEventListener('click', () => {
            this.showProfileSettings();
        });

        // Modal close buttons
        document.getElementById('close-login-modal').addEventListener('click', () => {
            this.closeModal('login-modal');
        });

        document.getElementById('close-register-modal').addEventListener('click', () => {
            this.closeModal('register-modal');
        });

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', (e) => {
            this.handleLogin(e);
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            this.handleRegister(e);
        });

        // Switch between login and register
        document.getElementById('switch-to-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('login-modal');
            this.showRegisterModal();
        });

        document.getElementById('switch-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('register-modal');
            this.showLoginModal();
        });

        // Profile dropdown toggle
        document.getElementById('user-profile').addEventListener('click', () => {
            this.toggleProfileDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#user-profile')) {
                this.closeProfileDropdown();
            }
        });
    }

    showLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('login-email').focus();
    }

    showRegisterModal() {
        document.getElementById('register-modal').style.display = 'flex';
        document.getElementById('register-name').focus();
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            // Simulate login process (in real app, this would be an API call)
            const user = await this.authenticateUser(email, password);
            
            if (user) {
                this.setUser(user);
                this.closeModal('login-modal');
                this.showSuccess('Login successful! Welcome back.');
                
                // Clear form
                document.getElementById('login-form').reset();
            } else {
                this.showError('Invalid email or password. Please try again.');
            }
        } catch (error) {
            this.showError('Login failed: ' + error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        // Validate passwords match
        if (password !== confirmPassword) {
            this.showError('Passwords do not match.');
            return;
        }

        // Validate password strength
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long.');
            return;
        }

        try {
            // Simulate registration process
            const user = await this.registerUser(name, email, password);
            
            if (user) {
                this.setUser(user);
                this.closeModal('register-modal');
                this.showSuccess('Account created successfully! Welcome to Colbenny.');
                
                // Clear form
                document.getElementById('register-form').reset();
            } else {
                this.showError('Registration failed. Email may already be in use.');
            }
        } catch (error) {
            this.showError('Registration failed: ' + error.message);
        }
    }

    async authenticateUser(email, password) {
        // Simulate API call delay
        await this.delay(1000);
        
        // Check stored users (in real app, this would be server-side)
        const storedUsers = this.getStoredUsers();
        const user = storedUsers.find(u => u.email === email);
        
        if (user && user.password === this.hashPassword(password)) {
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                joinDate: user.joinDate,
                avatar: user.avatar || null
            };
        }
        
        return null;
    }

    async registerUser(name, email, password) {
        // Simulate API call delay
        await this.delay(1000);
        
        const storedUsers = this.getStoredUsers();
        
        // Check if email already exists
        if (storedUsers.find(u => u.email === email)) {
            return null;
        }
        
        const newUser = {
            id: this.generateUserId(),
            name: name,
            email: email,
            password: this.hashPassword(password),
            joinDate: new Date().toISOString(),
            avatar: null
        };
        
        // Store user
        storedUsers.push(newUser);
        this.saveStoredUsers(storedUsers);
        
        return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            joinDate: newUser.joinDate,
            avatar: newUser.avatar
        };
    }

    setUser(user) {
        this.currentUser = user;
        this.isLoggedIn = true;
        
        // Store auth data
        const authData = {
            user: user,
            loginTime: Date.now()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(authData));
        
        this.updateUI();
        this.updateProfileStats();
    }

    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem(this.storageKey);
        this.updateUI();
        this.showSuccess('You have been logged out successfully.');
    }

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const userProfile = document.getElementById('user-profile');
        
        if (this.isLoggedIn && this.currentUser) {
            // Hide login/register buttons
            loginBtn.style.display = 'none';
            registerBtn.style.display = 'none';
            
            // Show user profile
            userProfile.style.display = 'flex';
            document.getElementById('profile-name').textContent = this.currentUser.name;
            
            // Update profile tab
            document.getElementById('user-display-name').textContent = this.currentUser.name;
            document.getElementById('user-email').textContent = this.currentUser.email;
            
            if (this.currentUser.joinDate) {
                const joinDate = new Date(this.currentUser.joinDate).toLocaleDateString();
                document.getElementById('member-date').textContent = joinDate;
            }
        } else {
            // Show login/register buttons
            loginBtn.style.display = 'inline-flex';
            registerBtn.style.display = 'inline-flex';
            
            // Hide user profile
            userProfile.style.display = 'none';
            
            // Reset profile tab
            document.getElementById('user-display-name').textContent = 'Guest User';
            document.getElementById('user-email').textContent = 'Not logged in';
            document.getElementById('member-date').textContent = '-';
        }
    }

    updateProfileStats() {
        if (!this.isLoggedIn) return;
        
        try {
            const history = window.storageManager ? window.storageManager.getHistory() : [];
            const stats = window.storageManager ? window.storageManager.getHistoryStats() : {};
            
            document.getElementById('total-scans').textContent = stats.total || 0;
            document.getElementById('this-week-scans').textContent = stats.thisWeek || 0;
            document.getElementById('favorite-foods').textContent = stats.topFoods ? stats.topFoods.length : 0;
            
            // Update top food
            if (stats.topFoods && stats.topFoods.length > 0) {
                document.getElementById('top-food').textContent = stats.topFoods[0].name;
            }
            
            // Calculate scan streak (simplified)
            const today = new Date();
            let streak = 0;
            for (let i = 0; i < history.length; i++) {
                const scanDate = new Date(history[i].timestamp);
                const daysDiff = Math.floor((today - scanDate) / (1000 * 60 * 60 * 24));
                if (daysDiff === streak) {
                    streak++;
                } else {
                    break;
                }
            }
            document.getElementById('scan-streak').textContent = streak + ' days';
            
        } catch (error) {
            console.error('Error updating profile stats:', error);
        }
    }

    showProfileSettings() {
        // Switch to profile tab
        if (window.app) {
            window.app.switchTab('profile');
        }
    }

    toggleProfileDropdown() {
        const dropdown = document.querySelector('.profile-dropdown');
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }

    closeProfileDropdown() {
        const dropdown = document.querySelector('.profile-dropdown');
        dropdown.style.display = 'none';
    }

    // Utility methods
    getStoredUsers() {
        try {
            const stored = localStorage.getItem('colbenny_users');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            return [];
        }
    }

    saveStoredUsers(users) {
        try {
            localStorage.setItem('colbenny_users', JSON.stringify(users));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    generateUserId() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    hashPassword(password) {
        // Simple hash for demo (in real app, use proper hashing)
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showError(message) {
        if (window.app) {
            window.app.showError(message);
        }
    }

    showSuccess(message) {
        if (window.app) {
            window.app.showSuccess(message);
        }
    }

    // Public methods for other modules
    getCurrentUser() {
        return this.currentUser;
    }

    isUserLoggedIn() {
        return this.isLoggedIn;
    }

    getUserId() {
        return this.currentUser ? this.currentUser.id : null;
    }
}

// Export for use in other modules
window.AuthManager = AuthManager;