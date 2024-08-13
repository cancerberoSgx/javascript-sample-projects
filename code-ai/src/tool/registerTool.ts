import { Tool } from "./types";

const tools: Tool[] = []

export function registerTool(tool: Tool) {
  if(getTool(tool.metadata.name)) {
    throw new Error(`Tool named "${tool.metadata.name}" already exists`)
  }
  tools.push(tool)
}

export function getTool(name: string) {
  return tools.find(t=>t.metadata.name===name)
}