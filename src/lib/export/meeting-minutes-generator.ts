import { parseSSEStream } from '@/lib/relay/stream-parser';
import { PROVIDER_REGISTRY } from '@/lib/providers/registry';
import type { ChatMessage } from '@/types/chat';
import type { ModelConfig } from '@/types/config';

export async function generateMeetingMinutes(
  messages: ChatMessage[],
  model: ModelConfig,
  elapsedSec: number,
  estimatedTokens: number
): Promise<string> {
  const provider = PROVIDER_REGISTRY[model.providerId];
  const apiKey = model.apiKey;
  const baseUrl = model.baseUrl || provider.defaultBaseUrl;

  const conversation = formatConversation(messages);

  const templateRes = await fetch('/api/report-template');
  if (!templateRes.ok) throw new Error('Failed to load report template (ReportTemplate.md)');
  const templateContent = await templateRes.text();

  const prompt = buildPrompt(conversation, messages, elapsedSec, estimatedTokens, templateContent);

  const authHeaders: Record<string, string> = { 'x-api-key': apiKey };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      'x-base-url': baseUrl,
    },
    body: JSON.stringify({
      provider: provider.protocol,
      model: model.modelId,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  return parseSSEStream(response.body, () => {});
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .filter((m) => !m.isError && !m.isSystem)
    .map((m) => {
      const label = m.role === 'user' ? 'User' : (m.displayName || m.modelId || 'AI');
      return `${label}:\n${m.content}`;
    })
    .join('\n\n');
}

function buildPrompt(
  conversation: string,
  messages: ChatMessage[],
  elapsedSec: number,
  estimatedTokens: number,
  templateContent: string
): string {
  const participatingModels = [
    ...new Set(
      messages
        .filter((m) => m.role === 'assistant' && !m.isError && !m.isSystem)
        .map((m) => m.displayName || m.modelId || 'AI')
    ),
  ].join(', ');

  const firstTimestamp = messages[0]?.timestamp;
  const dateStr = firstTimestamp
    ? new Date(firstTimestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-US');

  return `Convert the following AI debate transcript into a research brief report. Strictly follow the template's section structure and Markdown format. Do not output anything outside the template.

Rules:
1. Replace all placeholder text inside square brackets [xxx] with real content extracted from the debate transcript
2. Replace the metadata at the top of the template with the following actual data:
   Date: ${dateStr}
   Participating models: ${participatingModels}
   Session summary: total elapsed time ${elapsedSec} seconds, estimated total token usage ${estimatedTokens}
3. Preserve all Markdown formatting exactly (heading levels, tables, blockquotes, list markers)

Template:

${templateContent}

Debate transcript:

${conversation}`;
}
