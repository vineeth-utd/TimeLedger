import { z } from 'zod'
import { defineTool } from '@/lib/ai/results'

// Structured clarification: lets the model offer selectable options instead of listing them in
// prose. Not a mutation and not a confirmation: the graph ends the turn after this tool, the chat
// input stays enabled, and picking an option just sends its `message` as a normal user message.
export const presentChoicesTool = defineTool({
  name: 'presentChoices',
  description:
    'Ask the user to pick among 2-10 specific options (matching activities, plausible categories). Ends your ' +
    'turn; they may also type another answer. Each option has a short label and the message sent when picked ' +
    '(must stand alone).',
  schema: z.strictObject({
    question: z.string().trim().min(1).max(300),
    options: z
      .array(
        z.strictObject({
          label: z.string().trim().min(1).max(80),
          message: z.string().trim().min(1).max(200),
        })
      )
      .min(2)
      .max(10),
  }),
  async handler(_ctx, { question, options }) {
    return { question, options }
  },
})
