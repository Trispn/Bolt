import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class CodestralProvider extends BaseProvider {
  name = 'Codestral';
  getApiKeyLink = 'https://codestral.mistral.ai/';
  icon = '🤖'; // Custom icon for Codestral

  config = {
    apiTokenKey: 'CODESTRAL_API_KEY',
    baseUrl: 'https://codestral.mistral.ai',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'codestral-latest',
      endpoints: {
        chat: '/chat/completions',
        completion: '/fim/completions',
      },
      baseUrl: 'https://codestral.mistral.ai/v1',
      label: 'Codestral (Latest)',
      provider: 'Codestral',
      maxTokenAllowed: 32000,
      description: "Mistral's specialized coding model",
      features: ['code-completion', 'chat'],
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model } = options;

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      ...options,
      defaultBaseUrlKey: 'CODESTRAL_BASE_URL',
      defaultApiTokenKey: 'CODESTRAL_API_KEY',
      serverEnv: options.serverEnv as unknown as Record<string, string>,
    });

    if (!apiKey) {
      throw new Error('Codestral API key required');
    }

    return createOpenAI({
      apiKey,
      baseURL: `${baseUrl || this.config.baseUrl}/v1`,
    })(model);
  }
}
