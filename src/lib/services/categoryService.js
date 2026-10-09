import prisma from '@/lib/prisma'
import { ServiceError, isUniqueViolation } from '@/lib/errors'

const duplicateMainCategory = () =>
  new ServiceError('DUPLICATE_CATEGORY', 'A main category with that name already exists', 409)
const duplicateSubCategory = () =>
  new ServiceError('DUPLICATE_CATEGORY', 'A sub category with that name already exists in this main category', 409)

// Main Categories with their Sub Categories, ordered by name. Active only unless includeInactive.
export async function listTaxonomy(userId, { includeInactive = false } = {}) {
  const activeOnly = includeInactive ? {} : { isActive: true }
  return prisma.mainCategory.findMany({
    where: { userId, ...activeOnly },
    include: {
      subCategories: { where: { userId, ...activeOnly }, orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })
}

export const listActiveTaxonomy = (userId) => listTaxonomy(userId)

export async function createMainCategory(userId, { name }) {
  if (!name || !name.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'name is required')
  }

  const trimmedName = name.trim()

  const existing = await prisma.mainCategory.findUnique({
    where: { userId_name: { userId, name: trimmedName } },
  })
  if (existing) {
    throw duplicateMainCategory()
  }

  try {
    return await prisma.mainCategory.create({ data: { userId, name: trimmedName } })
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateMainCategory()
    throw error
  }
}

export async function createSubCategory(userId, { mainCategoryId, name }) {
  if (mainCategoryId === undefined || mainCategoryId === null || !Number.isFinite(mainCategoryId)) {
    throw new ServiceError('VALIDATION_ERROR', 'mainCategoryId is required and must be a number')
  }

  if (!name || !name.trim()) {
    throw new ServiceError('VALIDATION_ERROR', 'name is required')
  }

  const trimmedName = name.trim()

  const parentExists = await prisma.mainCategory.findUnique({ where: { id: mainCategoryId } })
  if (!parentExists || parentExists.userId !== userId) {
    throw new ServiceError('CATEGORY_NOT_FOUND', 'Main category not found', 404)
  }

  const duplicate = await prisma.subCategory.findFirst({
    where: { mainCategoryId, name: trimmedName },
  })
  if (duplicate) {
    throw duplicateSubCategory()
  }

  try {
    return await prisma.subCategory.create({
      data: { userId, mainCategoryId, name: trimmedName },
      include: { mainCategory: true },
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateSubCategory()
    throw error
  }
}

// ---- Deletion --------------------------------------------------------------------------------
// Hard deletes are blocked while dependent data exists (no cascade); the error message lists the
// blockers. Shared by the REST routes and the assistant's confirmed delete tools.

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function formatList(items) {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function blockedDeletion(kind, blockers) {
  const list = blockers.filter(Boolean)
  if (!list.length) return null
  return new ServiceError(
    'CATEGORY_HAS_DEPENDENCIES',
    `Cannot delete ${kind} because it has ${formatList(list)}. Delete the dependent data first.`,
    409
  )
}

// Race safety: a dependency created (or the row removed) between the check and the delete.
function mapDeleteError(error, kind) {
  if (error?.code === 'P2003') {
    return new ServiceError('CATEGORY_HAS_DEPENDENCIES', `Cannot delete ${kind} because it has dependent data. Delete the dependent data first.`, 409)
  }
  if (error?.code === 'P2025') {
    return new ServiceError('CATEGORY_NOT_FOUND', `${kind === 'main category' ? 'Main' : 'Sub'} category not found`, 404)
  }
  return error
}

// The user's Main Category if it exists and nothing blocks deleting it (else throws). No side effects.
export async function getDeletableMainCategory(userId, mainCategoryId) {
  const mainCategory = await prisma.mainCategory.findUnique({ where: { id: mainCategoryId } })
  if (!mainCategory || mainCategory.userId !== userId) {
    throw new ServiceError('CATEGORY_NOT_FOUND', 'Main category not found', 404)
  }
  const [subCategoryCount, activityCount, weeklyTargetCount] = await Promise.all([
    prisma.subCategory.count({ where: { userId, mainCategoryId } }),
    prisma.activity.count({ where: { userId, subCategory: { mainCategoryId } } }),
    prisma.weeklyTarget.count({ where: { userId, mainCategoryId } }),
  ])
  const blocked = blockedDeletion('main category', [
    subCategoryCount > 0 ? pluralize(subCategoryCount, 'sub category', 'sub categories') : null,
    activityCount > 0 ? pluralize(activityCount, 'activity', 'activities') : null,
    weeklyTargetCount > 0 ? pluralize(weeklyTargetCount, 'weekly target') : null,
  ])
  if (blocked) throw blocked
  return mainCategory
}

export async function deleteMainCategory(userId, mainCategoryId) {
  await getDeletableMainCategory(userId, mainCategoryId)
  try {
    await prisma.mainCategory.delete({ where: { id: mainCategoryId } })
  } catch (error) {
    throw mapDeleteError(error, 'main category')
  }
  return { id: mainCategoryId }
}

// The user's Sub Category (with its Main Category) if it exists and nothing blocks deleting it.
export async function getDeletableSubCategory(userId, subCategoryId) {
  const subCategory = await prisma.subCategory.findUnique({
    where: { id: subCategoryId },
    include: { mainCategory: true },
  })
  if (!subCategory || subCategory.userId !== userId) {
    throw new ServiceError('CATEGORY_NOT_FOUND', 'Sub category not found', 404)
  }
  const [activityCount, summaryCount] = await Promise.all([
    prisma.activity.count({ where: { userId, subCategoryId } }),
    prisma.dailySubCategorySummary.count({ where: { userId, subCategoryId } }),
  ])
  const blocked = blockedDeletion('sub category', [
    activityCount > 0 ? pluralize(activityCount, 'activity', 'activities') : null,
    summaryCount > 0 ? pluralize(summaryCount, 'daily summary', 'daily summaries') : null,
  ])
  if (blocked) throw blocked
  return subCategory
}

export async function deleteSubCategory(userId, subCategoryId) {
  await getDeletableSubCategory(userId, subCategoryId)
  try {
    await prisma.subCategory.delete({ where: { id: subCategoryId } })
  } catch (error) {
    throw mapDeleteError(error, 'sub category')
  }
  return { id: subCategoryId }
}
