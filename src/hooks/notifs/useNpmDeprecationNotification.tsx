import { useStartupNotification } from './useStartupNotification.ts'

export function useNpmDeprecationNotification(): void {
  useStartupNotification(async () => null)
}
