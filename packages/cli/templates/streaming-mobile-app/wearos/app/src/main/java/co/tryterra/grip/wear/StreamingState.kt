// Process-level handle to the single Terra instance so the foreground
// StreamingService and the Activity share one connection. Terra must be
// constructed from an Activity (it requests runtime permissions and launches
// the discoverable-mode activity), so MainActivity owns creation and parks it
// here; the service reads it to drive the exercise while the app is
// backgrounded.

package co.tryterra.grip.wear

import co.tryterra.terrawearos.Terra

object StreamingState {
  @Volatile
  var terra: Terra? = null
}
