/**
 * Demo script: Staff Shift Scheduler
 *
 * This script demonstrates how the app works by:
 * 1. Starting with the database (already running via docker compose)
 * 2. Creating sample data (skills, employees, shifts)
 * 3. Running a solve to generate a schedule
 * 4. Showing the results
 *
 * Run this after starting the services:
 *   docker compose up -d db
 *   pnpm dev
 *
 * Then run: npx tsx demo.ts
 */

const API_BASE = 'http://localhost:3000/api';

async function main() {
  console.log('🎯 Staff Shift Scheduler — Demo\n');

  // Step 1: Check if the API is running
  console.log('1️⃣  Checking if API is running...');
  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    console.error('❌ API is not running. Start it with: pnpm dev');
    return;
  }
  console.log('✅ API is running\n');

  // Step 2: Register a user and get a JWT token
  console.log('2️⃣  Registering a demo user...');
  const registerRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `demo-${Date.now()}@example.com`,
      password: 'demo1234',
      name: 'Demo User',
    }),
  });

  if (!registerRes.ok) {
    const error = await registerRes.json();
    console.error('❌ Failed to register:', error.message);
    return;
  }

  const { accessToken } = await registerRes.json();
  console.log('✅ User registered! Got JWT token.\n');

  // Helper function for authenticated requests
  const authFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

  // Step 3: Create skills
  console.log('3️⃣  Creating skills...');
  const skills = [
    { name: 'Barista' },
    { name: 'Cashier' },
    { name: 'Chef' },
  ];

  const createdSkills = [];
  for (const skill of skills) {
    const res = await authFetch(`${API_BASE}/skills`, {
      method: 'POST',
      body: JSON.stringify(skill),
    });
    if (res.ok) {
      const created = await res.json();
      createdSkills.push(created);
      console.log(`   ✅ Created skill: ${created.name} (${created.id})`);
    } else {
      const error = await res.json();
      console.log(`   ⚠️  Skill "${skill.name}" may already exist: ${error.message}`);
      // Try to get existing skill
      const existing = await fetch(`${API_BASE}/skills`);
      const allSkills = await existing.json();
      const found = allSkills.find((s: { name: string }) => s.name === skill.name);
      if (found) createdSkills.push(found);
    }
  }
  console.log('');

  // Step 4: Create employees with skills and availability
  console.log('4️⃣  Creating employees...');
  const employees = [
    {
      name: 'Alice',
      contractMaxMinutes: 2400, // 40 hours/week
      skillIds: [createdSkills[0].id, createdSkills[1].id], // Barista + Cashier
      availability: [
        { day: 0, startMinute: 480, endMinute: 1020 }, // Mon 8am-5pm
        { day: 1, startMinute: 480, endMinute: 1020 }, // Tue 8am-5pm
        { day: 2, startMinute: 480, endMinute: 1020 }, // Wed 8am-5pm
        { day: 3, startMinute: 480, endMinute: 1020 }, // Thu 8am-5pm
        { day: 4, startMinute: 480, endMinute: 1020 }, // Fri 8am-5pm
      ],
    },
    {
      name: 'Bob',
      contractMaxMinutes: 1200, // 20 hours/week (part-time)
      skillIds: [createdSkills[1].id], // Cashier only
      availability: [
        { day: 0, startMinute: 480, endMinute: 720 },  // Mon 8am-12pm
        { day: 1, startMinute: 480, endMinute: 720 },  // Tue 8am-12pm
        { day: 2, startMinute: 480, endMinute: 720 },  // Wed 8am-12pm
        { day: 3, startMinute: 480, endMinute: 720 },  // Thu 8am-12pm
        { day: 4, startMinute: 480, endMinute: 720 },  // Fri 8am-12pm
      ],
    },
    {
      name: 'Charlie',
      contractMaxMinutes: 2400, // 40 hours/week
      skillIds: [createdSkills[2].id], // Chef only
      availability: [
        { day: 0, startMinute: 600, endMinute: 1200 }, // Mon 10am-8pm
        { day: 1, startMinute: 600, endMinute: 1200 }, // Tue 10am-8pm
        { day: 2, startMinute: 600, endMinute: 1200 }, // Wed 10am-8pm
        { day: 3, startMinute: 600, endMinute: 1200 }, // Thu 10am-8pm
        { day: 4, startMinute: 600, endMinute: 1200 }, // Fri 10am-8pm
        { day: 5, startMinute: 600, endMinute: 1020 }, // Sat 10am-5pm
      ],
    },
  ];

  const createdEmployees = [];
  for (const emp of employees) {
    const res = await authFetch(`${API_BASE}/employees`, {
      method: 'POST',
      body: JSON.stringify(emp),
    });
    if (res.ok) {
      const created = await res.json();
      createdEmployees.push(created);
      console.log(`   ✅ Created employee: ${created.name} (${created.id})`);
      console.log(`      Skills: ${created.skillIds.length}, Max hours: ${created.contractMaxMinutes / 60}h/week`);
    } else {
      const error = await res.json();
      console.log(`   ❌ Failed to create ${emp.name}: ${error.message}`);
    }
  }
  console.log('');

  // Step 5: Create shifts
  console.log('5️⃣  Creating shifts...');
  const shifts = [
    {
      day: 0, // Monday
      startMinute: 480,  // 8am
      endMinute: 720,    // 12pm
      headcount: 1,
      requiredSkillIds: [createdSkills[0].id], // Needs Barista
    },
    {
      day: 0, // Monday
      startMinute: 720,  // 12pm
      endMinute: 1020,   // 5pm
      headcount: 1,
      requiredSkillIds: [createdSkills[1].id], // Needs Cashier
    },
    {
      day: 1, // Tuesday
      startMinute: 600,  // 10am
      endMinute: 1200,   // 8pm
      headcount: 1,
      requiredSkillIds: [createdSkills[2].id], // Needs Chef
    },
    {
      day: 5, // Saturday
      startMinute: 600,  // 10am
      endMinute: 1020,   // 5pm
      headcount: 1,
      requiredSkillIds: [createdSkills[2].id], // Needs Chef
    },
  ];

  const createdShifts = [];
  for (const shift of shifts) {
    const res = await authFetch(`${API_BASE}/shifts`, {
      method: 'POST',
      body: JSON.stringify(shift),
    });
    if (res.ok) {
      const created = await res.json();
      createdShifts.push(created);
      const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][created.day];
      const startTime = `${Math.floor(created.startMinute / 60)}:${(created.startMinute % 60).toString().padStart(2, '0')}`;
      const endTime = `${Math.floor(created.endMinute / 60)}:${(created.endMinute % 60).toString().padStart(2, '0')}`;
      console.log(`   ✅ Created shift: ${dayName} ${startTime}-${endTime} (${created.id})`);
    } else {
      const error = await res.json();
      console.log(`   ❌ Failed to create shift: ${error.message}`);
    }
  }
  console.log('');

  // Step 6: Run the solver
  console.log('6️⃣  Running the solver...');
  console.log('   (This sends the problem to the optimizer, which finds the best assignment)\n');

  const solveRes = await authFetch(`${API_BASE}/solves`, {
    method: 'POST',
    body: JSON.stringify({
      employees: createdEmployees,
      shifts: createdShifts,
    }),
  });

  if (!solveRes.ok) {
    const error = await solveRes.json();
    console.error('❌ Solve failed:', error.message);
    return;
  }

  const solveJob = await solveRes.json();
  console.log(`   ✅ Solve accepted! Job ID: ${solveJob.jobId}`);
  console.log(`   Status: ${solveJob.status}\n`);

  // Step 7: Poll for results
  console.log('7️⃣  Waiting for solver to finish...');
  let result = null;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const pollRes = await fetch(`${API_BASE}/solves/${solveJob.jobId}`);
    const pollData = await pollRes.json();

    if (pollData.status === 'optimal' || pollData.status === 'feasible') {
      result = pollData;
      break;
    } else if (pollData.status === 'infeasible') {
      console.log('   ❌ Solver found no feasible solution!');
      console.log('   Conflicts:', pollData.result.conflicts);
      return;
    } else if (pollData.status === 'failed') {
      console.log('   ❌ Solve failed:', pollData.message);
      return;
    }
    attempts++;
  }

  if (!result) {
    console.log('   ⏰ Solver timed out (took too long)');
    return;
  }

  console.log(`   ✅ Solver finished! Status: ${result.status}`);
  console.log(`   Objective value: ${result.result.objectiveValue}\n`);

  // Step 8: Display the schedule
  console.log('8️⃣  📅 Generated Schedule:\n');
  console.log('   ┌─────────┬───────────────┬───────────────┬─────────────┐');
  console.log('   │   Day   │    Shift      │   Employee    │    Skills   │');
  console.log('   ├─────────┼───────────────┼───────────────┼─────────────┤');

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (const assignment of result.result.assignments) {
    const shift = createdShifts.find((s: { id: string }) => s.id === assignment.shiftId);
    const employee = createdEmployees.find((e: { id: string }) => e.id === assignment.employeeId);

    if (shift && employee) {
      const day = dayNames[shift.day].padEnd(9);
      const startTime = `${Math.floor(shift.startMinute / 60)}:${(shift.startMinute % 60).toString().padStart(2, '0')}`;
      const endTime = `${Math.floor(shift.endMinute / 60)}:${(shift.endMinute % 60).toString().padStart(2, '0')}`;
      const time = `${startTime}-${endTime}`.padEnd(13);
      const name = employee.name.padEnd(13);
      const skills = employee.skillIds.length.toString().padEnd(11);

      console.log(`   │ ${day} │ ${time} │ ${name} │ ${skills} │`);
    }
  }

  console.log('   └─────────┴───────────────┴───────────────┴─────────────┘\n');

  // Summary
  console.log('📊 Summary:');
  console.log(`   • ${createdSkills.length} skills created`);
  console.log(`   • ${createdEmployees.length} employees created`);
  console.log(`   • ${createdShifts.length} shifts created`);
  console.log(`   • ${result.result.assignments.length} assignments made`);
  console.log(`   • Solver status: ${result.status}`);
  console.log(`   • Objective value: ${result.result.objectiveValue} (lower is better)\n`);

  console.log('🌐 View in the web UI:');
  console.log('   • Skills:    http://localhost:5173/skills');
  console.log('   • Employees: http://localhost:5173/employees');
  console.log('   • Shifts:    http://localhost:5173/shifts');
  console.log('   • Schedule:  http://localhost:5173/schedule\n');

  console.log('📚 What I learned:');
  console.log('   • The API uses REST endpoints (GET/POST/PATCH/DELETE) to manage data');
  console.log('   • The solver runs asynchronously — you get a job ID immediately');
  console.log('   • You poll the job ID until the solver finishes');
  console.log('   • The solver respects constraints: skills, availability, max hours');
  console.log('   • The objective value represents the "cost" of the schedule');
}

main().catch(console.error);
