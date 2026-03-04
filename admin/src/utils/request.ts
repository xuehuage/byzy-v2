import axios from 'axios'
import { message } from 'antd'

const request = axios.create({
    baseURL: '/api',
    timeout: 5000,
})

request.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

request.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const { status, data } = error.response
            message.error(data.message || 'Request failed')
            if (status === 401) {
                localStorage.removeItem('token')
                // Only redirect if not already on the login page to avoid refresh loop
                if (window.location.pathname !== '/byzy-admin') {
                    window.location.href = '/byzy-admin'
                }
            }
        } else {
            message.error('Network Error')
        }
        return Promise.reject(error)
    }
)

export default request
