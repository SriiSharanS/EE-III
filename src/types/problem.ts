export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Topic =
  | 'Basics'
  | 'Conditions'
  | 'Loops'
  | 'Arrays'
  | 'Strings'
  | 'Functions'
  | 'DSA';

export type Language = 'Python' | 'Java' | 'C' | 'C++';
export type Status = 'Attempted' | 'Not Attempted';

export interface TestCase {
  input: string;
  expected: string;
}

export interface Problem {
  id: number;
  number: number;
  title: string;
  difficulty: Difficulty;
  topic: Topic;
  marks: number;
  status: Status;
  description: string;
  input: string;
  output: string;
  exampleInput: string;
  exampleOutput: string;
  constraints: string;
  testCases: TestCase[];
  starterCode: Record<Language, string>;
}
