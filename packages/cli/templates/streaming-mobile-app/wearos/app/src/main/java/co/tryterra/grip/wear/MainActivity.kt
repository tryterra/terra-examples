// Terra Grip — Wear OS companion app, a thin shell over the terra-wearos
// SDK. Tap Start: the watch becomes discoverable, the phone connects to it
// (Connect tab → Wear OS), and streaming auto-starts in a foreground service
// so it continues with the screen off. Heart rate relays watch → phone →
// Terra. (Register more StreamDataTypes in the Terra(...) set to stream more.)
// Standalone Gradle project — open wearos/ in Android Studio (Wear OS 3+).

package co.tryterra.grip.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import co.tryterra.terrawearos.Terra
import co.tryterra.terrawearos.enums.StreamDataTypes
import kotlinx.coroutines.delay

// Heart rate stops updating within a few seconds of a real drop; if we've had
// data and then go quiet this long, report "reconnecting" instead of lying
// that we're still streaming. The SDK exposes no connection-state signal, so
// liveness is inferred from the data flow (same approach as the phone app).
private const val STALE_MS = 10_000L

class MainActivity : ComponentActivity() {

  private lateinit var terra: Terra

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Instantiating prompts for the Body Sensors / Location / Activity
    // Recognition / Bluetooth permissions. Park it in StreamingState so the
    // foreground StreamingService drives the same connection when backgrounded.
    terra = Terra(this, setOf(StreamDataTypes.HEART_RATE))
    StreamingState.terra = terra

    setContent {
      MaterialTheme {
        var discovering by remember { mutableStateOf(false) }
        var streaming by remember { mutableStateOf(false) }
        var failed by remember { mutableStateOf(false) }

        // Liveness inferred from the heart-rate flow (the SDK gives no
        // connection-state observable). lastHrAt tracks the newest reading; a
        // once-a-second tick lets the UI notice when readings dry up.
        val bpm by terra.heartRate.collectAsState()
        var lastHrAt by remember { mutableStateOf(0L) }
        var now by remember { mutableStateOf(0L) }
        LaunchedEffect(bpm) { if (bpm > 0.0) lastHrAt = System.currentTimeMillis() }
        LaunchedEffect(Unit) {
          while (true) {
            now = System.currentTimeMillis()
            delay(1000)
          }
        }

        val hasData = bpm > 0.0 && lastHrAt > 0L
        val stale = streaming && hasData && now - lastHrAt > STALE_MS
        val live = streaming && hasData && !stale
        val active = streaming || discovering

        val status = when {
          failed -> "Couldn't connect — tap Start to retry"
          live -> "Streaming to phone"
          stale -> "No data — reconnecting…"
          streaming -> "Streaming — waiting for first reading…"
          discovering -> "Discoverable — connect from the phone"
          else -> "Tap Start, then connect from the phone"
        }

        Column(
          modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 32.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = "Terra Grip",
            modifier = Modifier.size(64.dp),
          )

          if (live) {
            Text(
              text = "${bpm.toInt()} bpm",
              style = MaterialTheme.typography.title2,
            )
          }

          Text(
            text = status,
            style = MaterialTheme.typography.caption2,
            textAlign = TextAlign.Center,
          )

          // One control drives the whole flow. Start → discoverable → phone
          // connects → streaming auto-starts. Stop tears the stream down.
          Chip(
            onClick = {
              if (active) {
                StreamingService.stop(this@MainActivity)
                streaming = false
                discovering = false
                lastHrAt = 0L
              } else {
                failed = false
                discovering = true
                terra.startBluetoothDiscovery { connected ->
                  this@MainActivity.runOnUiThread {
                    discovering = false
                    if (connected) {
                      StreamingService.start(this@MainActivity)
                      streaming = true
                    } else {
                      failed = true
                    }
                  }
                }
              }
            },
            label = { Text(if (active) "Stop" else "Start") },
            colors = if (active) ChipDefaults.secondaryChipColors()
            else ChipDefaults.primaryChipColors(),
            modifier = Modifier.fillMaxWidth(),
          )
        }
      }
    }
  }
}
