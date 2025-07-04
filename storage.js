// Local storage management for history and preferences
class StorageManager {
    constructor() {
        this.storageKey = 'colbenny_data';
        this.historyKey = 'colbenny_history';
        this.preferencesKey = 'colbenny_preferences';
        this.maxHistoryItems = 100;
        
        this.initializeStorage();
    }

    initializeStorage() {
        // Check if localStorage is available
        if (!this.isLocalStorageAvailable()) {
            console.warn('localStorage not available, using memory storage');
            this.fallbackStorage = new Map();
        }

        // Initialize default data structure
        this.ensureDataStructure();
    }

    isLocalStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    ensureDataStructure() {
        // Initialize history if it doesn't exist
        if (!this.getItem(this.historyKey)) {
            this.setItem(this.historyKey, []);
        }

        // Initialize preferences if they don't exist
        if (!this.getItem(this.preferencesKey)) {
            this.setItem(this.preferencesKey, {
                theme: 'light',
                saveImages: true,
                notificationsEnabled: true,
                autoSave: true
            });
        }
    }

    getItem(key) {
        try {
            if (this.isLocalStorageAvailable()) {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } else {
                return this.fallbackStorage.get(key) || null;
            }
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    }

    setItem(key, value) {
        try {
            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(key, JSON.stringify(value));
            } else {
                this.fallbackStorage.set(key, value);
            }
            return true;
        } catch (error) {
            console.error('Error writing to storage:', error);
            return false;
        }
    }

    removeItem(key) {
        try {
            if (this.isLocalStorageAvailable()) {
                localStorage.removeItem(key);
            } else {
                this.fallbackStorage.delete(key);
            }
            return true;
        } catch (error) {
            console.error('Error removing from storage:', error);
            return false;
        }
    }

    // History Management
    saveToHistory(foodData) {
        try {
            const history = this.getHistory();
            
            // Create history item
            const historyItem = {
                id: this.generateId(),
                name: foodData.name,
                timestamp: foodData.timestamp || new Date().toISOString(),
                imageData: this.shouldSaveImages() ? foodData.imageData : null,
                ingredients: foodData.ingredients,
                nutrition: foodData.nutrition,
                benefits: foodData.benefits,
                warnings: foodData.warnings,
                confidence: foodData.confidence
            };

            // Add to beginning of history
            history.unshift(historyItem);

            // Limit history size
            if (history.length > this.maxHistoryItems) {
                history.splice(this.maxHistoryItems);
            }

            // Save updated history
            this.setItem(this.historyKey, history);
            
            // Trigger storage event for other tabs
            this.dispatchStorageEvent('historyUpdated', historyItem);
            
            return historyItem.id;

        } catch (error) {
            console.error('Error saving to history:', error);
            throw new Error('Failed to save to history');
        }
    }

    getHistory() {
        try {
            return this.getItem(this.historyKey) || [];
        } catch (error) {
            console.error('Error loading history:', error);
            return [];
        }
    }

    getHistoryItem(id) {
        try {
            const history = this.getHistory();
            return history.find(item => item.id === id) || null;
        } catch (error) {
            console.error('Error getting history item:', error);
            return null;
        }
    }

    deleteHistoryItem(id) {
        try {
            let history = this.getHistory();
            const initialLength = history.length;
            
            history = history.filter(item => item.id !== id);
            
            if (history.length < initialLength) {
                this.setItem(this.historyKey, history);
                this.dispatchStorageEvent('historyItemDeleted', id);
                return true;
            }
            
            return false;

        } catch (error) {
            console.error('Error deleting history item:', error);
            return false;
        }
    }

    clearHistory() {
        try {
            this.setItem(this.historyKey, []);
            this.dispatchStorageEvent('historyCleared');
            return true;
        } catch (error) {
            console.error('Error clearing history:', error);
            return false;
        }
    }

    searchHistory(query) {
        try {
            const history = this.getHistory();
            const searchTerm = query.toLowerCase();
            
            return history.filter(item => 
                item.name.toLowerCase().includes(searchTerm) ||
                (item.ingredients && item.ingredients.some(ingredient => 
                    ingredient.toLowerCase().includes(searchTerm)
                ))
            );
        } catch (error) {
            console.error('Error searching history:', error);
            return [];
        }
    }

    getHistoryStats() {
        try {
            const history = this.getHistory();
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            return {
                total: history.length,
                today: history.filter(item => new Date(item.timestamp) > dayAgo).length,
                thisWeek: history.filter(item => new Date(item.timestamp) > weekAgo).length,
                thisMonth: history.filter(item => new Date(item.timestamp) > monthAgo).length,
                topFoods: this.getTopFoods(history),
                recentScans: history.slice(0, 5)
            };
        } catch (error) {
            console.error('Error getting history stats:', error);
            return {
                total: 0,
                today: 0,
                thisWeek: 0,
                thisMonth: 0,
                topFoods: [],
                recentScans: []
            };
        }
    }

