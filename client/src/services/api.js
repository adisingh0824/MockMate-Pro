import axios from 'axios'

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

const isFirebaseIdToken = (token) => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload))
    return claims.iss?.startsWith('https://securetoken.google.com/') || false
  } catch {
    return false
  }
}

const getFirebaseUser = async () => {
  const [{ auth }, { onAuthStateChanged }] = await Promise.all([
    import('../firebase'),
    import('firebase/auth'),
  ])
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    let unsubscribe = () => {}
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    }, (_error) => {
      unsubscribe()
      resolve(null)
    })
  })
}

api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('mm_token') || localStorage.getItem('token') || localStorage.getItem('token')
  if (token && isFirebaseIdToken(token)) {
    try {
      const firebaseUser = await getFirebaseUser()
      if (firebaseUser) {
        token = await firebaseUser.getIdToken()
        localStorage.setItem('mm_token', token)
      }
    } catch {
      // Send the stored token; the API will reject it if it has expired.
    }
  }
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
  saveAnswers:   (id, answers) => api.patch(`/sessions/${id}/answers`, { answers }),
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
  start: async (data) => {
    const stored = localStorage.getItem('mm_token') || localStorage.getItem('token');
    // Temporarily remove token to make endpoint public
    if (stored) {
      localStorage.removeItem('mm_token');
      localStorage.removeItem('token');
    }
    try {
      return await api.post('/interview/start', data);
    } finally {
      // Restore token
      if (stored) {
        localStorage.setItem('mm_token', stored);
        localStorage.setItem('token', stored);
      }
    }
  },
  respond: (id, data) => api.post(`/interview/${id}/respond`, data),
  finish: (id, data) => api.post(`/interview/${id}/finish`, data),
}

export default api
