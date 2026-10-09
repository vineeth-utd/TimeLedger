import { z } from 'zod'
import {
  createMainCategory,
  createSubCategory,
  listActiveTaxonomy,
} from '@/lib/services/categoryService'
import { defineTool, serializeMainCategory, serializeSubCategory } from '@/lib/ai/results'

const categoryName = z.string()

export const getCategoriesTool = defineTool({
  name: 'getCategories',
  description:
    'Get the authenticated user\'s active Main Category / Sub Category taxonomy. Retrieval only; ' +
    'choosing the best category is the caller\'s job. Call only when a category must be picked or changed; ' +
    'ids from an earlier result in this conversation can be reused.',
  schema: z.strictObject({}),
  async handler(ctx) {
    const mainCategories = await listActiveTaxonomy(ctx.userId)
    return {
      categories: mainCategories.map((main) => ({
        ...serializeMainCategory(main),
        subCategories: main.subCategories.map(serializeSubCategory),
      })),
    }
  },
})

export const createMainCategoryTool = defineTool({
  name: 'createMainCategory',
  description: 'Create a new Main Category. Names must be unique per user.',
  schema: z.strictObject({ name: categoryName }),
  async handler(ctx, { name }) {
    const mainCategory = await createMainCategory(ctx.userId, { name })
    return { category: serializeMainCategory(mainCategory) }
  },
})

export const createSubCategoryTool = defineTool({
  name: 'createSubCategory',
  description:
    'Create a new Sub Category under an existing Main Category (by mainCategoryId). ' +
    'Names must be unique within the Main Category.',
  schema: z.strictObject({
    name: categoryName,
    mainCategoryId: z.number().int().positive(),
  }),
  async handler(ctx, input) {
    const subCategory = await createSubCategory(ctx.userId, input)
    return {
      subCategory: {
        ...serializeSubCategory(subCategory),
        mainCategory: serializeMainCategory(subCategory.mainCategory),
      },
    }
  },
})
