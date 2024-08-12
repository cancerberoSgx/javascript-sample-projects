// responsible of reading and merge configuration from several sources

export interface Config {
  openAi?: {
    apiKey?: string;
  };
  ollama?: {};
}

let config: Config | null = null;
export function getConfig(): Config {
  if (!config) {
    config = {
      openAi: {
        apiKey: process.env.OPENAI_API_KEY,
      },
    };
    // TODO : must support a .code-ai.json config, CLI overrides, envvars overrides, etc
  }
  return config;
}
