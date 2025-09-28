export interface ProviderAdapter {
  requestChatJSON(promptBundle: unknown): Promise<any>;
}

export class WebProviderAdapter implements ProviderAdapter {
  async requestChatJSON(): Promise<any> {
    throw new Error('Provider disabled in web build');
  }
}