    getTopFoods(history) {
        const foodCounts = {};
        
        history.forEach(item => {
            foodCounts[item.name] = (foodCounts[item.name] || 0) + 1;
        });

        return Object.entries(foodCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    // Preferences Management
    getPreferences() {
        try {
            return this.getItem(this.preferencesKey) || {};
        } catch (error) {
            console.error('Error loading preferences:', error);
            return {};
        }
    }

    setPreference(key, value) {
        try {
            const preferences = this.getPreferences();
            preferences[key] = value;
            
            this.setItem(this.preferencesKey, preferences);
            this.dispatchStorageEvent('preferenceChanged', { key, value });
            
            return true;
        } catch (error) {
            console.error('Error setting preference:', error);
            return false;
        }
    }

    getPreference(key, defaultValue = null) {
        try {
            const preferences = this.getPreferences();
            return preferences.hasOwnProperty(key) ? preferences[key] : defaultValue;
        } catch (error) {
            console.error('Error getting preference:', error);
            return defaultValue;
        }
    }

    shouldSaveImages() {
        return this.getPreference('saveImages', true);
    }

    isAutoSaveEnabled() {
        return this.getPreference('autoSave', true);
    }

    // Data Export/Import
    exportData() {
        try {
            const data = {
                history: this.getHistory(),
                preferences: this.getPreferences(),
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw new Error('Failed to export data');
        }
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validate data structure
            if (!data.history || !Array.isArray(data.history)) {
                throw new Error('Invalid data format: missing or invalid history');
            }

            // Backup current data
            const backup = {
                history: this.getHistory(),
                preferences: this.getPreferences()
            };

            try {
                // Import history
                const importedHistory = data.history.map(item => ({
                    ...item,
                    id: item.id || this.generateId(),
                    imported: true,
                    importDate: new Date().toISOString()
                }));
                
                this.setItem(this.historyKey, importedHistory);

                // Import preferences if available
                if (data.preferences && typeof data.preferences === 'object') {
                    const currentPrefs = this.getPreferences();
                    const mergedPrefs = { ...currentPrefs, ...data.preferences };
                    this.setItem(this.preferencesKey, mergedPrefs);
                }

                this.dispatchStorageEvent('dataImported', { itemCount: importedHistory.length });
                
                return {
                    success: true,
                    itemsImported: importedHistory.length
                };

            } catch (importError) {
                // Restore backup on failure
                this.setItem(this.historyKey, backup.history);
                this.setItem(this.preferencesKey, backup.preferences);
                throw importError;
            }

        } catch (error) {
            console.error('Error importing data:', error);
            throw new Error('Failed to import data: ' + error.message);
        }
    }

    // Storage cleanup and maintenance
    cleanupStorage() {
        try {
            const history = this.getHistory();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 365); // Keep 1 year of history

            const filteredHistory = history.filter(item => 
                new Date(item.timestamp) > cutoffDate
            );

            if (filteredHistory.length < history.length) {
                this.setItem(this.historyKey, filteredHistory);
                console.log(`Cleaned up ${history.length - filteredHistory.length} old history items`);
            }

            return true;
        } catch (error) {
            console.error('Error cleaning up storage:', error);
            return false;
        }
    }

    getStorageSize() {
        try {
            if (!this.isLocalStorageAvailable()) {
                return { used: 0, available: 0, unit: 'bytes' };
            }

            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }

            // Estimate available space (most browsers have 5-10MB limit)
            const estimatedLimit = 5 * 1024 * 1024; // 5MB
            
            return {
                used: totalSize,
                available: estimatedLimit - totalSize,
                unit: 'bytes',
                usedMB: (totalSize / 1024 / 1024).toFixed(2),
                availableMB: ((estimatedLimit - totalSize) / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('Error calculating storage size:', error);
            return { used: 0, available: 0, unit: 'bytes' };
        }
    }

    // Utility methods
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    dispatchStorageEvent(type, data = null) {
        try {
            const event = new CustomEvent('colbennyStorage', {
                detail: { type, data, timestamp: new Date().toISOString() }
            });
            window.dispatchEvent(event);
        } catch (error) {
            console.error('Error dispatching storage event:', error);
        }
    }

    // Event listener for cross-tab synchronization
    addEventListener(callback) {
        const handler = (event) => {
            if (event.detail && typeof callback === 'function') {
                callback(event.detail);
            }
        };

        window.addEventListener('colbennyStorage', handler);
        
        // Return cleanup function
        return () => {
            window.removeEventListener('colbennyStorage', handler);
        };
    }

    // Storage quota management
    isStorageQuotaExceeded() {
        const storageInfo = this.getStorageSize();
        return storageInfo.available < 1024 * 100; // Less than 100KB available
    }

    handleStorageQuotaExceeded() {
        try {
            // Remove oldest images first
            const history = this.getHistory();
            const updatedHistory = history.map(item => ({
                ...item,
                imageData: null // Remove images to save space
            }));
            
            this.setItem(this.historyKey, updatedHistory);
            
            // If still not enough space, remove oldest entries
            if (this.isStorageQuotaExceeded() && updatedHistory.length > 50) {
                const trimmedHistory = updatedHistory.slice(0, 50);
                this.setItem(this.historyKey, trimmedHistory);
            }

            return true;
        } catch (error) {
            console.error('Error handling storage quota:', error);
            return false;
        }
    }

    // Initialize periodic cleanup
    startPeriodicCleanup() {
        // Clean up storage once per day
        const interval = 24 * 60 * 60 * 1000; // 24 hours
        
        setInterval(() => {
            this.cleanupStorage();
            
            if (this.isStorageQuotaExceeded()) {
                this.handleStorageQuotaExceeded();
            }
        }, interval);
    }
}

// Export for use in other modules
window.StorageManager = StorageManager;
