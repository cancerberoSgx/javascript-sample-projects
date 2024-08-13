import { CodeSnippet } from './types';

export function extractCodeSnippets(input: string): CodeSnippet[] {
  const codeSnippetRegex = /```([a-z]*)\n([\s\S]*?)```/g;
  const matches = [...input.matchAll(codeSnippetRegex)];
  const result: CodeSnippet[] = [];
  matches.forEach(match => {
    result.push({ language: match[1], text: match[2] });
  });
  return result;
}
