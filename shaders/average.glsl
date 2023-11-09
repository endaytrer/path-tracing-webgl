#version 300 es
precision highp float;
precision mediump usampler2D;
uniform usampler2D src;
uniform usampler2D prev;
uniform int frameCount;
uniform int needRerender;
in vec2 vUV;
out uvec4 fragColor;
void main() {
  uvec4 currentFrame = texture(src, vUV);
  uvec4 accumulatedFrame = texture(prev, vUV);
  if (needRerender == 1) {
    fragColor = currentFrame;
  } else {
    fragColor = uvec4((vec4(accumulatedFrame) * float(frameCount) + vec4(currentFrame)) / float(frameCount + 1));
  }
}