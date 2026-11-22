export const DEFAULT_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'DevOps Engineer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'QA Engineer',
  'Product Manager',
  'UI/UX Designer',
]

export const DEFAULT_CONFIG = {
  difficulties: [
    { value: 'easy', label: 'Easy', description: 'Beginner level', sortOrder: 1 },
    { value: 'medium', label: 'Medium', description: 'Intermediate level', sortOrder: 2 },
    { value: 'hard', label: 'Hard', description: 'Advanced level', sortOrder: 3 },
  ],
  questionCounts: [10, 15, 20, 25, 30],
  defaultDifficulty: 'medium',
  defaultQuestionCount: 20,
}
