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

/**
 * Topic prerequisites: prerequisite topics that should be mastered first.
 * Used in the wizard review step to flag potential gaps.
 */
export const TOPIC_PREREQUISITES: Record<string, Record<string, string[]>> = {
  mathematics: {
    'Consumer Arithmetic': ['Computation', 'Number Theory'],
    'Algebra': ['Number Theory'],
    'Sets': ['Number Theory'],
    'Relations, Functions and Graphs': ['Algebra'],
    'Geometry and Trigonometry': ['Measurement', 'Algebra'],
    'Vectors and Matrices': ['Algebra', 'Geometry and Trigonometry'],
    'Statistics': ['Computation', 'Number Theory'],
    'Measurement': ['Computation'],
  },
  biology: {
    'Diffusion, Osmosis and Active Transport': ['Structure and Function of Cells'],
    'Enzymes': ['Structure and Function of Cells'],
    'Nutrition': ['Enzymes'],
    'Respiration': ['Nutrition', 'Enzymes'],
    'Transportation': ['Structure and Function of Cells', 'Diffusion, Osmosis and Active Transport'],
    'Excretion and Homeostasis': ['Transportation', 'Respiration'],
    'Growth and Development': ['Structure and Function of Cells'],
    'Reproduction': ['Structure and Function of Cells', 'Growth and Development'],
    'Genetics and Variation': ['Reproduction', 'Structure and Function of Cells'],
    'Ecology': ['Nutrition', 'Respiration'],
  },
  chemistry: {
    'Periodic Table': ['Atomic Structure'],
    'Chemical Bonding': ['Atomic Structure', 'Periodic Table'],
    'Formulae and Equations': ['Chemical Bonding'],
    'Moles and Molar Mass': ['Formulae and Equations'],
    'Energy Changes in Chemical Reactions': ['Formulae and Equations'],
    'Rates of Reaction': ['Energy Changes in Chemical Reactions'],
    'Acids, Bases and Salts': ['Chemical Bonding', 'Formulae and Equations'],
    'Oxidation and Reduction': ['Formulae and Equations', 'Acids, Bases and Salts'],
    'Metals': ['Periodic Table', 'Chemical Bonding'],
    'Non-Metals': ['Periodic Table', 'Chemical Bonding'],
    'Organic Chemistry': ['Chemical Bonding', 'Formulae and Equations'],
  },
  physics: {
    'Mechanics': ['Measurements and Units'],
    'Forces': ['Mechanics'],
    'Work, Energy and Power': ['Forces', 'Mechanics'],
    'Waves': ['Measurements and Units'],
    'Light': ['Waves'],
    'Sound': ['Waves'],
    'Electricity and Magnetism': ['Work, Energy and Power'],
    'Electronics': ['Electricity and Magnetism'],
    'Atomic Physics': ['Electricity and Magnetism'],
  },
}

/**
 * Subtopic decomposition for foundational learners.
 * When a student marks a topic as "no_exposure" or "struggling" and targets Grade I or II,
 * the system can expand the topic into these focused sub-lessons.
 */
export const TOPIC_SUBTOPICS: Record<string, Record<string, string[]>> = {
  mathematics: {
    'Computation': ['Number Types & Operations', 'Order of Operations (BODMAS)', 'Fractions & Decimals', 'Percentages & Ratios'],
    'Number Theory': ['Factors & Multiples', 'Prime Numbers & Prime Factorization', 'HCF & LCM', 'Indices & Standard Form'],
    'Consumer Arithmetic': ['Profit, Loss & Discount', 'Simple & Compound Interest', 'Hire Purchase & Mortgages', 'Taxes, Bills & Currency'],
    'Sets': ['Set Notation & Types', 'Venn Diagrams (2 sets)', 'Venn Diagrams (3 sets)', 'Set Operations & Problem Solving'],
    'Measurement': ['Perimeter & Area of 2D Shapes', 'Surface Area & Volume of 3D Shapes', 'Unit Conversions', 'Estimation & Approximation'],
    'Statistics': ['Data Collection & Frequency Tables', 'Mean, Median, Mode & Range', 'Bar Charts, Pie Charts & Histograms', 'Cumulative Frequency & Probability'],
    'Algebra': ['Variables & Expressions', 'Simplifying & Expanding', 'Solving Linear Equations', 'Inequalities', 'Simultaneous Equations', 'Quadratic Expressions & Equations'],
    'Relations, Functions and Graphs': ['Relations & Arrow Diagrams', 'Functions & Function Notation', 'Linear Graphs & Gradients', 'Quadratic & Other Graphs'],
    'Geometry and Trigonometry': ['Angles & Parallel Lines', 'Triangles & Congruence', 'Circle Theorems', 'Trigonometric Ratios', 'Bearings & Applications'],
    'Vectors and Matrices': ['Vector Notation & Operations', 'Position Vectors & Displacement', 'Matrix Operations', 'Transformation Matrices'],
  },
  biology: {
    'Living Organisms': ['Characteristics of Living Things', 'Classification of Organisms'],
    'Structure and Function of Cells': ['Cell Structure', 'Plant vs Animal Cells', 'Cell Organelles & Functions'],
    'Nutrition': ['Types of Nutrients', 'Digestive System', 'Balanced Diet & Deficiency Diseases'],
    'Respiration': ['Aerobic Respiration', 'Anaerobic Respiration', 'Gas Exchange'],
    'Genetics and Variation': ['DNA & Chromosomes', 'Mendelian Genetics', 'Variation & Natural Selection'],
  },
  chemistry: {
    'Atomic Structure': ['Atoms, Protons, Neutrons & Electrons', 'Electron Configuration', 'Isotopes & Atomic Mass'],
    'Chemical Bonding': ['Ionic Bonding', 'Covalent Bonding', 'Metallic Bonding', 'Properties of Bonded Substances'],
    'Acids, Bases and Salts': ['Properties of Acids & Bases', 'pH Scale & Indicators', 'Neutralization & Salt Preparation'],
    'Organic Chemistry': ['Alkanes & Alkenes', 'Functional Groups', 'Polymers & Everyday Chemistry'],
  },
  physics: {
    'Mechanics': ['Speed, Velocity & Acceleration', 'Distance-Time & Velocity-Time Graphs', 'Equations of Motion'],
    'Forces': ['Types of Forces', "Newton's Laws", 'Friction & Air Resistance', 'Moments & Equilibrium'],
    'Electricity and Magnetism': ['Current, Voltage & Resistance', 'Series & Parallel Circuits', "Ohm's Law & Calculations", 'Magnetism & Electromagnetic Induction'],
  },
}

/**
 * Get prerequisite topics that a student should know before studying a given topic.
 */
export function getPrerequisites(subjectKey: string, topic: string): string[] {
  return TOPIC_PREREQUISITES[subjectKey]?.[topic] || []
}

/**
 * Get subtopic breakdown for foundational learners.
 */
export function getSubtopics(subjectKey: string, topic: string): string[] {
  return TOPIC_SUBTOPICS[subjectKey]?.[topic] || []
}

export function getSubjectByCode(code: string) {
  const subjects = Object.values(CSEC_SUBJECTS)
  return subjects.find(subject => subject.code === code)
}

export function getSubjectByName(name: string) {
  const key = name.toLowerCase().replace(' ', '_')
  return CSEC_SUBJECTS[key as keyof typeof CSEC_SUBJECTS]
}