import { z } from 'zod'
import { defineTool } from '@/lib/ai/results'

// Structured clarification: lets the model offer selectable options instead of listing them in
// prose. Not a mutation and not a confirmation: the graph ends the turn after this tool, the chat
// input stays enabled, and picking an option just sends its `message` as a normal user message.
export const presentChoicesTool = defineTool({
  name: 'presentChoices',
  description:
    'Ask the user to choose between 2-5 specific options (e.g. several matching activities or plausible ' +
    'categories). Ends your turn; the user may pick one or type a different answer. `question` is the ' +
    'question text; each option has a short display `label` and the `message` sent as the user\'s reply ' +
    'when picked (it must make sense on its own, e.g. "The LeetCode activity at 9:00 AM").',
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
      .max(5),
  }),
  async handler(_ctx, { question, options }) {
    return { question, options }
  },
})
