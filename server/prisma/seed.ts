import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash('Rhyme@2026', 12);

async function upsertUser(email: string, role: Role, firstName: string, lastName: string, extra: { registrationNo?: string; staffNo?: string; programmeId?: string; yearId?: string; semesterId?: string } = {}) {
  const existing = await prisma.user.findUnique({ where: { email }, include: { learner: true, lecturer: true, profile: true } });
  if (existing) {
    // Preserve account credentials, profile edits, and academic relationships on reruns.
    if (!existing.profile) await prisma.profile.create({ data: { userId: existing.id, firstName, lastName } });
    if (extra.registrationNo && !existing.learner) await prisma.learner.create({ data: { userId: existing.id, registrationNo: extra.registrationNo, programmeId: extra.programmeId, currentYearId: extra.yearId, currentSemesterId: extra.semesterId } });
    if (extra.staffNo && !existing.lecturer) await prisma.lecturer.create({ data: { userId: existing.id, staffNo: extra.staffNo } });
    return prisma.user.findUniqueOrThrow({ where: { id: existing.id }, include: { learner: true, lecturer: true } });
  }
  return prisma.user.create({ data: { email, role, passwordHash, profile: { create: { firstName, lastName } }, ...(extra.registrationNo ? { learner: { create: { registrationNo: extra.registrationNo, programmeId: extra.programmeId, currentYearId: extra.yearId, currentSemesterId: extra.semesterId } } } : {}), ...(extra.staffNo ? { lecturer: { create: { staffNo: extra.staffNo } } } : {}) }, include: { learner: true, lecturer: true } });
}

async function main() {
  // Stable demo entities are upserted so this seed never clears or replaces existing records.
  const year = await prisma.academicYear.upsert({ where: { name: '2026 Academic Year' }, update: {}, create: { name: '2026 Academic Year', order: 1 } });
  const semester = await prisma.semester.upsert({ where: { academicYearId_name: { academicYearId: year.id, name: 'Semester 1' } }, update: {}, create: { name: 'Semester 1', sequence: 1, academicYearId: year.id } });
  const programme = await prisma.programme.upsert({ where: { code: 'DEMO-DIT' }, update: {}, create: { code: 'DEMO-DIT', name: 'Demo: Diploma in Information Technology', description: 'DEMO DATA — replace with Rhyme’s approved catalogue in Admin → Programmes.', isDemo: true } });
  const business = await prisma.programme.upsert({ where: { code: 'DEMO-DBM' }, update: {}, create: { code: 'DEMO-DBM', name: 'Demo: Diploma in Business Management', description: 'DEMO DATA — replace with Rhyme’s approved catalogue in Admin → Programmes.', isDemo: true } });

  await upsertUser('admin@rhyme.demo', 'ADMIN', 'Grace', 'Wanjiku');
  const lecturers = await Promise.all([
    upsertUser('jane.kimani@rhyme.demo', 'LECTURER', 'Jane', 'Kimani', { staffNo: 'RHY-L-001' }),
    upsertUser('lecturer2@rhyme.demo', 'LECTURER', 'Peter', 'Otieno', { staffNo: 'RHY-L-002' }),
    upsertUser('lecturer3@rhyme.demo', 'LECTURER', 'Mary', 'Wambui', { staffNo: 'RHY-L-003' }),
    upsertUser('lecturer4@rhyme.demo', 'LECTURER', 'David', 'Mutua', { staffNo: 'RHY-L-004' }),
  ]);

  const courses = [
    { code: 'DEMO-IT101', title: 'Digital Foundations', programmeId: programme.id, lecturerId: lecturers[0].lecturer!.id, description: 'A demo course used to demonstrate the learning experience.', objectives: ['Use core productivity tools', 'Apply safe digital practices', 'Communicate online professionally'] },
    { code: 'DEMO-IT102', title: 'Web Design Essentials', programmeId: programme.id, lecturerId: lecturers[1].lecturer!.id, description: 'A demo course in practical web design foundations.', objectives: ['Structure accessible web pages', 'Create responsive layouts'] },
    { code: 'DEMO-BM101', title: 'Principles of Management', programmeId: business.id, lecturerId: lecturers[0].lecturer!.id, description: 'DEMO DATA course.', objectives: ['Explain management principles'] },
  ];
  for (const course of courses) await prisma.course.upsert({ where: { code: course.code }, update: {}, create: { ...course, creditHours: 3, academicYearId: year.id, semesterId: semester.id } });

  const learners = [];
  const names = ['Eric Mwangi', 'Amina Hassan', 'Brian Kariuki', 'Faith Njeri', 'Kevin Odhiambo'];
  for (let i = 0; i < names.length; i++) {
    const [firstName, lastName] = names[i].split(' ');
    learners.push(await upsertUser(`student${i + 1}@rhyme.demo`, 'LEARNER', firstName, lastName, { registrationNo: `RHY/2026/${String(i + 1).padStart(3, '0')}`, programmeId: programme.id, yearId: year.id, semesterId: semester.id }));
  }

  for (const learner of learners) {
    const learnerId = learner.learner!.id;
    await prisma.enrollment.upsert({ where: { learnerId_programmeId_academicYearId_semesterId: { learnerId, programmeId: programme.id, academicYearId: year.id, semesterId: semester.id } }, update: {}, create: { learnerId, programmeId: programme.id, academicYearId: year.id, semesterId: semester.id } });
    for (const { code } of courses.slice(0, 2)) {
      const course = await prisma.course.findUniqueOrThrow({ where: { code } });
      await prisma.courseEnrollment.upsert({ where: { learnerId_courseId: { learnerId, courseId: course.id } }, update: {}, create: { learnerId, courseId: course.id } });
    }
  }
  console.log('Seeded demo academic records and the 10 requested demo accounts. Password for newly created accounts: Rhyme@2026');
}

main().finally(() => prisma.$disconnect());
