// ═══════════════════════════════════════════════════════════
// SmartTrack AI — Login Page Logic
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    let selectedRole = 'teacher';

    // Role Toggle
    const roleTeacher = document.getElementById('roleTeacher');
    const roleStudent = document.getElementById('roleStudent');
    const faceSection = document.getElementById('faceLoginSection');

    roleTeacher.addEventListener('click', () => {
        selectedRole = 'teacher';
        roleTeacher.classList.add('active');
        roleStudent.classList.remove('active');
        faceSection.style.display = 'none';
    });

    roleStudent.addEventListener('click', () => {
        selectedRole = 'student';
        roleStudent.classList.add('active');
        roleTeacher.classList.remove('active');
        faceSection.style.display = 'block';
    });

    // Login Form
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        loginBtn.textContent = 'Signing in...';
        loginBtn.disabled = true;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Redirect based on role
            if (data.role === 'teacher') {
                window.location.href = '/teacher.html';
            } else {
                window.location.href = '/student.html';
            }
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        }
    });

    // ─── Face Login ──────────────────────────────────────────
    const startFaceBtn = document.getElementById('startFaceLoginBtn');
    const loginVideo = document.getElementById('loginVideo');
    const loginStatus = document.getElementById('loginStatus');
    let isModelsLoaded = false;
    let isCameraRunning = false;

    async function loadModels() {
        if (isModelsLoaded) return;
        try {
            startFaceBtn.textContent = 'Loading AI models...';
            // Load from /models
            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
            isModelsLoaded = true;
            startFaceBtn.disabled = false;
            startFaceBtn.textContent = 'Enable Face Login';
        } catch (err) {
            console.error(err);
            startFaceBtn.textContent = 'Failed to load AI';
        }
    }

    roleStudent.addEventListener('click', () => {
        loadModels();
    });

    startFaceBtn.addEventListener('click', async () => {
        if (!isModelsLoaded) return;

        try {
            document.getElementById('faceLoginContainer').style.display = 'block';
            startFaceBtn.style.display = 'none';
            loginStatus.textContent = 'Starting camera...';

            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            loginVideo.srcObject = stream;
            isCameraRunning = true;

            loginVideo.addEventListener('play', () => {
                loginStatus.textContent = 'Looking for face...';

                const interval = setInterval(async () => {
                    if (!isCameraRunning || loginVideo.paused || loginVideo.ended) {
                        clearInterval(interval);
                        return;
                    }

                    const detection = await faceapi.detectSingleFace(loginVideo, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (detection) {
                        loginStatus.textContent = 'Verifying face...';
                        isCameraRunning = false;
                        clearInterval(interval);

                        // Stop camera
                        loginVideo.pause();
                        loginVideo.srcObject.getTracks().forEach(track => track.stop());

                        // Send descriptor to server
                        try {
                            const res = await fetch('/api/auth/login-face', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ descriptor: Array.from(detection.descriptor) })
                            });
                            const data = await res.json();

                            if (res.ok) {
                                loginStatus.textContent = `Welcome, ${data.name}!`;
                                loginStatus.style.color = 'var(--success)';
                                setTimeout(() => window.location.href = '/student.html', 1000);
                            } else {
                                throw new Error(data.error);
                            }
                        } catch (err) {
                            loginStatus.textContent = err.message || 'Face not recognized';
                            loginStatus.style.color = 'var(--danger)';
                            startFaceBtn.style.display = 'block';
                            startFaceBtn.textContent = 'Try Again';
                            isCameraRunning = false;
                        }
                    }
                }, 1000);
            });
        } catch (err) {
            loginStatus.textContent = 'Camera access denied';
            startFaceBtn.style.display = 'block';
        }
    });
});
