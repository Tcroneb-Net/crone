export type ProjectFile = {
  path: string;
  content: string;
};

export type FileAction = {
  path: string;
  content?: string;
  action?: "create" | "update" | "delete";
};

export type AgentResponse = {
  reply: string;
  files: FileAction[];
  nextSteps?: string[];
};
