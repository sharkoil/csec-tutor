/**
 * Populate CSEC Content with Vector Embeddings
 * 
 * This script populates the database with CSEC educational content
 * and generates embeddings for vector similarity search.
 * 
 * Run with: npx ts-node scripts/populate-vectors.ts
 */

import { createClient } from '@supabase/supabase-js'
import { generateEmbedding, generateEmbeddings } from '../lib/embeddings'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error('ERROR: Supabase URL not configured. Please set NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSEC Mathematics Content
const CSEC_MATHEMATICS_CONTENT = [
  // Algebra - Syllabus
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Algebra: Linear Equations
    
Students should be able to:
1. Solve linear equations in one unknown
2. Solve simultaneous linear equations in two unknowns using substitution and elimination methods
3. Solve linear inequalities in one unknown and represent the solution on a number line
4. Translate word problems into algebraic equations
5. Apply linear equations to real-world situations including cost, distance, and time problems`,
    metadata: { year: 2024, section: 'Section 3' }
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Quadratic Equations',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Algebra: Quadratic Equations
    
Students should be able to:
1. Factorize quadratic expressions of the form ax² + bx + c
2. Solve quadratic equations by factorization
3. Solve quadratic equations using the quadratic formula: x = (-b ± √(b²-4ac)) / 2a
4. Complete the square to solve quadratic equations
5. Determine the nature of roots using the discriminant (b²-4ac)
6. Apply quadratic equations to solve real-world problems`,
    metadata: { year: 2024, section: 'Section 3' }
  },
  // Algebra - Questions
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Algebra (2022 Paper 2)

Solve the following simultaneous equations:
3x + 2y = 12
2x - y = 1

Show all working clearly.`,
    metadata: { year: 2022, paper: 2, marks: 5 }
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Quadratic Equations',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Algebra (2021 Paper 2)

Solve the equation 2x² - 5x - 3 = 0
(a) by factorization
(b) using the quadratic formula

Give your answers to 2 decimal places where necessary.`,
    metadata: { year: 2021, paper: 2, marks: 6 }
  },
  // Algebra - Explanations
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'explanation' as const,
    content: `How to Solve Simultaneous Equations by Elimination

Step 1: Write both equations in standard form (ax + by = c)
Step 2: Make the coefficients of one variable equal by multiplying one or both equations
Step 3: Add or subtract the equations to eliminate one variable
Step 4: Solve for the remaining variable
Step 5: Substitute back to find the other variable
Step 6: Check your solution in both original equations

Example:
3x + 2y = 12  ... (1)
2x - y = 1    ... (2)

Multiply (2) by 2: 4x - 2y = 2 ... (3)
Add (1) and (3): 7x = 14, so x = 2
Substitute x = 2 into (2): 2(2) - y = 1, so y = 3
Solution: x = 2, y = 3`,
    metadata: { difficulty: 'intermediate' }
  },
  {
    subject: 'Mathematics',
    topic: 'Algebra',
    subtopic: 'Quadratic Equations',
    content_type: 'explanation' as const,
    content: `How to Solve Quadratic Equations using the Quadratic Formula

The quadratic formula solves any equation of the form ax² + bx + c = 0

Formula: x = (-b ± √(b² - 4ac)) / (2a)

Steps:
1. Identify values of a, b, and c from your equation
2. Calculate the discriminant: D = b² - 4ac
3. If D > 0: Two distinct real roots
   If D = 0: One repeated root
   If D < 0: No real roots (complex roots)
4. Substitute into the formula and calculate both values of x

Example: 2x² - 5x - 3 = 0
a = 2, b = -5, c = -3
D = (-5)² - 4(2)(-3) = 25 + 24 = 49
x = (5 ± √49) / 4 = (5 ± 7) / 4
x = 12/4 = 3 or x = -2/4 = -0.5`,
    metadata: { difficulty: 'intermediate' }
  },
  // Geometry
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    subtopic: 'Circle Theorems',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Geometry: Circle Theorems
    
