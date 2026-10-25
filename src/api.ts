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

export function javaSubmissionTimeoutMs(testCaseCount: number): number {
  const executionCount = Math.max(1, testCaseCount);
  return (
    javaCompileTimeoutSeconds +
    executionCount * (javaRunTimeoutSeconds + 1) +
    5
  ) * 1000;
}
