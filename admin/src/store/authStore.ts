import { create } from 'zustand'

interface User {
    id: number
    username: string
    realname: string
}

interface AuthState {
    token: string | null
    user: User | null
    setLogin: (token: string, user: User) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
    setLogin: (token, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        set({ token, user })
    },
    logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ token: null, user: null })
    },
}))
