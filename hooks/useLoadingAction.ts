import { useState, useCallback } from 'react'

/**
 * Generic hook to wrap any async action with loading state and double-tap prevention.
 * Usage:
 *   const { isLoading, trigger } = useLoadingAction()
 *   <button onClick={() => trigger(async () => { ... })} disabled={isLoading}>
 */
export function useLoadingAction() {
  const [isLoading, setIsLoading] = useState(false)

  const trigger = useCallback(async (action: () => Promise<void>) => {
    if (isLoading) return // prevent double-tap
    setIsLoading(true)
    try {
      await action()
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  return { isLoading, trigger }
}
