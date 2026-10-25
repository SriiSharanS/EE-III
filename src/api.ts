import type { Difficulty, Problem, Status, Topic } from './types/problem';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');

function timeoutSeconds(value: string | undefined, defaultValue: number, maximum: number): number {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? Math.min(parsedValue, maximum)
    : defaultValue;
}

const javaCompileTimeoutSeconds = timeoutSeconds(
  import.meta.env.VITE_JAVA_COMPILE_TIMEOUT_SECONDS,
  10,
  60
);
const javaRunTimeoutSeconds = timeoutSeconds(
  import.meta.env.VITE_JAVA_RUN_TIMEOUT_SECONDS,
  5,
  30
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return configuredApiBaseUrl ? `${configuredApiBaseUrl}${normalizedPath}` : normalizedPath;
}

const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const topics: Topic[] = [
  'Basics',
  'Conditions',
  'Loops',
  'Arrays',
  'Strings',
  'Functions',
  'DSA',
];
const statuses: Status[] = ['Attempted', 'Not Attempted'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isOneOf<T extends string>(value: unknown, options: T[]): value is T {
  return typeof value === 'string' && options.some((option) => option === value);
}

function parseTestCase(value: unknown): { input: string; expected: string } {
  if (
    !isRecord(value) ||
    typeof value.input !== 'string' ||
    typeof value.expected !== 'string'
  ) {
    throw new Error('The problem service returned an invalid test-case format.');
  }
  return { input: value.input, expected: value.expected };
}

function parseProblem(value: unknown): Problem {
  if (
    !isRecord(value) ||
    !isInteger(value.id) ||
    !isInteger(value.testCaseCount) ||
    value.testCaseCount < 1 ||
    !isInteger(value.number) ||
    !isInteger(value.marks) ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.input !== 'string' ||
    typeof value.output !== 'string' ||
    typeof value.exampleInput !== 'string' ||
    typeof value.exampleOutput !== 'string' ||
    typeof value.constraints !== 'string' ||
    !isOneOf(value.difficulty, difficulties) ||
    !isOneOf(value.topic, topics) ||
    !isOneOf(value.status, statuses) ||
    !Array.isArray(value.testCases) ||
    !isRecord(value.starterCode) ||
    typeof value.starterCode.Python !== 'string' ||
    typeof value.starterCode.Java !== 'string' ||
    typeof value.starterCode.C !== 'string' ||
    typeof value.starterCode['C++'] !== 'string'
  ) {
    throw new Error('The problem service returned data in an invalid format.');
  }

  return {
    id: value.id,
    testCaseCount: value.testCaseCount,
    number: value.number,
    title: value.title,
    difficulty: value.difficulty,
    topic: value.topic,
    marks: value.marks,
    status: value.status,
    description: value.description,
    input: value.input,
    output: value.output,
    exampleInput: value.exampleInput,
    exampleOutput: value.exampleOutput,
    constraints: value.constraints,
    testCases: value.testCases.map(parseTestCase),
    starterCode: {
      Python: value.starterCode.Python,
      Java: value.starterCode.Java,
      C: value.starterCode.C,
      'C++': value.starterCode['C++'],
    },
  };
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.detail === 'string') {
      return new Error(body.detail);
    }
  } catch {
    // Fall through to the status-based message for non-JSON responses.
  }
  return new Error(`${fallback} (HTTP ${response.status}).`);
}

export async function fetchProblems(signal?: AbortSignal): Promise<Problem[]> {
  const response = await fetch(apiUrl('/api/problems'), { signal });
  if (!response.ok) {
    throw await responseError(response, 'Unable to load problems');
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('The problem service returned an invalid problem list.');
  }
  return data.map(parseProblem);
}

export async function fetchProblem(problemId: number, signal?: AbortSignal): Promise<Problem> {
  const response = await fetch(apiUrl(`/api/problems/${problemId}`), { signal });
  if (!response.ok) {
    throw await responseError(response, 'Unable to load problem');
  }
  return parseProblem(await response.json());
}

export function javaSubmissionTimeoutMs(testCaseCount: number): number {
  const executionCount = Math.max(1, testCaseCount);
  return (
    javaCompileTimeoutSeconds +
    executionCount * (javaRunTimeoutSeconds + 1) +
    5
  ) * 1000;
}
