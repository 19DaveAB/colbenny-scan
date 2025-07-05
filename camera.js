// Camera management functionality
class CameraManager {
    constructor() {
        this.stream = null;
        this.videoElement = document.getElementById('camera-feed');
        this.canvasElement = document.getElementById('capture-canvas');
        this.startBtn = document.getElementById('start-camera');
        this.captureBtn = document.getElementById('capture-photo');
        this.stopBtn = document.getElementById('stop-camera');
        this.isActive = false;
        
        this.setupCameraConstraints();
    }

    setupCameraConstraints() {
        // Prefer back camera on mobile devices
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: { ideal: 'environment' }, // Back camera
                aspectRatio: { ideal: 16/9 }
            },
            audio: false
        };

        // Fallback constraints for devices without back camera
        this.fallbackConstraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };
    }

    async startCamera() {
        try {
            // Check if camera is already active
            if (this.isActive) {
                return;
            }

            // Check for getUserMedia support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access is not supported in this browser');
            }

            // Request camera permission and start stream
            await this.requestCameraPermission();
            
            // Update UI
            this.updateCameraUI(true);
            this.isActive = true;

        } catch (error) {
            console.error('Camera start error:', error);
            this.handleCameraError(error);
        }
    }

    async requestCameraPermission() {
        try {
            // Try with ideal constraints first
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
        } catch (error) {
            console.warn('Failed with ideal constraints, trying fallback:', error);
            
            try {
                // Fallback to basic constraints
                this.stream = await navigator.mediaDevices.getUserMedia(this.fallbackConstraints);
            } catch (fallbackError) {
                throw new Error('Camera access denied or not available: ' + fallbackError.message);
            }
        }

        // Set up video stream
        this.videoElement.srcObject = this.stream;
        this.videoElement.play();

        // Wait for video to be ready
        return new Promise((resolve, reject) => {
            this.videoElement.onloadedmetadata = () => {
                resolve();
            };
            
            this.videoElement.onerror = () => {
                reject(new Error('Failed to load video stream'));
            };
            
            // Timeout after 10 seconds
            setTimeout(() => {
                reject(new Error('Camera initialization timeout'));
            }, 10000);
        });
    }

    stopCamera() {
        try {
            if (this.stream) {
                // Stop all tracks
                this.stream.getTracks().forEach(track => {
                    track.stop();
                });
                this.stream = null;
            }

            // Clear video element
            this.videoElement.srcObject = null;
            
            // Update UI
            this.updateCameraUI(false);
            this.isActive = false;

        } catch (error) {
            console.error('Error stopping camera:', error);
        }
    }

    capturePhoto() {
        if (!this.isActive || !this.stream) {
            throw new Error('Camera is not active');
        }

        try {
            // Set canvas size to match video
            const canvas = this.canvasElement;
            const video = this.videoElement;
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current video frame to canvas
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to base64 data URL
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Add visual feedback
            this.showCaptureEffect();
            
            return imageData;

        } catch (error) {
            throw new Error('Failed to capture photo: ' + error.message);
        }
    }
    
    showCaptureEffect() {
        // Create flash effect
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            opacity: 0.8;
            z-index: 9999;
            pointer-events: none;
            animation: flashEffect 0.3s ease-out;
        `;

        // Add flash animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes flashEffect {
                0% { opacity: 0; }
                50% { opacity: 0.8; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(flash);
        
        // Remove flash element after animation
        setTimeout(() => {
            flash.remove();
            style.remove();
        }, 300);

        // Add capture sound effect (if audio context is available)
        this.playCaptureSound();
    }

    playCaptureSound() {
        try {
            // Create audio context for capture sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a simple beep sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            
        } catch (error) {
            // Ignore audio errors - not critical
            console.log('Audio context not available for capture sound');
        }
    }

    updateCameraUI(isActive) {
        if (isActive) {
            this.videoElement.style.display = 'block';
            this.startBtn.style.display = 'none';
            this.captureBtn.style.display = 'inline-flex';
            this.stopBtn.style.display = 'inline-flex';
            
            // Hide scan frame when camera is active
            const scanFrame = document.querySelector('.camera-overlay');
            if (scanFrame) {
                scanFrame.style.display = 'none';
            }
        } else {
            this.videoElement.style.display = 'none';
            this.startBtn.style.display = 'inline-flex';
            this.captureBtn.style.display = 'none';
            this.stopBtn.style.display = 'none';
            
            // Show scan frame when camera is inactive
            const scanFrame = document.querySelector('.camera-overlay');
            if (scanFrame) {
                scanFrame.style.display = 'block';
            }
        }
    }

    handleCameraError(error) {
        let errorMessage = 'Camera error occurred';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera is not supported in this browser.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use by another application.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        // Display error to user
        if (window.app) {
            window.app.showError(errorMessage);
        }

        // Reset UI state
        this.updateCameraUI(false);
        this.isActive = false;
    }

    // Get available cameras for selection
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            return videoDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`
            }));
        } catch (error) {
            console.error('Error getting camera devices:', error);
            return [];
        }
    }

    // Switch to specific camera
    async switchCamera(deviceId) {
        if (this.isActive) {
            this.stopCamera();
        }

        // Update constraints with specific device
        this.constraints.video.deviceId = { exact: deviceId };
        
        await this.startCamera();
    }

    // Check if device has multiple cameras
    async hasMultipleCameras() {
        const cameras = await this.getAvailableCameras();
        return cameras.length > 1;
    }

    // Cleanup method
    destroy() {
        this.stopCamera();
        
        // Remove event listeners if any were added
        if (this.videoElement) {
            this.videoElement.removeEventListener('loadedmetadata', null);
            this.videoElement.removeEventListener('error', null);
        }
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
