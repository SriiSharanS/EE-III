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
  testCaseCount?: number;
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

export interface TestCaseExecutionResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface EvaluationResult {
  totalScore: number;
  syntaxScore: number;
  logicScore: number;
  testCaseScore: number;
  timeComplexityScore: number;
  spaceComplexityScore: number;
  codeQualityScore: number;

  correctness: string;
  timeComplexity: string;
  spaceComplexity: string;

  testCasesPassed: number;
  testCasesTotal: number;

  strengths: string[];
  issues: string[];
  suggestions: string[];

  summary: string;
  detailedFeedback: {
    overallAssessment: string;
    verdictExplanation: string;
    correctnessAnalysis: string;
    failedTests: Array<{
      testCaseNumber: number;
      input: string;
      expectedOutput: string;
      actualOutput: string;
      explanation: string;
    }>;
    timeComplexityReasoning: string;
    spaceComplexityReasoning: string;
    codeQualityStrengths: string[];
    codeQualityImprovements: string[];
    specificMistakes: string[];
    correctionGuidance: string[];
    javaConceptsToReview: string[];
    practiceRecommendation: string;
  };
}

export interface SubmissionResponse {
  submissionId: string;
  verdict: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout';
  execution: {
    status: 'success' | 'compile_error' | 'runtime_error' | 'timeout';
    stdout?: string;
    stderr?: string;
    compileError?: string;
    executionTimeMs?: number;
  };
  testCases: Array<{
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    passed: boolean;
  }>;
  testCasesPassed: number;
  testCasesTotal: number;
}
