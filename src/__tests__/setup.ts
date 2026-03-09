import { vi } from 'vitest'

// Mock Next.js server-only modules
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
  getCurrentOrganizationId: vi.fn(),
}))

// Mock storage
vi.mock('@/lib/storage', () => ({
  isStorageConfigured: vi.fn(() => false),
  getStorageConfigurationGuide: vi.fn(() => 'Konfigurer storage'),
  generateStoragePath: vi.fn(),
  getSignedUploadUrl: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  deleteFile: vi.fn(),
}))

// Mock retention
vi.mock('@/lib/contracts/retention', () => ({
  calculateRetentionDate: vi.fn(() => null),
}))