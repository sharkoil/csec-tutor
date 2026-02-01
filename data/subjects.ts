export const CSEC_SUBJECTS = {
  mathematics: {
    name: 'Mathematics',
    code: 'MATH',
    description: 'CSEC Mathematics covers computation, algebra, geometry, statistics, and more.',
    topics: [
      'Computation',
      'Number Theory',
      'Consumer Arithmetic',
      'Sets',
      'Measurement',
      'Statistics',
      'Algebra',
      'Relations, Functions and Graphs',
      'Geometry and Trigonometry',
      'Vectors and Matrices'
    ]
  },
  english_a: {
    name: 'English A',
    code: 'ENG_A',
    description: 'English Language focusing on comprehension, summary writing, and composition.',
    topics: [
      'Reading Comprehension',
      'Summary Writing',
      'Composition',
      'Grammar and Usage',
      'Punctuation',
      'Vocabulary Development',
      'Spelling',
      'Sentence Structure',
      'Paragraph Development',
      'Essay Writing'
    ]
  },
  biology: {
    name: 'Biology',
    code: 'BIO',
    description: 'Study of living organisms, their structure, functions, and interactions.',
    topics: [
      'Living Organisms',
      'Structure and Function of Cells',
      'Diffusion, Osmosis and Active Transport',
      'Enzymes',
      'Nutrition',
      'Respiration',
      'Transportation',
      'Excretion and Homeostasis',
      'Growth and Development',
      'Movement and Support',
      'Reproduction',
      'Genetics and Variation',
      'Ecology'
    ]
  },
  chemistry: {
    name: 'Chemistry',
    code: 'CHEM',
    description: 'Study of matter, its properties, composition, and the changes it undergoes.',
    topics: [
      'States of Matter',
      'Atomic Structure',
      'Periodic Table',
      'Chemical Bonding',
      'Formulae and Equations',
      'Moles and Molar Mass',
      'Energy Changes in Chemical Reactions',
      'Rates of Reaction',
      'Acids, Bases and Salts',
      'Oxidation and Reduction',
      'Metals',
      'Non-Metals',
      'Organic Chemistry'
    ]
  },
  physics: {
    name: 'Physics',
    code: 'PHYS',
    description: 'Study of matter, energy, and their interactions in the natural world.',
    topics: [
      'Measurements and Units',
      'Mechanics',
      'Forces',
      'Work, Energy and Power',
      'Thermal Physics',
      'Waves',
      'Light',
      'Sound',
      'Electricity and Magnetism',
      'Electronics',
      'Atomic Physics'
    ]
  },
  principles_of_business: {
    name: 'Principles of Business',
    code: 'POB',
    description: 'Introduction to business concepts, management, and entrepreneurship.',
    topics: [
      'Nature of Business',
      'Types of Business Organizations',
      'Forms of Business Ownership',
      'Business Environment',
      'Management',
      'Marketing',
      'Production',
      'Finance',
      'Human Resource Management',
      'Communication',
      'Entrepreneurship'
    ]
  }
}

export const SUBJECT_DIFFICULTY_LEVELS = {
  beginner: {
    description: 'New to the subject, starting with fundamental concepts',
    study_time_multiplier: 1.5
  },
  intermediate: {
    description: 'Some knowledge of the subject, ready for core concepts',
    study_time_multiplier: 1.0
  },
  advanced: {
    description: 'Strong foundation, focusing on application and complex problems',
    study_time_multiplier: 0.8
  }
}

export const LEARNING_STAGES = {
  fundamentals: {
    name: 'Fundamentals Coaching',
    description: 'Learn the core concepts and theory',
    estimated_time: 45 // minutes
  },
  practice: {
    name: 'Practice Questions',
    description: 'Apply your knowledge with targeted questions',
    estimated_time: 30 // minutes
  },
  exam: {
    name: 'Practice Exam',
    description: 'Test your understanding with exam-style questions',
    estimated_time: 60 // minutes
  }
}

export function getSubjectByCode(code: string) {
  const subjects = Object.values(CSEC_SUBJECTS)
  return subjects.find(subject => subject.code === code)
}

export function getSubjectByName(name: string) {
  const key = name.toLowerCase().replace(' ', '_')
  return CSEC_SUBJECTS[key as keyof typeof CSEC_SUBJECTS]
}