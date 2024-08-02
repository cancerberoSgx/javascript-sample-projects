export function extractCodeSnippets(input: string) {
  const codeSnippetRegex = /```[\s\S]*?```/g;
  const matches = input.match(codeSnippetRegex);

  if (matches) {
    return matches.map(snippet => snippet.replace(/```/g, '').trim());
  } else {
    return [];
  }
}