// Calorie tracking and management functionality
class CalorieManager {
    constructor() {
        this.dailyGoal = 2000;
        this.consumed = 0;
        this.macros = {
            protein: 0,
            carbs: 0,
            fat: 0
        };
        this.foodLog = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: []
        };
        this.storageKey = 'colbenny_calories';
        
        // Comprehensive food database with calorie and macro information
        this.foodDatabase = {
            'apple': { calories: 95, protein: 0.5, carbs: 25, fat: 0.3, serving: '1 medium' },
            'banana': { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, serving: '1 medium' },
            'orange': { calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, serving: '1 medium' },
            'chicken breast': { calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: '100g' },
            'salmon': { calories: 208, protein: 22, carbs: 0, fat: 12, serving: '100g' },
            'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: '100g cooked' },
            'broccoli': { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, serving: '100g' },
            'spinach': { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, serving: '100g' },
            'avocado': { calories: 160, protein: 2, carbs: 9, fat: 15, serving: '100g' },
            'bread': { calories: 265, protein: 9, carbs: 49, fat: 3.2, serving: '100g' },
            'pasta': { calories: 131, protein: 5, carbs: 25, fat: 1.1, serving: '100g cooked' },
            'egg': { calories: 155, protein: 13, carbs: 1.1, fat: 11, serving: '100g' },
            'milk': { calories: 42, protein: 3.4, carbs: 5, fat: 1, serving: '100ml' },
            'yogurt': { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, serving: '100g' },
            'almonds': { calories: 579, protein: 21, carbs: 22, fat: 50, serving: '100g' },
            'oatmeal': { calories: 68, protein: 2.4, carbs: 12, fat: 1.4, serving: '100g cooked' },
            'sweet potato': { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, serving: '100g' },
            'tomato': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, serving: '100g' },
            'cucumber': { calories: 16, protein: 0.7, carbs: 4, fat: 0.1, serving: '100g' },
            'carrots': { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, serving: '100g' },
            'strawberries': { calories: 32, protein: 0.7, carbs: 8, fat: 0.3, serving: '100g' },
            'blueberries': { calories: 57, protein: 0.7, carbs: 14, fat: 0.3, serving: '100g' },
            'quinoa': { calories: 120, protein: 4.4, carbs: 22, fat: 1.9, serving: '100g cooked' },
            'tuna': { calories: 144, protein: 30, carbs: 0, fat: 1, serving: '100g' },
            'cheese': { calories: 113, protein: 7, carbs: 1, fat: 9, serving: '30g slice' }
        };
        
        this.init();
    }

    init() {
        this.loadStoredData();
        this.setupEventListeners();
        this.updateDisplay();
    }

    loadStoredData() {
        try {
            const today = new Date().toDateString();
            const stored = localStorage.getItem(this.storageKey);
            
            if (stored) {
                const data = JSON.parse(stored);
                
                // Check if data is from today
                if (data.date === today) {
                    this.consumed = data.consumed || 0;
                    this.macros = data.macros || { protein: 0, carbs: 0, fat: 0 };
                    this.foodLog = data.foodLog || { breakfast: [], lunch: [], dinner: [], snacks: [] };
                    this.dailyGoal = data.dailyGoal || 2000;
                }
            }
            
            // Load goals from storage manager if available
            if (window.storageManager) {
                this.dailyGoal = window.storageManager.getPreference('dailyCalorieGoal', 2000);
            }
        } catch (error) {
            console.error('Error loading calorie data:', error);
        }
    }

    saveData() {
        try {
            const today = new Date().toDateString();
            const data = {
                date: today,
                consumed: this.consumed,
                macros: this.macros,
                foodLog: this.foodLog,
                dailyGoal: this.dailyGoal
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving calorie data:', error);
        }
    }

    setupEventListeners() {
        // Calorie search
        document.getElementById('calorie-search-btn').addEventListener('click', () => {
            this.searchFood();
        });

        document.getElementById('calorie-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchFood();
            }
        });

        // Add food buttons
        document.querySelectorAll('.add-food-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.food-card');
                const foodName = card.dataset.food;
                const calories = parseInt(card.dataset.calories);
                this.showAddFoodModal(foodName, calories);
            });
        });

        // Goal update
        document.getElementById('update-goals-btn').addEventListener('click', () => {
            this.updateGoals();
        });

        // Activity level change
        document.getElementById('activity-level').addEventListener('change', () => {
            this.calculateRecommendedCalories();
        });
    }

    searchFood() {
        const query = document.getElementById('calorie-search-input').value.trim().toLowerCase();
        const resultsContainer = document.getElementById('calorie-results');
        
        if (!query) {
            resultsContainer.innerHTML = '<p>Please enter a food item to search.</p>';
            return;
        }

        // Search in food database
        const matches = this.findFoodMatches(query);
        
        if (matches.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>No exact matches found for "${query}".</p>
                    <p>Try searching for: apple, banana, chicken breast, rice, etc.</p>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="search-results">
                    <h4>Search Results for "${query}":</h4>
                    ${matches.map(food => `
                        <div class="result-item">
                            <div class="result-info">
                                <strong>${this.capitalizeFood(food.name)}</strong>
                                <p>${food.data.calories} calories per ${food.data.serving}</p>
                                <small>Protein: ${food.data.protein}g | Carbs: ${food.data.carbs}g | Fat: ${food.data.fat}g</small>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="window.calorieManager.showAddFoodModal('${food.name}', ${food.data.calories})">
                                Add to Log
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    findFoodMatches(query) {
        const matches = [];
        
        for (const [foodName, foodData] of Object.entries(this.foodDatabase)) {
            if (foodName.includes(query) || query.includes(foodName)) {
                matches.push({
                    name: foodName,
                    data: foodData
                });
            }
        }
        
        return matches;
    }

    showAddFoodModal(foodName, calories) {
        const food = this.foodDatabase[foodName];
        if (!food) return;

        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add ${this.capitalizeFood(foodName)}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="food-details">
                        <p><strong>Serving size:</strong> ${food.serving}</p>
                        <p><strong>Calories:</strong> ${food.calories}</p>
                        <p><strong>Protein:</strong> ${food.protein}g</p>
                        <p><strong>Carbs:</strong> ${food.carbs}g</p>
                        <p><strong>Fat:</strong> ${food.fat}g</p>
                    </div>
                    <div class="form-group">
                        <label for="serving-amount">Number of servings:</label>
                        <input type="number" id="serving-amount" value="1" min="0.1" step="0.1">
                    </div>
                    <div class="form-group">
                        <label for="meal-type">Add to:</label>
                        <select id="meal-type">
                            <option value="breakfast">Breakfast</option>
                            <option value="lunch">Lunch</option>
                            <option value="dinner">Dinner</option>
                            <option value="snacks">Snacks</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="window.calorieManager.addFoodToLog('${foodName}', this.closest('.modal'))">
                        Add Food
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    addFoodToLog(foodName, modal) {
        const food = this.foodDatabase[foodName];
        const servings = parseFloat(modal.querySelector('#serving-amount').value);
        const mealType = modal.querySelector('#meal-type').value;

        if (!food || servings <= 0) return;

        // Calculate totals
        const totalCalories = Math.round(food.calories * servings);
        const totalProtein = Math.round(food.protein * servings * 10) / 10;
        const totalCarbs = Math.round(food.carbs * servings * 10) / 10;
        const totalFat = Math.round(food.fat * servings * 10) / 10;

        // Add to food log
        const logEntry = {
            name: foodName,
            servings: servings,
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
            time: new Date().toLocaleTimeString()
        };

        this.foodLog[mealType].push(logEntry);

        // Update totals
        this.consumed += totalCalories;
        this.macros.protein += totalProtein;
        this.macros.carbs += totalCarbs;
        this.macros.fat += totalFat;

        // Save and update display
        this.saveData();
        this.updateDisplay();
        this.updateMealDisplay(mealType);

        // Close modal
        modal.remove();

        // Show success message
        if (window.app) {
            window.app.showSuccess(`Added ${this.capitalizeFood(foodName)} to ${mealType}!`);
        }
    }

    updateDisplay() {
        // Update calorie circle
        const progressElement = document.getElementById('calorie-progress');
        const consumedElement = document.getElementById('calories-consumed');
        const goalElement = document.getElementById('calories-goal');

        if (consumedElement) consumedElement.textContent = this.consumed;
        if (goalElement) goalElement.textContent = this.dailyGoal;

        // Update progress circle
        if (progressElement) {
            const percentage = Math.min((this.consumed / this.dailyGoal) * 100, 100);
            const degrees = (percentage / 100) * 360;
            progressElement.style.background = `conic-gradient(var(--secondary-color) ${degrees}deg, var(--border-color) ${degrees}deg)`;
        }

        // Update macro displays
        document.getElementById('protein-consumed').textContent = Math.round(this.macros.protein) + 'g';
        document.getElementById('carbs-consumed').textContent = Math.round(this.macros.carbs) + 'g';
        document.getElementById('fat-consumed').textContent = Math.round(this.macros.fat) + 'g';

        // Update goal input
        document.getElementById('daily-calorie-goal').value = this.dailyGoal;
    }

    updateMealDisplay(mealType) {
        const container = document.getElementById(`${mealType}-items`);
        const meals = this.foodLog[mealType];

        if (meals.length === 0) {
            container.innerHTML = '<p class="no-items">No items added yet</p>';
        } else {
            container.innerHTML = meals.map(meal => `
                <div class="meal-item">
                    <div>
                        <span class="meal-item-name">${this.capitalizeFood(meal.name)}</span>
                        <small> (${meal.servings} serving${meal.servings !== 1 ? 's' : ''})</small>
                    </div>
                    <span class="meal-item-calories">${meal.calories} cal</span>
                </div>
            `).join('');
        }
    }

    updateGoals() {
        const newGoal = parseInt(document.getElementById('daily-calorie-goal').value);
        
        if (newGoal && newGoal >= 1000 && newGoal <= 5000) {
            this.dailyGoal = newGoal;
            
            // Save to storage manager if available
            if (window.storageManager) {
                window.storageManager.setPreference('dailyCalorieGoal', newGoal);
            }
            
            this.saveData();
            this.updateDisplay();
            
            if (window.app) {
                window.app.showSuccess('Goals updated successfully!');
            }
        } else {
            if (window.app) {
                window.app.showError('Please enter a valid calorie goal between 1000 and 5000.');
            }
        }
    }

    calculateRecommendedCalories() {
        const activityLevel = document.getElementById('activity-level').value;
        
        // Base metabolic rate calculation (simplified)
        let baseCalories = 2000; // Default
        
        const activityMultipliers = {
            'sedentary': 1.2,
            'light': 1.375,
            'moderate': 1.55,
            'very': 1.725
        };
        
        const recommendedCalories = Math.round(baseCalories * activityMultipliers[activityLevel]);
        
        // Update the goal input with recommendation
        document.getElementById('daily-calorie-goal').value = recommendedCalories;
    }

    capitalizeFood(foodName) {
        return foodName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    // Initialize all meal displays
    initializeMealDisplays() {
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            this.updateMealDisplay(mealType);
        });
    }

    // Get daily summary for profile stats
    getDailySummary() {
        return {
            calories: this.consumed,
            goal: this.dailyGoal,
            protein: Math.round(this.macros.protein),
            carbs: Math.round(this.macros.carbs),
            fat: Math.round(this.macros.fat),
            mealsLogged: Object.values(this.foodLog).reduce((total, meals) => total + meals.length, 0)
        };
    }

    // Reset daily data (for new day)
    resetDailyData() {
        this.consumed = 0;
        this.macros = { protein: 0, carbs: 0, fat: 0 };
        this.foodLog = { breakfast: [], lunch: [], dinner: [], snacks: [] };
        this.saveData();
        this.updateDisplay();
        this.initializeMealDisplays();
    }
}

// Export for use in other modules
window.CalorieManager = CalorieManager;