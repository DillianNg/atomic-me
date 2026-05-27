import { PrismaClient, SkillCategory } from '@prisma/client';

const prisma = new PrismaClient();

/** Mot canonical skill de seed, name la unique key cho upsert. */
interface SeedSkill {
  name: string;
  aliases: string[];
  category: SkillCategory;
}

/**
 * Canonical skill taxonomy seed (subset, tu build).
 * Phase sau co the thay bang ESCO import day du.
 */
const SKILLS: SeedSkill[] = [
  // ---------------- Programming languages (TECHNICAL) ----------------
  {
    name: 'JavaScript',
    aliases: ['JS', 'Javascript', 'ECMAScript'],
    category: SkillCategory.TECHNICAL,
  },
  { name: 'TypeScript', aliases: ['TS', 'Typescript'], category: SkillCategory.TECHNICAL },
  { name: 'Python', aliases: ['py', 'Python3'], category: SkillCategory.TECHNICAL },
  { name: 'Java', aliases: ['JVM'], category: SkillCategory.TECHNICAL },
  { name: 'Go', aliases: ['Golang'], category: SkillCategory.TECHNICAL },
  { name: 'Rust', aliases: ['rustlang'], category: SkillCategory.TECHNICAL },
  { name: 'C++', aliases: ['CPP', 'Cplusplus'], category: SkillCategory.TECHNICAL },
  { name: 'C#', aliases: ['CSharp', 'dotnet'], category: SkillCategory.TECHNICAL },
  { name: 'PHP', aliases: [], category: SkillCategory.TECHNICAL },
  { name: 'Ruby', aliases: ['rb'], category: SkillCategory.TECHNICAL },
  { name: 'Swift', aliases: [], category: SkillCategory.TECHNICAL },
  { name: 'Kotlin', aliases: [], category: SkillCategory.TECHNICAL },
  { name: 'SQL', aliases: ['Structured Query Language'], category: SkillCategory.TECHNICAL },
  { name: 'HTML', aliases: ['HTML5'], category: SkillCategory.TECHNICAL },
  { name: 'CSS', aliases: ['CSS3'], category: SkillCategory.TECHNICAL },

  // ---------------- Frameworks / libraries (FRAMEWORK) ----------------
  { name: 'React', aliases: ['ReactJS', 'React.js'], category: SkillCategory.FRAMEWORK },
  { name: 'Vue', aliases: ['VueJS', 'Vue.js'], category: SkillCategory.FRAMEWORK },
  { name: 'Angular', aliases: ['AngularJS'], category: SkillCategory.FRAMEWORK },
  { name: 'Svelte', aliases: ['SvelteKit'], category: SkillCategory.FRAMEWORK },
  { name: 'Next.js', aliases: ['NextJS', 'Next'], category: SkillCategory.FRAMEWORK },
  { name: 'Node.js', aliases: ['NodeJS', 'Node'], category: SkillCategory.FRAMEWORK },
  { name: 'Express', aliases: ['ExpressJS'], category: SkillCategory.FRAMEWORK },
  { name: 'Fastify', aliases: [], category: SkillCategory.FRAMEWORK },
  { name: 'NestJS', aliases: ['Nest'], category: SkillCategory.FRAMEWORK },
  { name: 'Django', aliases: [], category: SkillCategory.FRAMEWORK },
  { name: 'Flask', aliases: [], category: SkillCategory.FRAMEWORK },
  { name: 'Spring Boot', aliases: ['Spring'], category: SkillCategory.FRAMEWORK },
  { name: 'Tailwind CSS', aliases: ['Tailwind', 'TailwindCSS'], category: SkillCategory.FRAMEWORK },
  { name: 'TensorFlow', aliases: ['TF'], category: SkillCategory.FRAMEWORK },
  { name: 'PyTorch', aliases: ['torch'], category: SkillCategory.FRAMEWORK },

  // ---------------- Tools / platforms (TOOL) ----------------
  { name: 'Git', aliases: ['version control'], category: SkillCategory.TOOL },
  { name: 'Docker', aliases: ['containerization'], category: SkillCategory.TOOL },
  { name: 'Kubernetes', aliases: ['K8s'], category: SkillCategory.TOOL },
  { name: 'AWS', aliases: ['Amazon Web Services'], category: SkillCategory.TOOL },
  { name: 'Google Cloud', aliases: ['GCP', 'Google Cloud Platform'], category: SkillCategory.TOOL },
  { name: 'Microsoft Azure', aliases: ['Azure'], category: SkillCategory.TOOL },
  { name: 'Terraform', aliases: ['IaC'], category: SkillCategory.TOOL },
  { name: 'PostgreSQL', aliases: ['Postgres', 'psql'], category: SkillCategory.TOOL },
  { name: 'MySQL', aliases: [], category: SkillCategory.TOOL },
  { name: 'MongoDB', aliases: ['Mongo'], category: SkillCategory.TOOL },
  { name: 'Redis', aliases: [], category: SkillCategory.TOOL },
  { name: 'GraphQL', aliases: ['GQL'], category: SkillCategory.TOOL },
  { name: 'Figma', aliases: [], category: SkillCategory.TOOL },
  { name: 'Jira', aliases: [], category: SkillCategory.TOOL },
  { name: 'Linux', aliases: ['Unix'], category: SkillCategory.TOOL },
  {
    name: 'CI/CD',
    aliases: ['Continuous Integration', 'Continuous Deployment'],
    category: SkillCategory.TOOL,
  },

  // ---------------- Domain knowledge (DOMAIN) ----------------
  { name: 'Machine Learning', aliases: ['ML'], category: SkillCategory.DOMAIN },
  { name: 'Data Science', aliases: ['DS'], category: SkillCategory.DOMAIN },
  { name: 'DevOps', aliases: [], category: SkillCategory.DOMAIN },
  { name: 'Cybersecurity', aliases: ['Security', 'InfoSec'], category: SkillCategory.DOMAIN },
  { name: 'Product Management', aliases: ['PM'], category: SkillCategory.DOMAIN },
  { name: 'UX Design', aliases: ['User Experience', 'UX'], category: SkillCategory.DOMAIN },
  { name: 'UI Design', aliases: ['User Interface', 'UI'], category: SkillCategory.DOMAIN },
  { name: 'Digital Marketing', aliases: ['Marketing'], category: SkillCategory.DOMAIN },
  { name: 'SEO', aliases: ['Search Engine Optimization'], category: SkillCategory.DOMAIN },
  { name: 'Accounting', aliases: [], category: SkillCategory.DOMAIN },
  { name: 'Sales', aliases: [], category: SkillCategory.DOMAIN },
  { name: 'Agile', aliases: ['Scrum', 'Kanban'], category: SkillCategory.DOMAIN },

  // ---------------- Soft skills (SOFT) ----------------
  {
    name: 'Communication',
    aliases: ['verbal communication', 'written communication'],
    category: SkillCategory.SOFT,
  },
  { name: 'Leadership', aliases: ['team leadership'], category: SkillCategory.SOFT },
  { name: 'Problem Solving', aliases: ['analytical thinking'], category: SkillCategory.SOFT },
  { name: 'Teamwork', aliases: ['collaboration'], category: SkillCategory.SOFT },
  { name: 'Time Management', aliases: [], category: SkillCategory.SOFT },
  { name: 'Critical Thinking', aliases: [], category: SkillCategory.SOFT },
  { name: 'Adaptability', aliases: ['flexibility'], category: SkillCategory.SOFT },
  { name: 'Project Management', aliases: [], category: SkillCategory.SOFT },
  { name: 'Negotiation', aliases: [], category: SkillCategory.SOFT },
  { name: 'Public Speaking', aliases: ['presentation'], category: SkillCategory.SOFT },

  // ---------------- Languages (LANGUAGE) ----------------
  { name: 'English', aliases: ['EN'], category: SkillCategory.LANGUAGE },
  { name: 'Vietnamese', aliases: ['Tieng Viet', 'VI'], category: SkillCategory.LANGUAGE },
  { name: 'Japanese', aliases: ['Nihongo', 'JA'], category: SkillCategory.LANGUAGE },
  { name: 'Chinese', aliases: ['Mandarin', 'ZH'], category: SkillCategory.LANGUAGE },
  { name: 'Korean', aliases: ['KO'], category: SkillCategory.LANGUAGE },
  { name: 'French', aliases: ['FR'], category: SkillCategory.LANGUAGE },
  { name: 'German', aliases: ['Deutsch', 'DE'], category: SkillCategory.LANGUAGE },
  { name: 'Spanish', aliases: ['Espanol', 'ES'], category: SkillCategory.LANGUAGE },
];

/**
 * Seed idempotent: upsert theo name (unique), chay lai khong tao trung.
 */
async function main(): Promise<void> {
  for (const skill of SKILLS) {
    await prisma.canonicalSkill.upsert({
      where: { name: skill.name },
      update: { aliases: skill.aliases, category: skill.category },
      create: { name: skill.name, aliases: skill.aliases, category: skill.category },
    });
  }

  const total = await prisma.canonicalSkill.count();
  console.log(
    `Seed done. ${SKILLS.length} skills upserted. Total canonical skills in DB: ${total}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
