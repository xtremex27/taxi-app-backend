# 🚀 Backend Taxi App Peru

Backend Node.js para enviar notificaciones automáticas usando OneSignal.

## 🎯 Funcionalidad

Escucha cambios en Firestore y envía notificaciones automáticamente:

- ✅ Nuevo viaje → Notifica a conductores activos
- ✅ Viaje aceptado → Notifica al pasajero
- ✅ Conductor llegó → Notifica al pasajero
- ✅ Viaje iniciado → Notifica al pasajero
- ✅ Viaje completado → Notifica al pasajero
- ✅ Viaje cancelado → Notifica al pasajero

## 📦 Instalación Local

```bash
cd backend
npm install
npm start
```

## 🌐 Despliegue en Render.com

### Paso 1: Obtener Service Account de Firebase

1. Ve a: https://console.firebase.google.com/project/taxi-app-peru-faa66/settings/serviceaccounts/adminsdk
2. Click en **"Generate New Private Key"**
3. Descarga el archivo JSON
4. **IMPORTANTE:** Guárdalo de forma segura, lo necesitarás para Render

### Paso 2: Crear cuenta en Render.com

1. Ve a: https://render.com
2. Click en **"Get Started for Free"**
3. Regístrate con GitHub (recomendado) o Email

### Paso 3: Conectar con GitHub

1. Sube este proyecto a GitHub
2. En Render, click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub

### Paso 4: Configurar el Web Service

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

**Environment Variables:**
- `FIREBASE_SERVICE_ACCOUNT`: Pega todo el contenido del archivo JSON de Firebase (paso 1)

### Paso 5: Deploy

Click en **"Create Web Service"**

Render empezará a desplegar automáticamente. El proceso toma ~5 minutos.

## ✅ Verificar que funciona

Una vez desplegado, visita:
```
https://tu-app.onrender.com/health
```

Deberías ver:
```json
{
  "status": "healthy",
  "firebase": true,
  "uptime": 123.45
}
```

## 🔧 Troubleshooting

### "firebase": false

El Service Account no está configurado correctamente. Verifica que:
1. La variable `FIREBASE_SERVICE_ACCOUNT` existe en Render
2. El contenido es un JSON válido
3. Reinicia el servicio

### Notificaciones no se envían

1. Verifica los logs en Render
2. Asegúrate de que los Player IDs se están guardando en Firestore
3. Verifica que el OneSignal REST API Key es correcto

## 📊 Logs

Para ver los logs en tiempo real en Render:
1. Ve a tu servicio en Render
2. Click en la pestaña **"Logs"**

## 💰 Costo

**GRATIS** con el plan gratuito de Render:
- 750 horas/mes (suficiente para estar 24/7)
- Se "duerme" después de 15 min sin actividad
- Despierta automáticamente en ~30 segundos cuando llega una petición

## 🔒 Seguridad

- ✅ El Service Account nunca se expone en el código
- ✅ Solo se almacena en variables de entorno de Render
- ✅ El código no almacena credenciales

## 📝 Notas

- El servidor se queda escuchando cambios en Firestore 24/7
- Cuando detecta un cambio relevante, envía la notificación automáticamente
- No requiere Cloud Functions ni plan Blaze de Firebase
