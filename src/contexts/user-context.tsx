'use client'

import { createContext, useContext } from 'react'

export interface UserContract {
  id: string
  name: string
  isPrimary: boolean
  /**
   * 'standard' | 'affinity'. Vem de `dash_contracts.modality` via GET /auth/me.
   *
   * É a modalidade — não o role — que decide se a área de beneficiários aparece. Um
   * mesmo usuário pode ter um contrato de cada tipo, então a pergunta certa nunca é
   * "que role ele tem?", e sim "algum contrato dele é de afinidade?".
   */
  modality: string
  /** `Contracts."contractId"` no StormBot. Nulo = contrato ainda não mapeado. */
  stormbotContractId: number | null
}

export interface UserContextValue {
  contracts: UserContract[]
  /**
   * Role da sessão, como em GET /auth/me.
   *
   * Serve para a tela ANTECIPAR o que o backend vai responder — nunca para decidir
   * acesso. Quem decide é o servidor; errar aqui mostra um botão a mais, não libera
   * nada. É o que permite ao super admin abrir o painel de um contrato de terceiro
   * sabendo de antemão se poderá escrever nele.
   */
  roleId: string
}

export const UserContext = createContext<UserContextValue>({ contracts: [], roleId: '' })

/** Quem pode incluir e revogar beneficiários — espelha WRITE_ROLES do backend. */
export const ROLES_ESCRITA_AFINIDADE = ['contract_manager', 'admin', 'super_admin']

export function useUserContext() {
  return useContext(UserContext)
}

/** Contratos de afinidade do usuário — a fonte da visibilidade da área de beneficiários. */
export function affinityContracts(contracts: UserContract[]): UserContract[] {
  return contracts.filter((c) => c.modality === 'affinity')
}
