import { z } from 'zod'
import {
  createMainCategory,
  createSubCategory,
  deleteMainCategory,
  deleteSubCategory,
  getDeletableMainCategory,
  getDeletableSubCategory,
  listActiveTaxonomy,
  listTaxonomy,
} from '@/lib/services/categoryService'
import { ServiceError } from '@/lib/errors'
import { defineTool, serializeMainCategory, serializeSubCategory } from '@/lib/ai/results'

const categoryName = z.string()

export const getCategoriesTool = defineTool({
  name: 'getCategories',
  description:
    "Get the user's Main/Sub Category taxonomy (active only unless includeInactive is true). Call only " +
    'when a category must be picked or changed; ids from earlier results can be reused.',
  schema: z.strictObject({ includeInactive: z.boolean().optional() }),
  async handler(ctx, { includeInactive = false }) {
    const mainCategories = await listTaxonomy(ctx.userId, { includeInactive })
    // isActive is reported only when inactive categories were requested.
    const flag = (category) => (includeInactive ? { isActive: category.isActive } : {})
    return {
      categories: mainCategories.map((main) => ({
        ...serializeMainCategory(main),
        ...flag(main),
        subCategories: main.subCategories.map((sub) => ({ ...serializeSubCategory(sub), ...flag(sub) })),
      })),
    }
  },
})

export const createMainCategoryTool = defineTool({
  name: 'createMainCategory',
  description: 'Create a Main Category (unique name).',
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
  description: 'Create a Sub Category under mainCategoryId (unique within it).',
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

// ---- Deletion (gated) ------------------------------------------------------------------------
// Dependency and ownership rules live in categoryService. Describing a deletion runs the same
// check, so a deletion that is already known to be blocked fails with the dependency reason and no
// confirmation is shown. The display carries names only (no ids); approval re-checks the target.

export const deleteMainCategoryTool = defineTool({
  name: 'deleteMainCategory',
  description: 'Delete a Main Category by mainCategoryId; fails if it has sub categories, activities or weekly targets.',
  schema: z.strictObject({ mainCategoryId: z.number().int().positive() }),
  confirmation: {
    kind: 'DELETE_MAIN_CATEGORY',
    async describe(ctx, { mainCategoryId }) {
      const main = await getDeletableMainCategory(ctx.userId, mainCategoryId)
      return { summary: `Delete Main Category "${main.name}"`, name: main.name }
    },
    async verify(ctx, { mainCategoryId }, display) {
      const main = await getDeletableMainCategory(ctx.userId, mainCategoryId)
      if (main.name !== display.name) {
        throw new ServiceError('ACTION_STALE', 'The category changed after it was proposed; nothing was deleted.', 409)
      }
    },
  },
  async handler(ctx, { mainCategoryId }) {
    const { id } = await deleteMainCategory(ctx.userId, mainCategoryId)
    return { deletedMainCategoryId: id }
  },
})

export const deleteSubCategoryTool = defineTool({
  name: 'deleteSubCategory',
  description: 'Delete a Sub Category by subCategoryId; fails if it has activities.',
  schema: z.strictObject({ subCategoryId: z.number().int().positive() }),
  confirmation: {
    kind: 'DELETE_SUB_CATEGORY',
    async describe(ctx, { subCategoryId }) {
      const sub = await getDeletableSubCategory(ctx.userId, subCategoryId)
      return {
        summary: `Delete Sub Category "${sub.name}" under Main Category "${sub.mainCategory.name}"`,
        name: sub.name,
        mainCategoryName: sub.mainCategory.name,
      }
    },
    async verify(ctx, { subCategoryId }, display) {
      const sub = await getDeletableSubCategory(ctx.userId, subCategoryId)
      if (sub.name !== display.name || sub.mainCategory.name !== display.mainCategoryName) {
        throw new ServiceError('ACTION_STALE', 'The category changed after it was proposed; nothing was deleted.', 409)
      }
    },
  },
  async handler(ctx, { subCategoryId }) {
    const { id } = await deleteSubCategory(ctx.userId, subCategoryId)
    return { deletedSubCategoryId: id }
  },
})
