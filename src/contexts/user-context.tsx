'use client'

import { createContext, useContext } from 'react'

export interface UserContract {
  id: string
  name: string
  isPrimary: boolean
}

export interface UserContextValue {
  contracts: UserContract[]
}

export const UserContext = createContext<UserContextValue>({ contracts: [] })

export function useUserContext() {
  return useContext(UserContext)
}
