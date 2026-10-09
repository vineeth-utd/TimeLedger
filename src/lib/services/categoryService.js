import prisma from '@/lib/prisma'
import { ServiceError, isUniqueViolation } from '@/lib/errors'

const duplicateMainCategory = () =>
  new ServiceError('DUPLICATE_CATEGORY', 'A main category with that name already exists', 409)
const duplicateSubCategory = () =>
  new ServiceError('DUPLICATE_CATEGORY', 'A sub category with that name already exists in this main category', 409)

// Active Main Categories with their active Sub Categories, ordered by name.
export async function listActiveTaxonomy(userId) {
  return prisma.mainCategory.findMany({
    where: { userId, isActive: true },
    include: {
      subCategories: { where: { userId, isActive: true }, orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })
}

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