Students should be able to:
1. State and apply the theorem: angle at center is twice angle at circumference
2. State and apply the theorem: angles in the same segment are equal
3. State and apply the theorem: angle in a semicircle is 90°
4. State and apply the theorem: opposite angles of a cyclic quadrilateral are supplementary
5. Calculate arc length and sector area
6. Apply tangent properties: tangent is perpendicular to radius at point of contact`,
    metadata: { year: 2024, section: 'Section 5' }
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    subtopic: 'Trigonometry',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Geometry: Trigonometry
    
Students should be able to:
1. Define sine, cosine, and tangent ratios for acute angles
2. Use trigonometric ratios to solve right-angled triangles
3. Apply the sine rule: a/sinA = b/sinB = c/sinC
4. Apply the cosine rule: a² = b² + c² - 2bc cosA
5. Calculate the area of a triangle using ½ab sinC
6. Solve problems involving angles of elevation and depression
7. Apply trigonometry to 3D problems`,
    metadata: { year: 2024, section: 'Section 5' }
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    subtopic: 'Trigonometry',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Trigonometry (2023 Paper 2)

A ladder 5 metres long leans against a vertical wall. The foot of the ladder is 3 metres from the base of the wall.

(a) Calculate the angle the ladder makes with the ground.
(b) How far up the wall does the ladder reach?
(c) If the ladder slips so that the foot moves 1 metre further from the wall, calculate the new height reached on the wall.`,
    metadata: { year: 2023, paper: 2, marks: 8 }
  },
  {
    subject: 'Mathematics',
    topic: 'Geometry',
    subtopic: 'Trigonometry',
    content_type: 'explanation' as const,
    content: `Understanding SOHCAHTOA - Trigonometric Ratios

For a right-angled triangle with angle θ:
- SOH: Sin θ = Opposite / Hypotenuse
- CAH: Cos θ = Adjacent / Hypotenuse
- TOA: Tan θ = Opposite / Adjacent

How to solve a right triangle problem:
1. Draw and label the triangle
2. Identify which sides/angles are known
3. Identify what you need to find
4. Choose the appropriate ratio based on known and unknown sides
5. Set up the equation and solve

Example: Ladder against wall
If ladder = 5m (hypotenuse) and distance from wall = 3m (adjacent)
cos θ = 3/5 = 0.6
θ = cos⁻¹(0.6) = 53.13°
Height = √(5² - 3²) = √16 = 4m`,
    metadata: { difficulty: 'intermediate' }
  },
  // Statistics
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    subtopic: 'Measures of Central Tendency',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Statistics: Measures of Central Tendency
    
Students should be able to:
1. Calculate the mean of ungrouped and grouped data
2. Determine the median from raw data and frequency tables
3. Determine the mode from data sets and frequency distributions
4. Compare mean, median, and mode and choose appropriate measures
5. Calculate the mean from a frequency table using Σfx/Σf
6. Use assumed mean method for calculating mean of grouped data`,
    metadata: { year: 2024, section: 'Section 6' }
  },
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    subtopic: 'Probability',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Statistics: Probability
    
