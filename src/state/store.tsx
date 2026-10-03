import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { reducer, initialState, type State, type Action } from './reducer'

const StateCtx = createContext<State>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <StateCtx.Provider value={state}><DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider></StateCtx.Provider>
}
export const useGameState = () => useContext(StateCtx)
export const useGameDispatch = () => useContext(DispatchCtx)
