/**
 * Backend para Taxi App Peru
 * Escucha cambios en Firestore y envía notificaciones con FCM
 *
 * Desplegado en Render.com (GRATIS)
 */

const express = require('express');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Firebase Admin
// Las credenciales se cargarán desde variables de entorno
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;

  try {
    // Intentar inicializar con credenciales del entorno
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

    if (serviceAccount.project_id) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin inicializado correctamente');
    } else {
      console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT no configurado. Esperando configuración...');
    }
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
  }
}

// ========== FUNCIONES HELPER ==========

/**
 * Enviar notificación usando Firebase Cloud Messaging (FCM)
 */
async function sendFCMNotification(fcmTokens, title, body, data) {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      console.log('⚠️ No hay tokens FCM para enviar notificación');
      return;
    }

    const message = {
      notification: {
        title: title,
        body: body
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'taxi_app_channel',
          sound: 'default'
        }
      },
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`✅ Notificación FCM enviada: ${response.successCount} exitosas, ${response.failureCount} fallidas`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ Error enviando a token ${idx}:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error('❌ Error al enviar notificación FCM:', error);
    throw error;
  }
}

// ========== ESCUCHAR CAMBIOS EN FIRESTORE ==========

let listenersStarted = false;

function startFirestoreListeners() {
  if (!firebaseInitialized || listenersStarted) return;

  listenersStarted = true;
  const db = admin.firestore();

  console.log('🎧 Iniciando listeners de Firestore...');

  // Listener 1: Nuevos viajes (para notificar a conductores)
  db.collection('trips')
    .where('status', '==', 'pending')
    .onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const tripData = change.doc.data();
          const tripId = change.doc.id;

          console.log(`📨 Nuevo viaje detectado: ${tripId}`);

          try {
            // Obtener todos los conductores activos
            const driversSnapshot = await db.collection('users')
              .where('role', '==', 'driver')
              .where('driverStatus', '==', 'active')
              .get();

            // Obtener todos los viajes activos (accepted, arrived, in_progress)
            const activeTripsSnapshot = await db.collection('trips')
              .where('status', 'in', ['accepted', 'arrived', 'in_progress'])
              .get();

            // Crear un Set con los IDs de conductores que ya están en un viaje
            const busyDriverIds = new Set();
            activeTripsSnapshot.forEach(doc => {
              const driverId = doc.data().driverId;
              if (driverId) busyDriverIds.add(driverId);
            });

            // Filtrar solo conductores disponibles (activos y sin viaje)
            const fcmTokens = [];
            driversSnapshot.forEach(doc => {
              const driverId = doc.id;
              const fcmToken = doc.data().fcmToken;

              // Solo agregar si tiene fcmToken y NO está ocupado
              if (fcmToken && !busyDriverIds.has(driverId)) {
                fcmTokens.push(fcmToken);
              }
            });

            if (fcmTokens.length > 0) {
              await sendFCMNotification(
                fcmTokens,
                'Nueva solicitud de viaje',
                `${tripData.passengerName} solicita un viaje desde ${tripData.pickupAddress}`,
                { tripId, type: 'new_trip_request' }
              );
              console.log(`✅ Notificación enviada a ${fcmTokens.length} conductores disponibles (${busyDriverIds.size} conductores ocupados)`);
            } else {
              console.log(`⚠️ No hay conductores disponibles (${driversSnapshot.size} activos, ${busyDriverIds.size} ocupados)`);
            }
          } catch (error) {
            console.error('❌ Error enviando notificación:', error);
          }
        }
      }
    });

  // Listener 2: Cambios en estado de viajes (para notificar a pasajeros)
  db.collection('trips')
    .onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified') {
          const beforeData = change.doc.data();
          const afterData = change.doc.data();
          const tripId = change.doc.id;

          // Solo procesar si el status cambió
          if (beforeData.status === afterData.status) continue;

          console.log(`🔄 Estado de viaje cambió: ${beforeData.status} → ${afterData.status}`);

          const passengerId = afterData.passengerId;
          if (!passengerId) continue;

          try {
            // Obtener datos del pasajero
            const passengerDoc = await db.collection('users').doc(passengerId).get();
            const passengerData = passengerDoc.data();
            const fcmToken = passengerData?.fcmToken;

            if (!fcmToken) continue;

            let title = '';
            let body = '';
            let type = '';

            switch (afterData.status) {
              case 'accepted':
                title = '¡Conductor asignado!';
                body = `${afterData.driverName} aceptó tu viaje y está en camino`;
                type = 'trip_accepted';
                break;
              case 'arrived':
                title = '¡Tu conductor ha llegado!';
                body = `${afterData.driverName} está esperándote en el punto de recogida`;
                type = 'driver_arrived';
                break;
              case 'in_progress':
                title = 'Viaje iniciado';
                body = `En camino a ${afterData.destinationAddress}`;
                type = 'trip_started';
                break;
              case 'completed':
                title = '¡Viaje completado!';
                body = `Has llegado a tu destino. Monto: S/ ${(afterData.fare || 0).toFixed(2)}`;
                type = 'trip_completed';
                break;
              case 'cancelled':
                title = 'Viaje cancelado';
                body = afterData.cancellationReason || 'El viaje ha sido cancelado';
                type = 'trip_cancelled';
                break;
              default:
                continue;
            }

            await sendFCMNotification(
              [fcmToken],
              title,
              body,
              { tripId, type }
            );
            console.log(`✅ Notificación enviada al pasajero: ${title}`);
          } catch (error) {
            console.error('❌ Error enviando notificación al pasajero:', error);
          }
        }
      }
    });

  console.log('✅ Listeners de Firestore iniciados');
}

// ========== ENDPOINTS ==========

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Taxi App Peru - Notification Backend',
    firebase: firebaseInitialized ? 'connected' : 'waiting for credentials',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    firebase: firebaseInitialized,
    uptime: process.uptime()
  });
});

// Endpoint para inicializar Firebase manualmente si es necesario
app.post('/init-firebase', express.json(), (req, res) => {
  try {
    if (!firebaseInitialized) {
      initializeFirebase();
      startFirestoreListeners();
    }
    res.json({
      success: true,
      firebase: firebaseInitialized
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== INICIAR SERVIDOR ==========

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);

  // Intentar inicializar Firebase
  initializeFirebase();

  // Iniciar listeners si Firebase está listo
  if (firebaseInitialized) {
    startFirestoreListeners();
  } else {
    console.log('⏳ Esperando credenciales de Firebase...');
    console.log('💡 Configura la variable de entorno FIREBASE_SERVICE_ACCOUNT en Render');
  }
});

// Manejo de errores
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

