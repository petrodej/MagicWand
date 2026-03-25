import { sendAgentCommand, isAgentOnline } from '../ws/agentHandler.js';

export class AgentOfflineError extends Error {
  constructor(computerId: string) {
    super('Computer is offline.');
    this.name = 'AgentOfflineError';
  }
}

export class AgentTimeoutError extends Error {
  constructor() {
    super('Agent did not respond within 60 seconds.');
    this.name = 'AgentTimeoutError';
  }
}

export async function executeAgentCommand(
  computerId: string,
  command: string,
  params: Record<string, any> = {},
): Promise<any> {
  if (!isAgentOnline(computerId)) {
    throw new AgentOfflineError(computerId);
  }

  try {
    return await sendAgentCommand(computerId, command, params, 60000);
  } catch (err: any) {
    if (err.message.includes('not connected')) {
      throw new AgentOfflineError(computerId);
    }
    if (err.message.includes('did not respond')) {
      throw new AgentTimeoutError();
    }
    throw err;
  }
}
