// API client for food recognition and nutritional data
class APIClient {
    constructor() {
        // API endpoints and keys
        this.endpoints = {
            foodAnalysis: 'https://api.logmeal.es/v2/image/foodrecognition',
            nutritionData: 'https://api.logmeal.es/v2/recognition/dish',
            foodSearch: 'https://api.logmeal.es/v2/recognition/dish',
            spoonacular: 'https://api.spoonacular.com'
        };

        // Get API keys from environment or use fallbacks
        this.apiKeys = {
            logmeal: this.getEnvVar('8d04b28e6c63af380c99c6303fe80c550097defa'),
            spoonacular: this.getEnvVar('067692799f01441ca56a8de004ee3a6c'),
            // If you use USDA/FoodData, add: foodData: this.getEnvVar('YOUR_USDA_API_KEY')
        };

        // Initialize retry mechanism
        this.maxRetries = 3;
        this.retryDelay = 1000;

        // Cache for frequently requested data
        this.cache = new Map();
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    }

    getEnvVar(name, fallback) {
        // Try to get from environment variables
        if (typeof process !== 'undefined' && process.env && process.env[name]) {
            return process.env[name];
        }
        // Try to get from window object (if set by server)
        if (typeof window !== 'undefined' && window.ENV && window.ENV[name]) {
            return window.ENV[name];
        }
        return fallback;
    }

    async analyzeFoodImage(imageData) {
        try {
            // First try to identify the food using image recognition
            const identification = await this.identifyFoodFromImage(imageData);
            if (!identification || !identification.foodName) {
                throw new Error('Could not identify food item from image');
            }
            // Get detailed information about the identified food
            const foodData = await this.getFoodDetails(identification.foodName);
            return {
                name: identification.foodName,
                confidence: identification.confidence,
                ...foodData
            };
        } catch (error) {
            console.error('Food analysis error:', error);
            // Fallback to generic food analysis if specific identification fails
            return await this.performClientSideAnalysis(imageData);
        }
    }

