// Terra Grip — Wear OS companion app, a thin shell over the terra-wearos
// SDK. "Make discoverable" puts the watch in Bluetooth discovery so the
// phone app can connect (Connect tab → Wear OS); "Start streaming" sends
// heart rate + steps to the phone, which relays the stream to Terra.
// Standalone Gradle project — open wearos/ in Android Studio (Wear OS 3+).

package co.tryterra.grip.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import co.tryterra.terrawearos.Terra
import co.tryterra.terrawearos.StreamDataTypes

class MainActivity : ComponentActivity() {

  private lateinit var terra: Terra

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Instantiating prompts for the Body Sensors / Location / Activity
    // Recognition permissions.
    terra = Terra(this, setOf(StreamDataTypes.HEART_RATE))

    setContent {
      MaterialTheme {
        var status by remember { mutableStateOf("Not connected") }
        var streaming by remember { mutableStateOf(false) }

        Column(
          modifier = Modifier.fillMaxSize(),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          Text(text = "Terra Grip", style = MaterialTheme.typography.title3)
          Text(text = status, style = MaterialTheme.typography.caption2)

          Button(onClick = {
            status = "Discoverable — connect from the phone"
            terra.startBluetoothDiscovery { connected ->
              runOnUiThread {
                status = if (connected) "Connected to phone" else "Connection failed"
              }
            }
          }) {
            Text("Make discoverable")
          }

          Button(onClick = {
            if (streaming) {
              terra.stopStream()
              streaming = false
              status = "Connected to phone"
            } else {
              terra.startStream()
              streaming = true
              status = "Streaming"
            }
          }) {
            Text(if (streaming) "Stop" else "Start streaming")
          }
        }
      }
    }
  }
}
