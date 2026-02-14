const http = require('http');

function apiRequest(method, path, body, cookie) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (cookie) headers['Cookie'] = cookie;
        if (data) headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                const setCookie = res.headers['set-cookie'];
                resolve({ status: res.statusCode, body: JSON.parse(body || '{}'), cookie: setCookie });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function test() {
    console.log('═══ SmartTrack AI — API Tests ═══\n');

    // 1. Teacher Login
    console.log('1. Teacher Login...');
    const login = await apiRequest('POST', '/api/auth/login', { email: 'teacher@college.edu', password: 'teacher123' });
    console.log(`   Status: ${login.status} | Role: ${login.body.role} | Name: ${login.body.name}`);
    const teacherCookie = login.cookie?.[0]?.split(';')[0] || '';
    console.log(`   Cookie: ${teacherCookie ? '✅' : '❌'}\n`);

    // 2. Teacher Profile
    console.log('2. Teacher Profile...');
    const profile = await apiRequest('GET', '/api/teacher/profile', null, teacherCookie);
    console.log(`   Status: ${profile.status} | Name: ${profile.body.name} | Default Subject: ${profile.body.default_subject || 'None'}`);

    console.log('   Updating Profile...');
    const updateProfile = await apiRequest('PUT', '/api/teacher/profile', { name: 'Prof. Anjali Sharma', default_subject: 'AIML Lab', default_section: 'B' }, teacherCookie);
    console.log(`   Status: ${updateProfile.status} | New Name: ${updateProfile.body.name} | New Subject: ${updateProfile.body.default_subject}`);
    console.log(`   Update Success: ${updateProfile.body.name === 'Prof. Anjali Sharma' ? '✅' : '❌'}\n`);

    // 3. List Students
    console.log('3. List Students...');
    const students = await apiRequest('GET', '/api/teacher/students', null, teacherCookie);
    console.log(`   Status: ${students.status} | Count: ${students.body.length}\n`);

    // 4. List Sessions
    console.log('4. List Sessions...');
    const sessions = await apiRequest('GET', '/api/teacher/sessions', null, teacherCookie);
    console.log(`   Status: ${sessions.status} | Count: ${sessions.body.length}\n`);

    // 5. Student Login
    console.log('5. Student Login...');
    const sLogin = await apiRequest('POST', '/api/auth/login', { email: 'student1@college.edu', password: 'student123' });
    console.log(`   Status: ${sLogin.status} | Role: ${sLogin.body.role} | Name: ${sLogin.body.name}`);
    const studentCookie = sLogin.cookie?.[0]?.split(';')[0] || '';
    console.log(`   Cookie: ${studentCookie ? '✅' : '❌'}\n`);

    // 6. Student Dashboard
    console.log('6. Student Dashboard...');
    const dash = await apiRequest('GET', '/api/student/dashboard', null, studentCookie);
    console.log(`   Status: ${dash.status} | Overall: ${dash.body.overallPercentage}% | Trend: ${dash.body.trendScore}%`);
    console.log(`   Comment: ${dash.body.trendComment} | Subjects: ${dash.body.subjectStats?.length}\n`);

    // 7. Student Attendance
    console.log('7. Student Attendance (week)...');
    const att = await apiRequest('GET', '/api/student/attendance?period=week', null, studentCookie);
    console.log(`   Status: ${att.status} | Records: ${att.body.length}\n`);

    // 8. Student Profile
    console.log('8. Student Profile...');
    const sProfile = await apiRequest('GET', '/api/student/profile', null, studentCookie);
    console.log(`   Status: ${sProfile.status} | Name: ${sProfile.body.name} | Roll: ${sProfile.body.roll_number} | Section: ${sProfile.body.section}\n`);

    // 9. Upcoming Classes
    console.log('9. Upcoming Classes...');
    const upcoming = await apiRequest('GET', '/api/student/upcoming', null, studentCookie);
    console.log(`   Status: ${upcoming.status} | Classes: ${upcoming.body.length}\n`);

    // 10. Auth guard (unauthorized)
    console.log('10. Auth Guard (no cookie)...');
    const unauth = await apiRequest('GET', '/api/teacher/students', null, '');
    console.log(`   Status: ${unauth.status} | Error: ${unauth.body.error}\n`);

    // 11. Face Login Flow
    console.log('11. Face Login Flow...');
    const dummyDescriptor = Array(128).fill(0.1); // Dummy face descriptor

    // Register Face
    console.log('   Registering Face...');
    const regFace = await apiRequest('POST', '/api/student/face-register', { descriptor: dummyDescriptor }, studentCookie);
    console.log(`   Register Status: ${regFace.status} | Success: ${regFace.body.success}`);

    // Login with Face
    console.log('   Logging in with Face...');
    const faceLogin = await apiRequest('POST', '/api/auth/login-face', { descriptor: dummyDescriptor });
    console.log(`   Login Status: ${faceLogin.status} | Name: ${faceLogin.body.name}`);
    console.log(`   Face Login Success: ${faceLogin.body.name === 'Aarav Patel' ? '✅' : '❌'}\n`);

    console.log('═══ All Tests Complete ═══');
}

test().catch(err => console.error('Test error:', err));
