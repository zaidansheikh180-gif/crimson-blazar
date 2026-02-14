// ═══════════════════════════════════════════════════════════
// SmartTrack AI — Student Dashboard Logic
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let studentProfile = null;

    // ─── Auth Check ──────────────────────────────────────────
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) throw new Error();
            currentUser = await res.json();
            if (currentUser.role !== 'student') {
                window.location.href = '/teacher.html';
                return;
            }
            document.getElementById('studentNameNav').textContent = currentUser.name || currentUser.email;
            document.getElementById('avatarPlaceholder').textContent = (currentUser.name || 'S')[0].toUpperCase();

            // Load everything
            await Promise.all([loadDashboard(), loadProfile(), loadAttendance('today'), loadUpcoming()]);
        } catch {
            window.location.href = '/login.html';
        }
    }

    // ─── Toast ───────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ─── Tabs ────────────────────────────────────────────────
    document.querySelectorAll('.tabs').forEach(tabGroup => {
        tabGroup.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Handle period tabs
                if (btn.dataset.period) {
                    tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    loadAttendance(btn.dataset.period);
                    return;
                }

                // Handle main tabs
                if (btn.dataset.tab) {
                    document.querySelectorAll('.tabs .tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
                }
            });
        });
    });

    // ─── Dashboard ───────────────────────────────────────────
    async function loadDashboard() {
        try {
            const res = await fetch('/api/student/dashboard');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Overall Percentage
            const pct = data.overallPercentage;
            document.getElementById('overallPct').textContent = `${pct}%`;
            const bar = document.getElementById('overallBar');
            bar.style.width = `${pct}%`;
            bar.className = `progress-fill ${pct >= 75 ? 'green' : pct >= 60 ? 'yellow' : 'red'}`;

            // Total classes
            document.getElementById('totalClasses').textContent = data.totalClasses;

            // Trend
            document.getElementById('trendScore').textContent = `${data.trendScore}%`;
            const trendBadge = document.getElementById('trendBadge');
            trendBadge.textContent = data.trendComment;
            if (data.trendComment.includes('up')) {
                trendBadge.style.background = 'var(--success-bg)';
                trendBadge.style.color = 'var(--success)';
            } else if (data.trendComment.includes('dipping')) {
                trendBadge.style.background = 'var(--danger-bg)';
                trendBadge.style.color = 'var(--danger)';
            }

            // Shortage
            document.getElementById('shortageCount').textContent = data.shortageSubjects.length;
            if (data.shortageSubjects.length > 0) {
                document.getElementById('shortageSection').style.display = 'block';
                document.getElementById('shortageList').innerHTML = data.shortageSubjects.map(s => `
          <div class="shortage-item">
            <span class="shortage-subject">${s.subject}</span>
            <span class="shortage-pct">${s.percentage}% (${s.present}/${s.total})</span>
          </div>
        `).join('');
            }

            // Subject Stats
            const statsContainer = document.getElementById('subjectStats');
            if (data.subjectStats.length) {
                statsContainer.innerHTML = data.subjectStats.map(s => {
                    const barColor = s.percentage >= 75 ? 'green' : s.percentage >= 60 ? 'yellow' : 'red';
                    return `
            <div style="margin-bottom:16px;">
              <div class="flex-between" style="margin-bottom:4px;">
                <span style="font-weight:600; font-size:0.9rem;">${s.subject}</span>
                <span style="font-size:0.85rem; color:var(--text-secondary);">${s.percentage}% (${s.present}/${s.total})</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${barColor}" style="width:${s.percentage}%"></div>
              </div>
            </div>
          `;
                }).join('');
            } else {
                statsContainer.innerHTML = '<div class="empty-state"><p>No attendance data yet</p></div>';
            }

        } catch (err) {
            showToast('Failed to load dashboard', 'error');
        }
    }

    // ─── Attendance Records ──────────────────────────────────
    async function loadAttendance(period) {
        try {
            const res = await fetch(`/api/student/attendance?period=${period}`);
            const records = await res.json();
            const tbody = document.getElementById('attendanceBody');

            if (!records.length) {
                tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📭</div><p>No attendance records for this period</p></div></td></tr>`;
                return;
            }

            tbody.innerHTML = records.map(r => `
        <tr>
          <td>${r.date}</td>
          <td><strong>${r.subject}</strong></td>
          <td>${r.time_slot || '—'}</td>
          <td>${r.room || '—'}</td>
          <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
      `).join('');
        } catch (err) {
            showToast('Failed to load attendance records', 'error');
        }
    }

    // ─── Profile ─────────────────────────────────────────────
    async function loadProfile() {
        try {
            const res = await fetch('/api/student/profile');
            const profile = await res.json();
            if (!res.ok) throw new Error(profile.error);

            studentProfile = profile;

            document.getElementById('profileName').textContent = profile.name;
            document.getElementById('profileRoll').textContent = profile.roll_number;
            document.getElementById('profileSection').textContent = profile.section;
            document.getElementById('profileEmail').textContent = profile.email;
            document.getElementById('profileUsn').value = profile.usn || '';
            document.getElementById('profileSemester').value = profile.semester || '';
            document.getElementById('profilePhotoPlaceholder').textContent = profile.name[0].toUpperCase();

            if (profile.photo_url) {
                const profileImg = document.getElementById('profilePhoto');
                profileImg.src = profile.photo_url;
                profileImg.style.display = 'block';
                document.getElementById('profilePhotoPlaceholder').style.display = 'none';

                // Nav avatar
                const navImg = document.getElementById('avatarImg');
                navImg.src = profile.photo_url;
                navImg.style.display = 'block';
                document.getElementById('avatarPlaceholder').style.display = 'none';
                document.getElementById('avatarLink').href = profile.photo_url;
            }
        } catch (err) {
            showToast('Failed to load profile', 'error');
        }
    }

    // Save profile
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const usn = document.getElementById('profileUsn').value.trim();
        const semester = document.getElementById('profileSemester').value;

        try {
            const res = await fetch('/api/student/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usn, semester })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast('Profile updated successfully!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Photo upload
    document.getElementById('photoInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await fetch('/api/student/profile/photo', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Update profile photo
            const profileImg = document.getElementById('profilePhoto');
            profileImg.src = data.photo_url + '?t=' + Date.now();
            profileImg.style.display = 'block';
            document.getElementById('profilePhotoPlaceholder').style.display = 'none';

            // Update nav avatar
            const navImg = document.getElementById('avatarImg');
            navImg.src = data.photo_url + '?t=' + Date.now();
            navImg.style.display = 'block';
            document.getElementById('avatarPlaceholder').style.display = 'none';
            document.getElementById('avatarLink').href = data.photo_url;

            showToast('Photo uploaded!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── Upcoming Classes ────────────────────────────────────
    async function loadUpcoming() {
        try {
            const res = await fetch('/api/student/upcoming');
            const classes = await res.json();
            const container = document.getElementById('upcomingList');

            if (!classes.length) {
                container.innerHTML = `<div class="glass-card empty-state"><div class="empty-icon">📅</div><p>No upcoming classes</p></div>`;
                return;
            }

            container.innerHTML = classes.map(c => {
                const d = new Date(c.date);
                const day = d.getDate();
                const month = d.toLocaleString('en', { month: 'short' });
                const dayName = d.toLocaleString('en', { weekday: 'short' });

                return `
          <div class="glass-card upcoming-card" style="margin-bottom:12px;">
            <div class="date-badge">
              <div class="day">${day}</div>
              <div class="month">${month}</div>
            </div>
            <div class="class-details">
              <div class="class-subject">${c.subject}</div>
              <div class="class-meta">${dayName} · ${c.time_slot || '—'} · ${c.room || '—'} · ${c.faculty || '—'}</div>
            </div>
            ${c.notes ? `<div class="class-note">📝 ${c.notes}</div>` : ''}
          </div>
        `;
            }).join('');
        } catch (err) {
            showToast('Failed to load upcoming classes', 'error');
        }
    }

    // ─── Logout ──────────────────────────────────────────────
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });

    // ─── Face Login Setup ────────────────────────────────────
    const video = document.getElementById('videoInput');
    const startBtn = document.getElementById('startFaceSetupBtn');
    const captureBtn = document.getElementById('captureFaceBtn');
    const status = document.getElementById('faceStatus');
    let isModelsLoaded = false;

    // Load models
    async function loadModels() {
        try {
            status.textContent = 'Loading AI models...';
            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
            isModelsLoaded = true;
            status.textContent = 'Models loaded. Click "Enable Camera" to start.';
            startBtn.disabled = false;
            startBtn.textContent = 'Enable Camera';
        } catch (err) {
            console.error(err);
            status.textContent = 'Failed to load AI models. Check console.';
        }
    }

    startBtn.addEventListener('click', async () => {
        if (!isModelsLoaded) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
            video.style.display = 'block';
            startBtn.style.display = 'none';
            captureBtn.style.display = 'inline-block';
            status.textContent = 'Starting camera...';

            video.addEventListener('play', () => {
                status.textContent = 'Detecting face... Please look at the camera.';
                setInterval(async () => {
                    if (video.paused || video.ended) return;
                    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
                    if (detections) {
                        status.textContent = 'Face detected! Click "Capture & Register"';
                        captureBtn.disabled = false;
                        captureBtn.classList.remove('btn-secondary');
                        captureBtn.classList.add('btn-success');
                    } else {
                        status.textContent = 'No face detected. Adjust lighting or position.';
                        captureBtn.disabled = true;
                        captureBtn.classList.remove('btn-success');
                        captureBtn.classList.add('btn-secondary');
                    }
                }, 1000);
            });
        } catch (err) {
            status.textContent = 'Camera access denied or error.';
        }
    });

    captureBtn.addEventListener('click', async () => {
        status.textContent = 'Processing...';
        const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (!detections) {
            showToast('No face detected during capture', 'error');
            return;
        }

        try {
            const res = await fetch('/api/student/face-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descriptor: Array.from(detections.descriptor) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast('Face ID registered successfully!', 'success');
            status.textContent = 'Face ID registered! You can now use Face Login.';

            // Stop camera
            video.srcObject.getTracks().forEach(track => track.stop());
            video.style.display = 'none';
            captureBtn.style.display = 'none';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── Init ────────────────────────────────────────────────
    checkAuth();
    loadModels();
});
