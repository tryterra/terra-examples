// Foreground service that keeps the watch streaming with the screen off.
//
// Two things have to survive backgrounding: the heart-rate source and the
// Bluetooth relay to the phone. startExercise() uses Wear Health Services'
// exercise API, which the system keeps delivering during a workout even with
// the screen off; this foreground service keeps our process (and the
// classic-Bluetooth relay threads inside Terra) alive so that data actually
// reaches the phone. Plain startStream() on a bare Activity stops the moment
// the watch sleeps — hence the exercise + service combination.

package co.tryterra.grip.wear

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import co.tryterra.terrawearos.enums.DataTypes
import co.tryterra.terrawearos.enums.ExerciseTypes

class StreamingService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      StreamingState.terra?.stopExercise()
      stopSelf()
      return START_NOT_STICKY
    }

    startAsForeground()
    StreamingState.terra?.startExercise(
      ExerciseTypes.RUNNING,
      setOf(DataTypes.HEART_RATE),
      false,
      false,
    )
    return START_STICKY
  }

  private fun startAsForeground() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Streaming", NotificationManager.IMPORTANCE_LOW),
    )

    val notification: Notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Terra Grip")
      .setContentText("Streaming to phone")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val CHANNEL_ID = "terra_streaming"
    private const val NOTIFICATION_ID = 1
    const val ACTION_STOP = "co.tryterra.grip.wear.STOP_STREAMING"

    fun start(context: Context) {
      context.startForegroundService(Intent(context, StreamingService::class.java))
    }

    fun stop(context: Context) {
      context.startService(
        Intent(context, StreamingService::class.java).setAction(ACTION_STOP),
      )
    }
  }
}
