// Background FCM handler — values injected at build time by vite.config.js
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBlkJobO0xQjXzQTPuDKKLOgVohdoVahrQ',
  authDomain: 'warvets-e68f4.firebaseapp.com',
  databaseURL: 'https://warvets-e68f4-default-rtdb.firebaseio.com',
  projectId: 'warvets-e68f4',
  storageBucket: 'warvets-e68f4.firebasestorage.app',
  messagingSenderId: '912780852508',
  appId: '1:912780852508:web:e506efa9e2876a963bced9',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {}
  if (!title) return
  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: payload.data || {},
  })
})
