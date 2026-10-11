# Flower draw

A simple webcam playground that stamps clusters of five flowers along your index fingertip. Each cluster mixes a normal-sized flower with smaller flowers in different colors. The color picker sets the main flower color, and the size slider scales the whole cluster. Extend only your index finger, keeping your middle, ring, and little fingers curled, and move your hand to draw. Bend your index finger or raise another finger to stop. Includes colors, flower size, undo, clear, pause, PNG export, and mouse/touch drawing.

Run locally from this directory:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000 and select **Turn on camera**. Allow camera access, then hold your hand in view in good lighting. Use **Try without camera** to draw with a mouse or touch. Stop the camera to return to mouse mode.

Camera and hand processing run on your device. Internet access is required to download the pinned MediaPipe JavaScript/WASM and hand model when enabling the camera. Use localhost or HTTPS; opening the HTML file directly is not supported. PNG exports include the mirrored camera image when the camera is on, or a lavender background when off.

Tracking follows Google's [MediaPipe Hand Landmarker web API](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js). No package installation or build is needed.
