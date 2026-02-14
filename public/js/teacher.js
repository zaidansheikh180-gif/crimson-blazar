// ═══════════════════════════════════════════════════════════
// SmartTrack AI — Teacher Dashboard Logic
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    let currentSessionId = null;
    let attendanceData = {};
    let allStudents = [];

    // ─── Auth Check ──────────────────────────────────────────
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) throw new Error();
            currentUser = await res.json();
            if (currentUser.role !== 'teacher') {
                window.location.href = '/student.html';
                return;
            }
            document.getElementById('teacherName').textContent = currentUser.name || currentUser.email;
            document.getElementById('teacherAvatar').textContent = (currentUser.name || 'T')[0].toUpperCase();
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
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

            if (btn.dataset.tab === 'sessions') loadSessions();
            if (btn.dataset.tab === 'students') loadStudents();
            if (btn.dataset.tab === 'profile') loadProfile();
        });
    });

    // ─── Create Session ──────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sessionDate').value = today;

    document.getElementById('sessionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('sessionSubject').value;
        const section = document.getElementById('sessionSection').value;
        const date = document.getElementById('sessionDate').value;
        const time_slot = document.getElementById('sessionTime').value;
        const room = document.getElementById('sessionRoom').value;

        try {
            const res = await fetch('/api/teacher/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, section, date, time_slot, room })
            });
            const session = await res.json();
            if (!res.ok) throw new Error(session.error);

            currentSessionId = session.id;
            showToast('Session created!', 'success');

            // Load students for this section
            await loadAttendanceStudents(section, subject, date);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    async function loadAttendanceStudents(section, subject, date) {
        try {
            const res = await fetch(`/api/teacher/students?section=${section}`);
            const students = await res.json();

            document.getElementById('attendanceTitle').textContent = `${subject} — Section ${section} — ${date}`;
            const tbody = document.getElementById('attendanceBody');
            attendanceData = {};

            if (!students.length) {
                tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📭</div><p>No students in Section ${section}</p></div></td></tr>`;
                document.getElementById('attendanceArea').style.display = 'block';
                return;
            }

            tbody.innerHTML = students.map(s => {
                attendanceData[s.id] = 'Present'; // Default
                return `
          <tr data-student-id="${s.id}">
            <td><strong>${s.roll_number}</strong></td>
            <td>${s.name}</td>
            <td>${s.section}</td>
            <td>
              <div class="attendance-toggle">
                <button class="toggle-btn active-present" data-status="Present" data-sid="${s.id}">Present</button>
                <button class="toggle-btn" data-status="Absent" data-sid="${s.id}">Absent</button>
                <button class="toggle-btn" data-status="Late" data-sid="${s.id}">Late</button>
              </div>
            </td>
          </tr>
        `;
            }).join('');

            // Toggle handlers
            tbody.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sid = btn.dataset.sid;
                    const status = btn.dataset.status;
                    attendanceData[sid] = status;

                    // Update button states
                    btn.parentElement.querySelectorAll('.toggle-btn').forEach(b => {
                        b.className = 'toggle-btn';
                    });
                    const cls = status === 'Present' ? 'active-present' : status === 'Absent' ? 'active-absent' : 'active-late';
                    btn.classList.add(cls);
                });
            });

            document.getElementById('attendanceArea').style.display = 'block';
        } catch (err) {
            showToast('Failed to load students', 'error');
        }
    }

    // Mark All Present / Absent
    document.getElementById('markAllPresent').addEventListener('click', () => {
        Object.keys(attendanceData).forEach(id => {
            attendanceData[id] = 'Present';
        });
        document.querySelectorAll('#attendanceBody .toggle-btn').forEach(btn => {
            btn.className = 'toggle-btn';
            if (btn.dataset.status === 'Present') btn.classList.add('active-present');
        });
    });

    document.getElementById('markAllAbsent').addEventListener('click', () => {
        Object.keys(attendanceData).forEach(id => {
            attendanceData[id] = 'Absent';
        });
        document.querySelectorAll('#attendanceBody .toggle-btn').forEach(btn => {
            btn.className = 'toggle-btn';
            if (btn.dataset.status === 'Absent') btn.classList.add('active-absent');
        });
    });

    // Submit Attendance
    document.getElementById('submitAttendanceBtn').addEventListener('click', async () => {
        if (!currentSessionId) {
            showToast('No active session', 'error');
            return;
        }

        const records = Object.entries(attendanceData).map(([student_id, status]) => ({
            student_id: parseInt(student_id),
            status
        }));

        try {
            const res = await fetch('/api/teacher/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, records })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(`Attendance submitted for ${data.count} students!`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── Load Sessions ───────────────────────────────────────
    async function loadSessions() {
        try {
            const res = await fetch('/api/teacher/sessions');
            const sessions = await res.json();
            const tbody = document.getElementById('sessionsBody');

            if (!sessions.length) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📅</div><p>No sessions yet</p></div></td></tr>`;
                return;
            }

            tbody.innerHTML = sessions.map(s => `
        <tr>
          <td>${s.date}</td>
          <td><strong>${s.subject}</strong></td>
          <td>${s.section}</td>
          <td>${s.time_slot || '—'}</td>
          <td>${s.room || '—'}</td>
          <td><button class="btn btn-secondary btn-sm view-session-btn" data-id="${s.id}" data-subject="${s.subject}" data-date="${s.date}">View</button></td>
        </tr>
      `).join('');

            // View session
            tbody.querySelectorAll('.view-session-btn').forEach(btn => {
                btn.addEventListener('click', () => loadSessionDetail(btn.dataset.id, btn.dataset.subject, btn.dataset.date));
            });
        } catch (err) {
            showToast('Failed to load sessions', 'error');
        }
    }

    async function loadSessionDetail(sessionId, subject, date) {
        try {
            const res = await fetch(`/api/teacher/attendance/${sessionId}`);
            const records = await res.json();

            document.getElementById('sessionDetailTitle').textContent = `${subject} — ${date}`;
            const tbody = document.getElementById('sessionDetailBody');

            if (!records.length) {
                tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>No attendance records</p></div></td></tr>`;
            } else {
                tbody.innerHTML = records.map(r => `
          <tr>
            <td><strong>${r.roll_number}</strong></td>
            <td>${r.student_name}</td>
            <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
            <td>${r.marked_at || '—'}</td>
          </tr>
        `).join('');
            }

            document.getElementById('sessionDetail').style.display = 'block';
            document.getElementById('sessionDetail').scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            showToast('Failed to load attendance', 'error');
        }
    }

    // ─── Load Students ───────────────────────────────────────
    async function loadStudents() {
        try {
            const section = document.getElementById('studentFilter').value;
            console.log(`[Data] Loading students for section: ${section || 'All'}`);
            const url = section ? `/api/teacher/students?section=${section}` : '/api/teacher/students';
            const res = await fetch(url);
            const students = await res.json();
            allStudents = students; // Sync with global list for search
            renderStudents(students);
        } catch (err) {
            console.error('[Data] Load error:', err);
            showToast('Failed to load students', 'error');
        }
    }

    function renderStudents(students) {
        console.log(`[UI] Rendering ${students.length} students`);
        const tbody = document.getElementById('studentsBody');
        const searchInput = document.getElementById('studentSearch');
        const search = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = students.filter(s =>
            s.name.toLowerCase().includes(search) ||
            s.roll_number.toLowerCase().includes(search)
        );

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><p>No students found</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${s.roll_number}</strong></td>
        <td>${s.name}</td>
        <td>${s.section}</td>
        <td>${s.email}</td>
        <td>${s.usn || '—'}</td>
        <td>${s.semester || '—'}</td>
        <td>
            <button class="btn btn-secondary btn-sm edit-student-btn" data-id="${s.id}">Edit</button>
        </td>
      </tr>
    `).join('');

        console.log(`[UI] Table innerHTML updated, attaching listeners`);

        // Edit student button listeners
        tbody.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                console.log(`[UI] Edit clicked for ID: ${btn.dataset.id}`);
                const s = students.find(x => x.id == btn.dataset.id);
                if (s) openEditModal(s);
            });
        });
    }

    // Student search & filter
    document.getElementById('studentSearch').addEventListener('input', () => renderStudents(allStudents));
    document.getElementById('studentFilter').addEventListener('change', () => loadStudents());

    // Initial load of all students
    async function initStudents() {
        console.log('[Init] Loading all students');
        await loadStudents();
    }

    // ─── Profile ─────────────────────────────────────────────
    async function loadProfile() {
        try {
            const res = await fetch('/api/teacher/profile');
            const user = await res.json();
            document.getElementById('teacherNameInput').value = user.name;
            document.getElementById('teacherEmailInput').value = user.email;
            document.getElementById('defaultSubject').value = user.default_subject || '';
            document.getElementById('defaultSection').value = user.default_section || '';
        } catch (err) {
            showToast('Failed to load profile', 'error');
        }
    }

    document.getElementById('teacherProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('teacherNameInput').value.trim();
        const default_subject = document.getElementById('defaultSubject').value;
        const default_section = document.getElementById('defaultSection').value;

        try {
            const res = await fetch('/api/teacher/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, default_subject, default_section })
            });
            const user = await res.json();
            if (!res.ok) throw new Error(user.error);

            document.getElementById('teacherName').textContent = user.name || user.email;
            document.getElementById('teacherAvatar').textContent = (user.name || 'T')[0].toUpperCase();
            showToast('Profile updated successfully!', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── Add/Edit Student Modal ──────────────────────────────
    const addStudentModal = document.getElementById('addStudentModal');
    const studentModalTitle = document.getElementById('studentModalTitle');
    const editStudentIdInput = document.getElementById('editStudentId');

    function openEditModal(s) {
        studentModalTitle.textContent = 'Edit Student Details';
        editStudentIdInput.value = s.id;
        document.getElementById('newStudentName').value = s.name;
        document.getElementById('newStudentRoll').value = s.roll_number;
        document.getElementById('newStudentSection').value = s.section || 'A';
        document.getElementById('newStudentUSN').value = s.usn || '';
        document.getElementById('newStudentSemester').value = s.semester || '';
        document.getElementById('newStudentEmail').value = s.email;
        addStudentModal.classList.add('active');
    }

    document.getElementById('addStudentBtn').addEventListener('click', () => {
        studentModalTitle.textContent = 'Add New Student';
        editStudentIdInput.value = '';
        document.getElementById('addStudentForm').reset();
        addStudentModal.classList.add('active');
    });

    document.getElementById('cancelAddStudent').addEventListener('click', () => addStudentModal.classList.remove('active'));
    addStudentModal.addEventListener('click', (e) => { if (e.target === addStudentModal) addStudentModal.classList.remove('active'); });

    document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = editStudentIdInput.value;
        const name = document.getElementById('newStudentName').value.trim();
        const roll_number = document.getElementById('newStudentRoll').value.trim();
        const section = document.getElementById('newStudentSection').value;
        const usn = document.getElementById('newStudentUSN').value.trim();
        const semester = document.getElementById('newStudentSemester').value.trim();
        const email = document.getElementById('newStudentEmail').value.trim();

        const studentData = { name, roll_number, section, email, usn, semester };
        const url = editId ? `/api/teacher/students/${editId}` : '/api/teacher/students';
        const method = editId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showToast(editId ? 'Student updated successfully!' : 'Student added successfully!', 'success');
            addStudentModal.classList.remove('active');
            document.getElementById('addStudentForm').reset();
            loadStudents();
            initStudents(); // Refresh search list too
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ─── Logout ──────────────────────────────────────────────
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });

    // ─── Init ────────────────────────────────────────────────
    checkAuth();
    loadStudents(); // Load and render students immediately
    initStudents(); // Also init allStudents for search
});
