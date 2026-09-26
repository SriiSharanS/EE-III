/**
 * CodeAssess AI - Gemini Evaluator Service (Node.js / JavaScript SDK)
 * Uses the official @google/genai SDK to evaluate Java submissions.
 */

import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `You are an AI programming assessment evaluator.
Evaluate a student's Java solution against the provided programming problem.
You are not the compiler and you must not invent execution results.
The supplied compiler output, runtime output and test case results are authoritative.

Evaluate:
- syntax correctness (max 10 marks)
- logical correctness (max 30 marks)
- test case results (max 30 marks)
- time complexity (max 10 marks)
- space complexity (max 10 marks)
- code quality (max 10 marks)

Total score is the exact sum of the above category scores (max 100):
totalScore = syntaxScore + logicScore + testCaseScore + timeComplexityScore + spaceComplexityScore + codeQualityScore

Give fair educational feedback.
Use the supplied evidence.
Do not assume that code is correct merely because it looks plausible.
Do not claim a test passed unless the supplied test result says it passed.
If compilation failed, explain the actual compiler error.
If runtime failed, explain the supplied runtime error.
If test cases failed, explain the likely logical cause.

Scoring bounds:
- syntaxScore: 0 to 10
- logicScore: 0 to 30
- testCaseScore: 0 to 30 (must align with passed/total test cases)
- timeComplexityScore: 0 to 10
- spaceComplexityScore: 0 to 10
- codeQualityScore: 0 to 10
- totalScore: 0 to 100

Return ONLY the requested JSON structure.`;

export async function evaluateCodeWithGemini({ question, code, execution, testCases = [] }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const totalTests = testCases.length;
  const passedTests = testCases.filter((tc) => tc.passed).length;

  const formattedTestCases = testCases
    .map(
      (tc, idx) =>
        `Test Case #${idx + 1}:\n  Input: ${tc.input}\n  Expected: ${tc.expectedOutput}\n  Actual: ${tc.actualOutput}\n  Result: ${tc.passed ? 'PASSED' : 'FAILED'}`
    )
    .join('\n\n');

  const prompt = `
EVALUATION EVIDENCE FOR JAVA ASSESSMENT:

==================== PROBLEM DETAILS ====================
Title: ${question?.title || ''}
Description: ${question?.description || ''}
Input Format: ${question?.inputFormat || 'Standard input'}
Output Format: ${question?.outputFormat || 'Standard output'}
Constraints: ${question?.constraints || 'Standard constraints'}

==================== STUDENT JAVA CODE ====================
\`\`\`java
${code}
\`\`\`

==================== AUTHORITATIVE EXECUTION RESULTS ====================
Execution Status: ${execution?.status || 'unknown'}
Compile Error: ${execution?.compileError || 'None'}
Standard Output (stdout): ${execution?.stdout || 'None'}
Standard Error (stderr): ${execution?.stderr || 'None'}
Execution Time: ${execution?.executionTimeMs || 0} ms

==================== AUTHORITATIVE TEST CASES ====================
Total Test Cases: ${totalTests}
Passed Test Cases: ${passedTests}
Detailed Test Results:
${formattedTestCases || 'No test cases provided.'}

==================== INSTRUCTIONS ====================
Evaluate the student's solution thoroughly based STRICTLY on the execution evidence above.
Return a valid JSON object matching the required schema with integer scores summing to totalScore.
`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const rawText = response.text || '';
  if (!rawText.trim()) {
    throw new Error('Gemini returned an empty response.');
  }

  // Strip code fences if present
  let cleanJson = rawText.trim();
  const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    cleanJson = jsonMatch[1].trim();
  }

  const data = JSON.parse(cleanJson);

  const syntaxScore = Math.max(0, Math.min(10, Math.round(Number(data.syntaxScore) || 0)));
  const logicScore = Math.max(0, Math.min(30, Math.round(Number(data.logicScore) || 0)));
  const testCaseScore = Math.max(0, Math.min(30, Math.round(Number(data.testCaseScore) || 0)));
  const timeComplexityScore = Math.max(0, Math.min(10, Math.round(Number(data.timeComplexityScore) || 0)));
  const spaceComplexityScore = Math.max(0, Math.min(10, Math.round(Number(data.spaceComplexityScore) || 0)));
  const codeQualityScore = Math.max(0, Math.min(10, Math.round(Number(data.codeQualityScore) || 0)));

  const totalScore = syntaxScore + logicScore + testCaseScore + timeComplexityScore + spaceComplexityScore + codeQualityScore;

  return {
    totalScore,
    syntaxScore,
    logicScore,
    testCaseScore,
    timeComplexityScore,
    spaceComplexityScore,
    codeQualityScore,
    correctness: String(data.correctness || 'Completed'),
    timeComplexity: String(data.timeComplexity || 'O(n)'),
    spaceComplexity: String(data.spaceComplexity || 'O(1)'),
    testCasesPassed: totalTests > 0 ? passedTests : Number(data.testCasesPassed) || 0,
    testCasesTotal: totalTests > 0 ? totalTests : Number(data.testCasesTotal) || 0,
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    issues: Array.isArray(data.issues) ? data.issues : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    summary: String(data.summary || ''),
  };
}
