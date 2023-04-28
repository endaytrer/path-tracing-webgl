// #version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D prev;
uniform int frameCount;
uniform int needRerender;
varying vec2 vUV;
void main() {
  vec4 currentFrame = texture2D(src, vUV);
  vec4 accumulatedFrame = texture2D(prev, vUV);
  if (needRerender == 1) {
    gl_FragColor = currentFrame;
  } else {
    gl_FragColor = (accumulatedFrame * float(frameCount) + currentFrame) / float(frameCount + 1);
  }
}