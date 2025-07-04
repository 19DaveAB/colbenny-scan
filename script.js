// Main application controller
class ColbennyApp {
    constructor() {
        this.currentTab = 'scan';
        this.currentFood = null;
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.loadHistory();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Camera controls
        document.getElementById('start-camera').addEventListener('click', () => {
            window.cameraManager.startCamera();
        });

        document.getElementById('capture-photo').addEventListener('click', () => {
            this.captureAndAnalyze();
        });

        document.getElementById('stop-camera').addEventListener('click', () => {
            window.cameraManager.stopCamera();
        });

        // File upload
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.analyzeImage(e.target.files[0]);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.analyzeImage(files[0]);
            }
        });

        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.showSearchSuggestions(e.target.value);
        });

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('save-result').addEventListener('click', () => {
            this.saveToHistory();
        });

        // Info tabs in modal
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchInfoTab(e.target.dataset.info);
            });
        });

        // History controls
        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });

        // Close modal when clicking outside
        document.getElementById('results-modal').addEventListener('click', (e) => {
            if (e.target.id === 'results-modal') {
                this.closeModal();
            }
        });
    }

    initializeComponents() {
        // Initialize camera manager
        window.cameraManager = new CameraManager();
        
        // Initialize API client
        window.apiClient = new APIClient();
        
        // Initialize storage manager
        window.storageManager = new StorageManager();
        
        // Initialize authentication manager
        window.authManager = new AuthManager();
        
        // Initialize calorie manager
        window.calorieManager = new CalorieManager();
    }

    switchTab(tabName) {
        if (this.isProcessing) return;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Tab-specific initialization
        if (tabName === 'history') {
            this.loadHistory();
        } else if (tabName === 'profile') {
            this.loadProfile();
        } else if (tabName === 'calories') {
            this.loadCalories();
        }
    }

    async captureAndAnalyze() {
        try {
            const imageData = window.cameraManager.capturePhoto();
            if (imageData) {
                await this.analyzeImageData(imageData);
            }
        } catch (error) {
            this.showError('Failed to capture photo: ' + error.message);
        }
    }

    async analyzeImage(file) {
        try {
            this.showLoading(true);
            
            const imageData = await this.fileToBase64(file);
            await this.analyzeImageData(imageData);
        } catch (error) {
            this.showError('Failed to analyze image: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeImageData(imageData) {
        try {
            this.showLoading(true);

            // Analyze food using API
            const foodData = await window.apiClient.analyzeFoodImage(imageData);
            
            if (foodData) {
                this.currentFood = {
                    ...foodData,
                    imageData: imageData,
                    timestamp: new Date().toISOString()
                };
                
                this.displayFoodResults(this.currentFood);
            } else {
                this.showError('Could not identify the food item. Please try with a clearer image.');
            }
        } catch (error) {
            this.showError('Analysis failed: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        try {
            this.showLoading(true);
            
            const foodData = await window.apiClient.searchFood(query);
            
            if (foodData) {
                this.currentFood = {
                    ...foodData,
                    timestamp: new Date().toISOString()
                };
                
                this.displayFoodResults(this.currentFood);
            } else {
                this.showError('No results found for "' + query + '"');
            }
        } catch (error) {
            this.showError('Search failed: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async showSearchSuggestions(query) {
        if (query.length < 2) {
            document.getElementById('search-suggestions').innerHTML = '';
            return;
        }

        try {
            const suggestions = await window.apiClient.getFoodSuggestions(query);
            this.displaySearchSuggestions(suggestions);
        } catch (error) {
            console.error('Failed to load suggestions:', error);
        }
    }

    displaySearchSuggestions(suggestions) {
        const container = document.getElementById('search-suggestions');
        
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<p class="no-suggestions">No suggestions found</p>';
            return;
        }

        container.innerHTML = suggestions.map(item => `
            <div class="suggestion-item" onclick="app.selectSuggestion('${item.name}')">
                <h4>${item.name}</h4>
                <p>${item.description || 'Click to view details'}</p>
            </div>
        `).join('');
    }

    async selectSuggestion(foodName) {
        document.getElementById('search-input').value = foodName;
        await this.performSearch();
    }

    displayFoodResults(foodData) {
        // Set food name and image
        document.getElementById('food-name').textContent = foodData.name || 'Unknown Food';
        
        const imageElement = document.getElementById('scanned-image');
        if (foodData.imageData) {
            imageElement.src = foodData.imageData;
            imageElement.style.display = 'block';
        } else {
            imageElement.style.display = 'none';
        }

        // Display ingredients
        this.displayIngredients(foodData.ingredients || []);
        
        // Display health benefits
        this.displayBenefits(foodData.benefits || []);
        
        // Display warnings
        this.displayWarnings(foodData.warnings || []);
        
        // Display nutrition facts
        this.displayNutrition(foodData.nutrition || {});

        // Show modal
        this.showModal();
    }

    displayIngredients(ingredients) {
        const list = document.getElementById('ingredients-list');
        
        if (!ingredients || ingredients.length === 0) {
            list.innerHTML = '<li>No ingredient information available</li>';
            return;
        }

        list.innerHTML = ingredients.map(ingredient => `
            <li>${ingredient}</li>
        `).join('');
    }

    displayBenefits(benefits) {
        const container = document.getElementById('benefits-list');
        
        if (!benefits || benefits.length === 0) {
            container.innerHTML = '<p>No health benefit information available</p>';
            return;
        }

        container.innerHTML = benefits.map(benefit => `
            <div class="benefit-item">
                <strong>${benefit.title || 'Health Benefit'}</strong>
                <p>${benefit.description}</p>
            </div>
        `).join('');
    }

    displayWarnings(warnings) {
        const container = document.getElementById('warnings-list');
        
        if (!warnings || warnings.length === 0) {
            container.innerHTML = '<p>No specific health warnings identified</p>';
            return;
        }

        container.innerHTML = warnings.map(warning => `
            <div class="warning-item">
                <strong>${warning.title || 'Health Warning'}</strong>
                <p>${warning.description}</p>
            </div>
        `).join('');
    }

    displayNutrition(nutrition) {
        const container = document.getElementById('nutrition-facts');
        
        if (!nutrition || Object.keys(nutrition).length === 0) {
            container.innerHTML = '<p>No nutritional information available</p>';
            return;
        }

        const nutritionItems = [
            { key: 'calories', label: 'Calories', unit: 'kcal' },
            { key: 'protein', label: 'Protein', unit: 'g' },
            { key: 'carbs', label: 'Carbohydrates', unit: 'g' },
            { key: 'fat', label: 'Fat', unit: 'g' },
            { key: 'fiber', label: 'Fiber', unit: 'g' },
            { key: 'sugar', label: 'Sugar', unit: 'g' },
            { key: 'sodium', label: 'Sodium', unit: 'mg' },
            { key: 'potassium', label: 'Potassium', unit: 'mg' }
        ];

        const availableItems = nutritionItems.filter(item => 
            nutrition[item.key] !== undefined && nutrition[item.key] !== null
        );

        if (availableItems.length === 0) {
            container.innerHTML = '<p>No detailed nutritional information available</p>';
            return;
        }

        container.innerHTML = `
            <div class="nutrition-grid">
                ${availableItems.map(item => `
                    <div class="nutrition-item">
                        <div class="nutrition-value">${nutrition[item.key]}${item.unit}</div>
                        <div class="nutrition-label">${item.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    switchInfoTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-info="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.info-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${tabName}-section`).classList.add('active');
    }

    saveToHistory() {
        if (!this.currentFood) return;

        try {
            window.storageManager.saveToHistory(this.currentFood);
            this.showSuccess('Food item saved to history');
            this.closeModal();
            
            // Refresh history if we're on that tab
            if (this.currentTab === 'history') {
                this.loadHistory();
            }
        } catch (error) {
            this.showError('Failed to save to history: ' + error.message);
        }
    }

    loadHistory() {
        try {
            const history = window.storageManager.getHistory();
            this.displayHistory(history);
        } catch (error) {
            this.showError('Failed to load history: ' + error.message);
        }
    }

    displayHistory(historyItems) {
        const container = document.getElementById('history-list');
        
        if (!historyItems || historyItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No scan history yet</h3>
                    <p>Start scanning or searching for food items to build your history.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = historyItems.map(item => `
            <div class="history-item" onclick="app.viewHistoryItem('${item.id}')">
                <h3>${item.name}</h3>
                <div class="date">${new Date(item.timestamp).toLocaleDateString()}</div>
                <div class="preview">
                    ${item.ingredients ? item.ingredients.slice(0, 3).join(', ') + '...' : 'No ingredients listed'}
                </div>
            </div>
        `).join('');
    }

    viewHistoryItem(itemId) {
        try {
            const item = window.storageManager.getHistoryItem(itemId);
            if (item) {
                this.currentFood = item;
                this.displayFoodResults(item);
            }
        } catch (error) {
            this.showError('Failed to load history item: ' + error.message);
        }
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
            try {
                window.storageManager.clearHistory();
                this.loadHistory();
                this.showSuccess('History cleared successfully');
            } catch (error) {
                this.showError('Failed to clear history: ' + error.message);
            }
        }
    }

    showModal() {
        document.getElementById('results-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('results-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
        this.isProcessing = show;
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        errorText.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    loadProfile() {
        try {
            if (window.authManager && window.authManager.isUserLoggedIn()) {
                window.authManager.updateProfileStats();
                this.loadUserPreferences();
            }
        } catch (error) {
            this.showError('Failed to load profile: ' + error.message);
        }
    }

    loadUserPreferences() {
        try {
            // Load user preferences and update toggles
            const saveImages = window.storageManager.getPreference('saveImages', true);
            const autoSave = window.storageManager.getPreference('autoSave', true);
            const notifications = window.storageManager.getPreference('notificationsEnabled', true);

            document.getElementById('save-images-toggle').checked = saveImages;
            document.getElementById('auto-save-toggle').checked = autoSave;
            document.getElementById('notifications-toggle').checked = notifications;

            // Add event listeners for preference changes
            document.getElementById('save-images-toggle').addEventListener('change', (e) => {
                window.storageManager.setPreference('saveImages', e.target.checked);
            });

            document.getElementById('auto-save-toggle').addEventListener('change', (e) => {
                window.storageManager.setPreference('autoSave', e.target.checked);
            });

            document.getElementById('notifications-toggle').addEventListener('change', (e) => {
                window.storageManager.setPreference('notificationsEnabled', e.target.checked);
            });
        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    loadCalories() {
        try {
            if (window.calorieManager) {
                window.calorieManager.updateDisplay();
                window.calorieManager.initializeMealDisplays();
            }
        } catch (error) {
            this.showError('Failed to load calorie data: ' + error.message);
        }
    }

    showSuccess(message) {
        // Create a temporary success message
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <p>${message}</p>
            </div>
        `;
        
        // Add styles
        successElement.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: var(--success-color);
            color: white;
            padding: 1rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            z-index: 1002;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(successElement);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successElement.remove();
        }, 3000);
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            
            reader.readAsDataURL(file);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ColbennyApp();
});

// Service Worker registration for offline capability
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
