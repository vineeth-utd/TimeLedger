import { z } from 'zod'
import {
  createMainCategory,
  createSubCategory,
  listActiveTaxonomy,
} from '@/lib/services/categoryService'
import { ServiceError } from '@/lib/errors'
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

const CONFIRM_NOTE =
  ' Requires user confirmation: the system asks the user automatically, so call this directly (do not ask for confirmation in text).'

export const createMainCategoryTool = defineTool({
  name: 'createMainCategory',
  description: 'Create a new Main Category. Names must be unique per user.' + CONFIRM_NOTE,
  schema: z.strictObject({ name: categoryName }),
  confirmation: {
    kind: 'CREATE_MAIN_CATEGORY',
    async describe(ctx, { name }) {
      const trimmed = name.trim()
      if (!trimmed) throw new ServiceError('VALIDATION_ERROR', 'name is required')
      const taxonomy = await listActiveTaxonomy(ctx.userId)
      if (taxonomy.some((main) => main.name === trimmed)) {
        throw new ServiceError('DUPLICATE_CATEGORY', 'A main category with that name already exists', 409)
      }
      return { summary: `Create new Main Category "${trimmed}"`, name: trimmed }
    },
  },
  async handler(ctx, { name }) {
    const mainCategory = await createMainCategory(ctx.userId, { name })
    return { category: serializeMainCategory(mainCategory) }
  },
})

export const createSubCategoryTool = defineTool({
  name: 'createSubCategory',
  description:
    'Create a new Sub Category under an existing Main Category (by mainCategoryId). ' +
    'Names must be unique within the Main Category.' +
    CONFIRM_NOTE,
  schema: z.strictObject({
    name: categoryName,
    mainCategoryId: z.number().int().positive(),
  }),
  confirmation: {
    kind: 'CREATE_SUB_CATEGORY',
    async describe(ctx, { name, mainCategoryId }) {
      const trimmed = name.trim()
      if (!trimmed) throw new ServiceError('VALIDATION_ERROR', 'name is required')
      const taxonomy = await listActiveTaxonomy(ctx.userId)
      const main = taxonomy.find((category) => category.id === mainCategoryId)
      if (!main) throw new ServiceError('CATEGORY_NOT_FOUND', 'Main category not found', 404)
      if (main.subCategories.some((sub) => sub.name === trimmed)) {
        throw new ServiceError('DUPLICATE_CATEGORY', 'A sub category with that name already exists in this main category', 409)
      }
      return {
        summary: `Create new Sub Category "${trimmed}" under Main Category "${main.name}"`,
        name: trimmed,
        mainCategory: serializeMainCategory(main),
      }
    },
  },
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
