import axios from 'axios'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Preserve local state without abrupt page redirect
    return Promise.reject(err)
  }
)

export const authAPI = {
  register:     (data)  => api.post('/auth/register', data),
  firebaseSync: (data)  => api.post('/auth/firebase-sync', data),
  verifyOtp:    (data)  => api.post('/auth/verify-otp', data),
  resendOtp:    (email) => api.post('/auth/resend-otp', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  login:        (data)  => api.post('/auth/login', data),
  getMe:        ()      => api.get('/auth/me'),
  updateMe:     (data)  => api.patch('/auth/me', data),
}

export const sessionAPI = {
  getRoles:      ()            => api.get('/sessions/roles'),
  getConfig:     ()            => api.get('/sessions/config'),
  getHistory:    ()            => api.get('/sessions/history'),
  getSession:    (id)          => api.get(`/sessions/${id}`),
  startSession:  (data)        => api.post('/sessions/start', data),
  submitSession: (id, answers) => api.post(`/sessions/${id}/submit`, { answers }),
}

export const planAPI = {
  getPlans: () => api.get('/plans'),
}

export const companyAPI = {
  getCompanies: () => api.get('/companies'),
}

export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verifyPayment: (data) => api.post('/payments/verify', data),
  getTransactionHistory: () => api.get('/payments/transaction-history'),
  cancelTransaction: (transactionId) => api.post(`/payments/cancel-transaction/${transactionId}`),
}

export const interviewAPI = {
  start: (data) => api.post('/interview/start', data),
  respond: (id, data) => api.post(`/interview/${id}/respond`, data),
  finish: (id, data) => api.post(`/interview/${id}/finish`, data),
}

export default api