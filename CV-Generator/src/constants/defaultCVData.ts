import { CVData } from '@/types/cv.types'

export const defaultCVData: CVData = {
  personalInfo: {
    firstName: 'Alex',
    lastName: 'Johnson',
    title: 'Senior Software Engineer',
    email: 'alex.johnson@email.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexjohnson',
    github: 'github.com/alexjohnson',
    website: 'alexjohnson.dev',
    photo: '',
  },
  summary:
    'Passionate software engineer with 8+ years of experience building scalable web applications. Expertise in React, Node.js, and cloud infrastructure. Track record of leading cross-functional teams and delivering high-impact products used by millions of users.',
  experience: [
    {
      id: 'exp-1',
      company: 'TechCorp Inc.',
      role: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      dateRange: 'Jan 2021 – Present',
      bullets: [
        'Led development of a microservices platform serving 5M+ daily active users, reducing latency by 40%',
        'Architected and implemented a real-time collaboration system using WebSockets and Redis Pub/Sub',
        'Mentored a team of 6 engineers, conducting code reviews and establishing engineering best practices',
        'Reduced CI/CD pipeline time from 45 minutes to 12 minutes through parallelization and caching',
      ],
    },
    {
      id: 'exp-2',
      company: 'StartupXYZ',
      role: 'Full Stack Engineer',
      location: 'Remote',
      dateRange: 'Mar 2018 – Dec 2020',
      bullets: [
        'Built React-based dashboard from scratch, increasing user engagement by 65%',
        'Designed and implemented RESTful APIs using Node.js and PostgreSQL',
        'Integrated Stripe payment processing handling $2M+ in monthly transactions',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of California, Berkeley',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      dateRange: '2014 – 2018',
      gpa: '3.8',
    },
  ],
  skills: [
    {
      id: 'skill-1',
      category: 'Languages',
      skills: ['TypeScript', 'JavaScript', 'Python', 'Go', 'SQL'],
    },
    {
      id: 'skill-2',
      category: 'Frontend',
      skills: ['React', 'Next.js', 'Vue.js', 'Tailwind CSS', 'Redux'],
    },
    {
      id: 'skill-3',
      category: 'Backend',
      skills: ['Node.js', 'Express', 'GraphQL', 'PostgreSQL', 'Redis'],
    },
    {
      id: 'skill-4',
      category: 'DevOps & Cloud',
      skills: ['AWS', 'Docker', 'Kubernetes', 'GitHub Actions', 'Terraform'],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'OpenMetrics Dashboard',
      role: 'Creator & Maintainer',
      url: 'github.com/alexjohnson/openmetrics',
      dateRange: '2022 – Present',
      techStack: ['React', 'TypeScript', 'D3.js', 'Go', 'ClickHouse'],
      bullets: [
        'Open-source analytics dashboard with 2,000+ GitHub stars',
        'Real-time data visualization supporting 100M+ events per day',
        'Plugin system enabling community-contributed visualizations',
      ],
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'AWS Solutions Architect – Professional',
      issuer: 'Amazon Web Services',
      date: '2022-06',
      expiryDate: '2025-06',
      credentialId: 'AWS-SAP-123456',
      url: '',
    },
  ],
  languages: [
    { id: 'lang-1', language: 'English', proficiency: 'Native' },
    { id: 'lang-2', language: 'Spanish', proficiency: 'Professional' },
    { id: 'lang-3', language: 'Mandarin', proficiency: 'Conversational' },
  ],
}

export const blankCVData: CVData = {
  personalInfo: {
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    website: '',
    photo: '',
  },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
}