Students should be able to:
1. Define probability as P(event) = favorable outcomes / total outcomes
2. Calculate probability of simple events
3. Calculate probability of compound events (AND/OR)
4. Construct and use probability tree diagrams
5. Apply the addition rule: P(A or B) = P(A) + P(B) - P(A and B)
6. Apply the multiplication rule for independent events: P(A and B) = P(A) × P(B)
7. Calculate expected frequency = probability × number of trials`,
    metadata: { year: 2024, section: 'Section 6' }
  },
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    subtopic: 'Probability',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Probability (2022 Paper 2)

A bag contains 5 red balls, 3 blue balls, and 2 green balls. Two balls are drawn at random without replacement.

(a) Draw a tree diagram to show all possible outcomes.
(b) Calculate the probability of drawing:
    (i) two red balls
    (ii) one red and one blue ball
    (iii) two balls of the same color`,
    metadata: { year: 2022, paper: 2, marks: 10 }
  },
  {
    subject: 'Mathematics',
    topic: 'Statistics',
    subtopic: 'Probability',
    content_type: 'explanation' as const,
    content: `Probability with Tree Diagrams - Without Replacement

When drawing without replacement, probabilities change after each draw.

Key concepts:
1. First draw: P = items of type / total items
2. Second draw: total decreases by 1, and if same type, that type also decreases

Example: Bag with 5 red, 3 blue, 2 green (10 total)

P(two red balls):
= P(1st red) × P(2nd red | 1st was red)
= 5/10 × 4/9
= 20/90 = 2/9

P(one red, one blue):
= P(red then blue) + P(blue then red)
= (5/10 × 3/9) + (3/10 × 5/9)
= 15/90 + 15/90 = 30/90 = 1/3

Multiply along branches, add between branches!`,
    metadata: { difficulty: 'intermediate' }
  },
  // Number Theory
  {
    subject: 'Mathematics',
    topic: 'Number Theory',
    subtopic: 'Indices and Logarithms',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Number Theory: Indices and Logarithms
    
Students should be able to:
1. Apply the laws of indices: 
   - aᵐ × aⁿ = aᵐ⁺ⁿ
   - aᵐ ÷ aⁿ = aᵐ⁻ⁿ
   - (aᵐ)ⁿ = aᵐⁿ
2. Simplify expressions with negative and fractional indices
3. Convert between index and logarithmic form: if aˣ = n then logₐn = x
4. Apply the laws of logarithms:
   - log(mn) = log m + log n
   - log(m/n) = log m - log n
   - log(mⁿ) = n log m
5. Solve simple exponential equations`,
    metadata: { year: 2024, section: 'Section 2' }
  },
  {
    subject: 'Mathematics',
    topic: 'Number Theory',
    subtopic: 'Indices and Logarithms',
    content_type: 'explanation' as const,
    content: `Laws of Indices - Complete Guide

Basic Laws:
1. Multiplication: aᵐ × aⁿ = aᵐ⁺ⁿ (add powers)
   Example: 2³ × 2⁴ = 2⁷ = 128

2. Division: aᵐ ÷ aⁿ = aᵐ⁻ⁿ (subtract powers)
   Example: 5⁶ ÷ 5² = 5⁴ = 625

3. Power of a power: (aᵐ)ⁿ = aᵐⁿ (multiply powers)
   Example: (3²)⁴ = 3⁸ = 6561

Special Cases:
4. Zero index: a⁰ = 1 (any number to power 0 equals 1)
5. Negative index: a⁻ⁿ = 1/aⁿ
   Example: 2⁻³ = 1/2³ = 1/8

6. Fractional index: a^(1/n) = ⁿ√a
   Example: 8^(1/3) = ³√8 = 2

7. Combined: a^(m/n) = ⁿ√(aᵐ) = (ⁿ√a)ᵐ
   Example: 8^(2/3) = (³√8)² = 2² = 4`,
    metadata: { difficulty: 'intermediate' }
  },
  // Consumer Arithmetic
  {
    subject: 'Mathematics',
    topic: 'Consumer Arithmetic',
    subtopic: 'Simple and Compound Interest',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Consumer Arithmetic: Interest
    
Students should be able to:
1. Calculate simple interest using I = PRT/100
2. Calculate compound interest and amount using A = P(1 + r/100)ⁿ
3. Compare simple and compound interest over time
4. Calculate depreciation using reducing balance method
5. Solve problems involving hire purchase
6. Calculate installment payments and total cost
7. Apply percentage calculations to profit, loss, and discount`,
    metadata: { year: 2024, section: 'Section 1' }
  },
  {
    subject: 'Mathematics',
    topic: 'Consumer Arithmetic',
    subtopic: 'Simple and Compound Interest',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Consumer Arithmetic (2023 Paper 2)

Mr. Johnson invests $8,000 in a bank account that pays 5% per annum compound interest.

(a) Calculate the value of the investment after 3 years.
(b) Calculate the total interest earned.
(c) How much more interest would be earned with compound interest compared to simple interest over the same period?`,
    metadata: { year: 2023, paper: 2, marks: 7 }
  },
  {
    subject: 'Mathematics',
    topic: 'Consumer Arithmetic',
    subtopic: 'Simple and Compound Interest',
    content_type: 'explanation' as const,
    content: `Compound Interest vs Simple Interest

Simple Interest: I = PRT/100
- Interest calculated only on principal
- Amount = P + I

Compound Interest: A = P(1 + r/100)ⁿ
- Interest calculated on principal + accumulated interest
- Interest is "compounded" each period

Example: $8,000 at 5% for 3 years

Simple Interest:
I = 8000 × 5 × 3 / 100 = $1,200
Total = $9,200

Compound Interest:
A = 8000(1 + 5/100)³
A = 8000(1.05)³
A = 8000 × 1.157625
A = $9,261
Interest earned = $1,261

Difference = $1,261 - $1,200 = $61 more with compound interest

The longer the time, the bigger the difference!`,
    metadata: { difficulty: 'intermediate' }
  },
  // Sets
  {
    subject: 'Mathematics',
    topic: 'Sets',
    subtopic: 'Set Operations',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Sets: Set Operations
    
Students should be able to:
1. Use set notation: ∈, ∉, ⊂, ⊃, ∪, ∩, A', ∅, n(A)
2. Represent sets using Venn diagrams
3. Find union, intersection, and complement of sets
4. Solve problems involving two and three sets
5. Use the formula: n(A ∪ B) = n(A) + n(B) - n(A ∩ B)
6. Apply set theory to solve real-world problems
7. Shade regions in Venn diagrams to represent set expressions`,
    metadata: { year: 2024, section: 'Section 4' }
  },
  {
    subject: 'Mathematics',
    topic: 'Sets',
    subtopic: 'Set Operations',
    content_type: 'question' as const,
    content: `CSEC Past Paper Question - Sets (2021 Paper 2)

In a survey of 100 students:
- 65 students study Mathematics
- 45 students study English
- 20 students study both subjects

(a) Represent this information in a Venn diagram.
(b) How many students study only Mathematics?
(c) How many students study at least one of these subjects?
(d) How many students study neither subject?`,
    metadata: { year: 2021, paper: 2, marks: 8 }
  },
  {
    subject: 'Mathematics',
    topic: 'Sets',
    subtopic: 'Set Operations',
    content_type: 'explanation' as const,
    content: `Solving Venn Diagram Problems - Two Sets

Formula: n(A ∪ B) = n(A) + n(B) - n(A ∩ B)

Step-by-step approach:
1. Draw two overlapping circles in a rectangle (universal set)
2. Start with the intersection (n(A ∩ B)) - place this in the middle
3. Calculate "only A" = n(A) - n(A ∩ B)
4. Calculate "only B" = n(B) - n(A ∩ B)
5. Calculate outside both = n(U) - n(A ∪ B)

Example: 100 students, 65 Math, 45 English, 20 both
- Both (intersection): 20
- Only Math: 65 - 20 = 45
- Only English: 45 - 20 = 25
- At least one: 45 + 20 + 25 = 90
- Neither: 100 - 90 = 10

Check: 45 + 20 + 25 + 10 = 100 ✓`,
    metadata: { difficulty: 'intermediate' }
  },
  // Functions
  {
    subject: 'Mathematics',
    topic: 'Functions',
    subtopic: 'Function Notation',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Functions
    
Students should be able to:
1. Use function notation f(x), g(x), etc.
2. Evaluate functions at given values
3. Determine if a relation is a function (vertical line test)
4. Find the domain and range of functions
5. Find the inverse of a function f⁻¹(x)
6. Compose functions: fg(x) means f(g(x))
7. Sketch graphs of linear and quadratic functions`,
    metadata: { year: 2024, section: 'Section 3' }
  },
  {
    subject: 'Mathematics',
    topic: 'Functions',
    subtopic: 'Function Notation',
    content_type: 'explanation' as const,
    content: `Finding the Inverse of a Function

The inverse function f⁻¹(x) reverses what f(x) does.
If f(a) = b, then f⁻¹(b) = a

Steps to find f⁻¹(x):
1. Replace f(x) with y: y = f(x)
2. Swap x and y: x = original expression with y
3. Make y the subject
4. Replace y with f⁻¹(x)

Example: Find the inverse of f(x) = 2x + 3

Step 1: y = 2x + 3
Step 2: x = 2y + 3 (swap x and y)
Step 3: x - 3 = 2y
         y = (x - 3)/2
Step 4: f⁻¹(x) = (x - 3)/2

Verify: f(5) = 2(5) + 3 = 13
        f⁻¹(13) = (13 - 3)/2 = 5 ✓`,
    metadata: { difficulty: 'intermediate' }
  },
  // Matrices
  {
    subject: 'Mathematics',
    topic: 'Matrices',
    subtopic: 'Matrix Operations',
    content_type: 'syllabus' as const,
    content: `CSEC Mathematics Syllabus - Matrices
    
Students should be able to:
1. Add and subtract matrices of the same order
2. Multiply a matrix by a scalar
3. Multiply matrices (when compatible)
4. Calculate the determinant of a 2×2 matrix: |A| = ad - bc
5. Find the inverse of a 2×2 matrix: A⁻¹ = (1/|A|)[d, -b; -c, a]
6. Solve simultaneous equations using matrices
7. Identify the identity matrix I = [1, 0; 0, 1]`,
    metadata: { year: 2024, section: 'Section 3' }
  },
  {
    subject: 'Mathematics',
    topic: 'Matrices',
    subtopic: 'Matrix Operations',
    content_type: 'explanation' as const,
    content: `Solving Simultaneous Equations Using Matrices

For equations: ax + by = e and cx + dy = f

Matrix form: [a, b; c, d] × [x; y] = [e; f]
Or: AX = B

Solution: X = A⁻¹B

Steps:
1. Write in matrix form AX = B
2. Find A⁻¹ = (1/det(A)) × [d, -b; -c, a]
3. Calculate X = A⁻¹ × B

Example: 3x + 2y = 12 and 2x - y = 1

A = [3, 2; 2, -1], B = [12; 1]

det(A) = (3)(-1) - (2)(2) = -3 - 4 = -7

A⁻¹ = (1/-7) × [-1, -2; -2, 3]
     = [1/7, 2/7; 2/7, -3/7]

X = A⁻¹B = [1/7, 2/7; 2/7, -3/7] × [12; 1]
  = [(12 + 2)/7; (24 - 3)/7]
  = [2; 3]

So x = 2, y = 3`,
    metadata: { difficulty: 'advanced' }
  }
]

// CSEC English Content
const CSEC_ENGLISH_CONTENT = [
  {
    subject: 'English',
    topic: 'Comprehension',
    subtopic: 'Reading Skills',
    content_type: 'syllabus' as const,
    content: `CSEC English Syllabus - Comprehension: Reading Skills
    
Students should be able to:
1. Identify main ideas and supporting details in a passage
2. Make inferences based on explicit and implicit information
3. Distinguish between fact and opinion
4. Identify the author's purpose and point of view
5. Analyze the use of figurative language
6. Summarize passages accurately
7. Evaluate arguments and evidence presented`,
    metadata: { year: 2024, section: 'Paper 2' }
  },
  {
    subject: 'English',
    topic: 'Essay Writing',
    subtopic: 'Argumentative Essays',
    content_type: 'syllabus' as const,
    content: `CSEC English Syllabus - Essay Writing: Argumentative Essays
    
Students should be able to:
1. Present a clear thesis statement
2. Develop arguments with supporting evidence
3. Address counter-arguments effectively
4. Use logical connectives (however, moreover, therefore)
5. Write a compelling introduction and conclusion
6. Organize paragraphs with topic sentences
7. Use formal register appropriate for academic writing`,
    metadata: { year: 2024, section: 'Paper 2' }
  },
  {
    subject: 'English',
    topic: 'Essay Writing',
    subtopic: 'Argumentative Essays',
    content_type: 'explanation' as const,
    content: `How to Write a Strong Argumentative Essay

Structure:
1. Introduction (10%)
   - Hook: engaging opening sentence
   - Context: brief background
   - Thesis: clear position statement

2. Body Paragraphs (75%)
   Each paragraph should have:
   - Topic sentence (main point)
   - Evidence (facts, statistics, examples)
   - Explanation of how evidence supports your point
   - Transition to next paragraph

3. Counter-argument paragraph
   - Acknowledge opposing view
   - Explain why your position is stronger

4. Conclusion (15%)
   - Restate thesis in new words
   - Summarize main points
   - Call to action or final thought

Useful connectives:
- Addition: furthermore, moreover, in addition
- Contrast: however, on the other hand, nevertheless
- Cause/effect: therefore, consequently, as a result
- Emphasis: indeed, certainly, undoubtedly`,
    metadata: { difficulty: 'intermediate' }
  },
  {
    subject: 'English',
    topic: 'Grammar',
    subtopic: 'Subject-Verb Agreement',
    content_type: 'syllabus' as const,
    content: `CSEC English Syllabus - Grammar: Subject-Verb Agreement
    
Students should be able to:
1. Ensure verbs agree with subjects in number (singular/plural)
2. Handle compound subjects joined by 'and', 'or', 'nor'
3. Recognize collective nouns and their verb agreements
4. Handle indefinite pronouns (everyone, each, nobody)
5. Manage subject-verb agreement with intervening phrases
6. Apply correct agreement with inverted sentences`,
    metadata: { year: 2024, section: 'Paper 1' }
  },
  {
    subject: 'English',
    topic: 'Grammar',
    subtopic: 'Subject-Verb Agreement',
    content_type: 'explanation' as const,
    content: `Subject-Verb Agreement Rules

Basic Rule: Singular subjects take singular verbs; plural subjects take plural verbs.

Key Rules:

1. Compound subjects with 'and' → plural verb
   - "The teacher and student ARE present."

2. Compound subjects with 'or/nor' → verb agrees with closer subject
   - "Neither the students nor the teacher WAS ready."
   - "Neither the teacher nor the students WERE ready."

3. Collective nouns → usually singular
   - "The team IS practicing." (acting as one unit)
   - "The team ARE arguing." (acting as individuals - rare)

4. Indefinite pronouns:
   - Singular: everyone, each, nobody, anybody
   - "Everyone HAS a book."
   - Plural: both, few, many, several
   - "Many HAVE arrived."

5. Intervening phrases - ignore them!
   - "The box of chocolates IS on the table."
   - (Subject is 'box', not 'chocolates')

6. Inverted sentences - find the true subject
   - "There ARE many options available."
   - (Subject is 'options')`,
    metadata: { difficulty: 'intermediate' }
  }
]

async function populateContent() {
  console.log('Starting CSEC content population...\n')
  
  const allContent = [...CSEC_MATHEMATICS_CONTENT, ...CSEC_ENGLISH_CONTENT]
  let successCount = 0
  let errorCount = 0
  
  for (const item of allContent) {
    try {
      // Generate embedding for the content
      console.log(`Processing: ${item.subject} - ${item.topic} - ${item.subtopic} (${item.content_type})`)
      
      const embedding = await generateEmbedding(item.content)
      
      // Insert into database
      const { error } = await supabase
        .from('csec_content')
        .insert({
          subject: item.subject,
          topic: item.topic,
          subtopic: item.subtopic,
          content_type: item.content_type,
          content: item.content,
          metadata: item.metadata,
          embedding
        })
      
      if (error) {
        console.error(`  ERROR: ${error.message}`)
        errorCount++
      } else {
        console.log('  ✓ Success')
        successCount++
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300))
      
    } catch (error) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
      errorCount++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log(`Population complete!`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`  Total: ${allContent.length}`)
}

// Run the population
populateContent().catch(console.error)