    async identifyFoodFromImage(imageData) {
        const cacheKey = `image_${this.hashString(imageData)}`;
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }
        try {
            // Convert base64 to blob for API submission
            const blob = this.base64ToBlob(imageData);
            // Try multiple food recognition services
            let result = await this.tryFoodRecognitionAPIs(blob);
            if (!result) {
                // Fallback to pattern matching or ML inference
                result = await this.performClientSideAnalysis(imageData);
            }
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            return result;
        } catch (error) {
            console.error('Image identification error:', error);
            throw new Error('Failed to identify food from image: ' + error.message);
        }
    }

    async tryFoodRecognitionAPIs(imageBlob) {
        // Try Spoonacular Food API
        try {
            const spoonResult = await this.analyzeWithSpoonacular(imageBlob);
            if (spoonResult) return spoonResult;
        } catch (error) {
            console.warn('Spoonacular API failed:', error);
        }
        // Try LogMeal Food API (main endpoint)
        try {
            const logmealResult = await this.analyzeWithLogMeal(imageBlob);
            if (logmealResult) return logmealResult;
        } catch (error) {
            console.warn('LogMeal API failed:', error);
        }
        // Try LogMeal Food API (alternative, predictions shape)
        try {
            const logmealAltResult = await this.analyzeWithLogMealAlt(imageBlob);
            if (logmealAltResult) return logmealAltResult;
        } catch (error) {
            console.warn('LogMeal Alt API failed:', error);
        }
        return null;
    }

    async analyzeWithSpoonacular(imageBlob) {
        const formData = new FormData();
        formData.append('file', imageBlob, 'food.jpg');
        const response = await this.makeRequest(
            `${this.endpoints.spoonacular}/images/classify`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'X-API-Key': this.apiKeys.spoonacular
                }
            }
        );
        if (response.category && response.probability > 0.5) {
            return {
                foodName: response.category,
                confidence: response.probability
            };
        }
        return null;
    }

    // This is the main LogMeal endpoint (recognition_results shape)
    async analyzeWithLogMeal(imageBlob) {
        const formData = new FormData();
        formData.append('image', imageBlob);
        const response = await fetch(this.endpoints.foodAnalysis, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.logmeal}`
            },
            body: formData
        });
        const data = await response.json();
        if (data && data.recognition_results && data.recognition_results.length > 0) {
            return {
                foodName: data.recognition_results[0].name,
                confidence: data.recognition_results[0].confidence
            };
        }
        return null;
    }

    // This is the alternative LogMeal endpoint (predictions shape)
    async analyzeWithLogMealAlt(imageBlob) {
        const formData = new FormData();
        formData.append('image', imageBlob);
        const response = await this.makeRequest(
            this.endpoints.foodAnalysis,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${this.apiKeys.logmeal}`
                }
            }
        );
        if (response.predictions && response.predictions.length > 0) {
            const topPrediction = response.predictions[0];
            return {
                foodName: topPrediction.name,
                confidence: topPrediction.confidence
            };
        }
        return null;
    }

    async performClientSideAnalysis(imageData) {
        // Fallback client-side analysis using basic image processing
        try {
            const analysis = await this.analyzeImageColors(imageData);
            const prediction = this.predictFoodFromColors(analysis);
            return {
                foodName: prediction.name,
                confidence: prediction.confidence
            };
        } catch (error) {
            console.error('Client-side analysis failed:', error);
            return { foodName: 'Unknown Food', confidence: 0 };
        }
    }

    async analyzeImageColors(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const colors = this.extractDominantColors(imageDataObj);
                resolve({ colors, brightness: this.calculateBrightness(imageDataObj) });
            };
            img.src = imageData;
        });
    }

    extractDominantColors(imageData) {
        const data = imageData.data;
        const colorCount = {};
        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Group similar colors
            const colorKey = `${Math.floor(r/32)*32},${Math.floor(g/32)*32},${Math.floor(b/32)*32}`;
            colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;
        }
        // Get top 5 colors
        return Object.entries(colorCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([color]) => color);
    }

    calculateBrightness(imageData) {
        const data = imageData.data;
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114);
        }
        return totalBrightness / (data.length / 4);
    }

    predictFoodFromColors(analysis) {
        // Simple heuristic-based food prediction
        const { colors } = analysis;
        // Common food color patterns
        const foodPatterns = [
            { name: 'Apple', colors: ['255,0,0', '0,255,0'], confidence: 0.6 },
            { name: 'Banana', colors: ['255,255,0'], confidence: 0.7 },
            { name: 'Orange', colors: ['255,165,0'], confidence: 0.7 },
            { name: 'Tomato', colors: ['255,99,71'], confidence: 0.6 },
            { name: 'Lettuce', colors: ['0,255,0', '50,205,50'], confidence: 0.5 },
            { name: 'Bread', colors: ['245,222,179', '210,180,140'], confidence: 0.4 },
            { name: 'Rice', colors: ['255,255,255', '245,245,220'], confidence: 0.5 },
            { name: 'Chicken', colors: ['255,228,196', '222,184,135'], confidence: 0.5 },
            { name: 'Beef', colors: ['139,69,19'], confidence: 0.5 },
            { name: 'Carrot', colors: ['255,140,0'], confidence: 0.6 },
            { name: 'Egg', colors: ['255,255,224', '255,255,240'], confidence: 0.6 }
        ];

        let bestMatch = { name: 'Unknown Food', confidence: 0.3 };
        for (const pattern of foodPatterns) {
            const matchScore = this.calculateColorMatch(colors, pattern.colors);
            if (matchScore > bestMatch.confidence) {
                bestMatch = {
                    name: pattern.name,
                    confidence: Math.min(matchScore * pattern.confidence, 0.8)
                };
            }
        }
        // Only return a food match if confidence is strong enough
        if (bestMatch.confidence < 0.5) {
            bestMatch = { name: 'Unknown Food', confidence: bestMatch.confidence };
        }
        return bestMatch;
    }

    calculateColorMatch(imageColors, patternColors) {
        let maxMatch = 0;
        for (const patternColor of patternColors) {
            for (const imageColor of imageColors) {
                const similarity = this.colorSimilarity(patternColor, imageColor);
                maxMatch = Math.max(maxMatch, similarity);
            }
        }
        return maxMatch;
    }

    colorSimilarity(color1, color2) {
        const [r1, g1, b1] = color1.split(',').map(Number);
        const [r2, g2, b2] = color2.split(',').map(Number);
        const distance = Math.sqrt(
            Math.pow(r1 - r2, 2) +
            Math.pow(g1 - g2, 2) +
            Math.pow(b1 - b2, 2)
        );
        return 1 - (distance / 441.67); // Max distance is sqrt(3 * 255^2)
    }

    async searchFood(query) {
        const cacheKey = `search_${query.toLowerCase()}`;
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }
        try {
            const foodData = await this.getFoodDetails(query);
            // Cache the result
            this.cache.set(cacheKey, {
                data: foodData,
                timestamp: Date.now()
            });
            return foodData;
        } catch (error) {
            console.error('Food search error:', error);
            throw new Error('Failed to search for food: ' + error.message);
        }
    }

    async getFoodDetails(foodName) {
        try {
            // Get comprehensive food data from multiple sources
            const [nutritionData, ingredientsData, healthData] = await Promise.allSettled([
                this.getNutritionData(foodName),
                this.getIngredientsData(foodName),
                this.getHealthData(foodName)
            ]);
            return {
                name: foodName,
                nutrition: nutritionData.status === 'fulfilled' ? nutritionData.value : {},
                ingredients: ingredientsData.status === 'fulfilled' ? ingredientsData.value : [],
                benefits: healthData.status === 'fulfilled' ? healthData.value.benefits : [],
                warnings: healthData.status === 'fulfilled' ? healthData.value.warnings : []
            };
        } catch (error) {
            console.error('Error getting food details:', error);
            throw new Error('Failed to get food details: ' + error.message);
        }
    }

    async getNutritionData(foodName) {
        try {
            // You may need to provide a real key for USDA FoodData or skip this
            // const searchResponse = await this.makeRequest(
            //     `${this.endpoints.foodSearch}?query=${encodeURIComponent(foodName)}&pageSize=1&api_key=${this.apiKeys.foodData}`
            // );
            // if (searchResponse.foods && searchResponse.foods.length > 0) {
            //     const food = searchResponse.foods[0];
            //     return this.parseNutritionData(food.foodNutrients);
            // }
            // Fallback to Spoonacular nutrition API
            return await this.getSpoonacularNutrition(foodName);
        } catch (error) {
            console.warn('Nutrition data API failed, using fallback:', error);
            return this.getFallbackNutrition(foodName);
        }
    }

    async getSpoonacularNutrition(foodName) {
        const response = await this.makeRequest(
            `${this.endpoints.spoonacular}/ingredients/search?query=${encodeURIComponent(foodName)}&number=1&apiKey=${this.apiKeys.spoonacular}`
        );
        if (response.results && response.results.length > 0) {
            const ingredientId = response.results[0].id;
            const nutritionResponse = await this.makeRequest(
                `${this.endpoints.spoonacular}/ingredients/${ingredientId}/information?amount=100&unit=grams&apiKey=${this.apiKeys.spoonacular}`
            );
            return this.parseSpoonacularNutrition(nutritionResponse.nutrition);
        }
        return {};
    }

    parseNutritionData(nutrients) {
        const nutritionMap = {
            'Energy': 'calories',
            'Protein': 'protein',
            'Carbohydrate, by difference': 'carbs',
            'Total lipid (fat)': 'fat',
            'Fiber, total dietary': 'fiber',
            'Sugars, total including NLEA': 'sugar',
            'Sodium, Na': 'sodium',
            'Potassium, K': 'potassium'
        };
        const nutrition = {};
        for (const nutrient of nutrients) {
            const key = nutritionMap[nutrient.nutrientName];
            if (key) {
                nutrition[key] = nutrient.value;
            }
        }
        return nutrition;
    }

    parseSpoonacularNutrition(nutritionData) {
        const nutrition = {};
        for (const nutrient of nutritionData.nutrients) {
            switch (nutrient.name.toLowerCase()) {
                case 'calories':
                    nutrition.calories = nutrient.amount; break;
                case 'protein':
                    nutrition.protein = nutrient.amount; break;
                case 'carbohydrates':
                    nutrition.carbs = nutrient.amount; break;
                case 'fat':
                    nutrition.fat = nutrient.amount; break;
                case 'fiber':
                    nutrition.fiber = nutrient.amount; break;
                case 'sugar':
                    nutrition.sugar = nutrient.amount; break;
                case 'sodium':
                    nutrition.sodium = nutrient.amount; break;
                case 'potassium':
                    nutrition.potassium = nutrient.amount; break;
            }
        }
        return nutrition;
    }

    getFallbackNutrition(foodName) {
        // Provide basic nutritional estimates for common foods
        const nutritionDatabase = {
            'apple': { calories: 52, carbs: 14, fiber: 2.4, sugar: 10, potassium: 107 },
            'banana': { calories: 89, carbs: 23, fiber: 2.6, sugar: 12, potassium: 358 },
            'orange': { calories: 47, carbs: 12, fiber: 2.4, sugar: 9, potassium: 181 },
            'chicken': { calories: 165, protein: 31, fat: 3.6, sodium: 74 },
            'rice': { calories: 130, carbs: 28, protein: 2.7, fat: 0.3 },
            'bread': { calories: 265, carbs: 49, protein: 9, fat: 3.2, fiber: 2.7 }
        };
        const key = foodName.toLowerCase();
        return nutritionDatabase[key] || {};
    }

    async getIngredientsData(foodName) {
        try {
            // For processed foods, try to get ingredient lists
            const response = await this.makeRequest(
                `${this.endpoints.spoonacular}/products/search?query=${encodeURIComponent(foodName)}&number=1&apiKey=${this.apiKeys.spoonacular}`
            );
            if (response.products && response.products.length > 0) {
                return response.products[0].ingredients || [];
            }
            // For whole foods, return the food itself as the ingredient
            return [foodName];
        } catch (error) {
            console.warn('Ingredients API failed, using fallback:', error);
            return this.getFallbackIngredients(foodName);
        }
    }

    getFallbackIngredients(foodName) {
        // For whole foods, the food itself is the main ingredient
        const wholefoods = ['apple', 'banana', 'orange', 'chicken', 'beef', 'fish', 'rice', 'potato'];
        if (wholefoods.some(food => foodName.toLowerCase().includes(food))) {
            return [foodName];
        }
        // For processed foods, provide common ingredient assumptions
        const processedFoods = {
            'bread': ['Wheat flour', 'Water', 'Yeast', 'Salt', 'Sugar'],
            'pizza': ['Wheat flour', 'Tomatoes', 'Cheese', 'Olive oil', 'Herbs'],
            'pasta': ['Durum wheat', 'Water', 'Eggs'],
            'cookie': ['Flour', 'Sugar', 'Butter', 'Eggs', 'Baking powder']
        };
        for (const [food, ingredients] of Object.entries(processedFoods)) {
            if (foodName.toLowerCase().includes(food)) {
                return ingredients;
            }
        }
        return ['Ingredients not available'];
    }

    async getHealthData(foodName) {
        try {
            // Get health benefits and warnings from nutritional knowledge base
            return this.getHealthKnowledgeBase(foodName);
        } catch (error) {
            console.warn('Health data API failed, using fallback:', error);
            return { benefits: [], warnings: [] };
        }
    }

    getHealthKnowledgeBase(foodName) {
        const healthDatabase = {
            'apple': {
                benefits: [
                    { title: 'Rich in Fiber', description: 'Promotes digestive health and helps maintain healthy cholesterol levels' },
                    { title: 'Antioxidants', description: 'Contains quercetin and other antioxidants that may reduce inflammation' },
                    { title: 'Heart Health', description: 'May help reduce risk of heart disease and stroke' }
                ],
                warnings: [
                    { title: 'Seeds', description: 'Apple seeds contain small amounts of cyanide compounds - avoid eating large quantities of seeds' }
                ]
            },
            'banana': {
                benefits: [
                    { title: 'Potassium Rich', description: 'Excellent source of potassium for heart and muscle function' },
                    { title: 'Energy Boost', description: 'Natural sugars provide quick energy for physical activity' },
                    { title: 'Digestive Health', description: 'Contains prebiotics that support gut health' }
                ],
                warnings: [
                    { title: 'High Sugar Content', description: 'May raise blood sugar levels quickly - diabetics should monitor intake' }
                ]
            },
            'chicken': {
                benefits: [
                    { title: 'High Protein', description: 'Complete protein source essential for muscle maintenance and growth' },
                    { title: 'B Vitamins', description: 'Rich in niacin, B6, and B12 for energy metabolism' },
                    { title: 'Low Saturated Fat', description: 'Lean protein option when skin is removed' }
                ],
                warnings: [
                    { title: 'Food Safety', description: 'Must be cooked to 165°F to prevent foodborne illness' },
                    { title: 'Antibiotic Concerns', description: 'Choose organic or antibiotic-free options when possible' }
                ]
            }
        };
        const key = foodName.toLowerCase();
        return healthDatabase[key] || {
            benefits: [
                { title: 'Nutritional Value', description: 'Provides essential nutrients for overall health' }
            ],
            warnings: [
                { title: 'Allergies', description: 'Check for potential allergens if you have known food sensitivities' }
            ]
        };
    }

    async getFoodSuggestions(query) {
        if (query.length < 2) return [];
        try {
            const response = await this.makeRequest(
                `${this.endpoints.spoonacular}/food/ingredients/autocomplete?query=${encodeURIComponent(query)}&number=5&apiKey=${this.apiKeys.spoonacular}`
            );
            return response.map(item => ({
                name: item.name,
                description: `Click to view nutritional information`
            }));
        } catch (error) {
            console.warn('Suggestions API failed, using fallback:', error);
            return this.getFallbackSuggestions(query);
        }
    }

    getFallbackSuggestions(query) {
        const commonFoods = [
            'Apple', 'Banana', 'Orange', 'Chicken', 'Beef', 'Fish', 'Rice', 'Bread',
            'Pasta', 'Pizza', 'Salad', 'Soup', 'Sandwich', 'Yogurt', 'Cheese',
            'Eggs', 'Milk', 'Cereal', 'Oatmeal', 'Nuts', 'Beans', 'Potato'
        ];
        return commonFoods
            .filter(food => food.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5)
            .map(name => ({
                name,
                description: 'Click to view nutritional information'
            }));
    }

    async makeRequest(url, options = {}) {
        let lastError;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    // Note: 'timeout' is not a standard fetch option, remove if not polyfilled
                    ...options
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                lastError = error;
                console.warn(`API request attempt ${attempt + 1} failed:`, error);
                if (attempt < this.maxRetries - 1) {
                    await this.delay(this.retryDelay * Math.pow(2, attempt));
                }
            }
        }
        throw lastError;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    base64ToBlob(base64Data) {
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/jpeg' });
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    // Cleanup method
    clearCache() {
        this.cache.clear();
    }
}

// Export for use in other modules
window.APIClient = APIClient;
