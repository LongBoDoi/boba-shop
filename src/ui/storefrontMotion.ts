/** One GPU canvas, with the same responsive composition as the static fallback. */
import type { StorefrontSources } from './storefrontArt';
import { ID, storefrontLayout } from './storefrontLayout';
import { paintStorefront, prepareStorefront, type ScenePainter } from './storefrontScene';
export { titleTransform } from './storefrontLayout';
export type { TitleTransform } from './storefrontLayout';

export interface StorefrontMotion {draw: (seconds: number,greeting: number) => void; resize: (width: number,height: number) => void; dispose: () => void}
const VERTEX = `
attribute vec2 a_position;
uniform vec4 u_box;
uniform mat3 u_transform;
uniform vec2 u_view;
varying mediump vec2 v_uv;
void main() {
  vec3 p = u_transform*vec3(u_box.xy+a_position*u_box.zw,1.0);
  gl_Position = vec4(p.x/u_view.x*2.0-1.0,1.0-p.y/u_view.y*2.0,0.0,1.0);
  v_uv = a_position;
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D u_painting;
varying mediump vec2 v_uv;
void main() {gl_FragColor = texture2D(u_painting,v_uv);}
`;
export function createStorefrontMotion(canvas: HTMLCanvasElement,image: HTMLImageElement,sources: StorefrontSources = {}): StorefrontMotion | null {
  const scene = prepareStorefront(image,sources);
  if (!scene) return null;
  const gl = canvas.getContext('webgl',{alpha: false,antialias: false,depth: false,powerPreference: 'low-power'});
  if (!gl) return null;
  const compile = (type: number,source: string) => {
    const shader = gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {gl.deleteShader(shader);return null;}return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER,VERTEX),fragment = compile(gl.FRAGMENT_SHADER,FRAGMENT);
  if (!vertex || !fragment) {if (vertex) gl.deleteShader(vertex);if (fragment) gl.deleteShader(fragment);return null;}
  const program = gl.createProgram()!;
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {gl.deleteProgram(program);return null;}
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,0,1,1,0,1,1]),gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
  gl.uniform1i(gl.getUniformLocation(program,'u_painting'),0);
  const box = gl.getUniformLocation(program,'u_box'),matrix = gl.getUniformLocation(program,'u_transform'),view = gl.getUniformLocation(program,'u_view');
  const uniforms = new Float32Array(9),textures = new Map<TexImageSource,WebGLTexture>();
  let layout = storefrontLayout(1672,941);
  const texture = (source: TexImageSource) => {
    let t = textures.get(source);
    if (t) return t;
    t = gl.createTexture()!;textures.set(source,t);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);return t;
  };
  const paint: ScenePainter = (source,rect,transform = ID,clip) => {
    if (clip) {
      gl.enable(gl.SCISSOR_TEST);
      const x = Math.floor(clip.x/layout.w*canvas.width),y = Math.floor((layout.h-clip.y-clip.h)/layout.h*canvas.height);
      gl.scissor(x,y,Math.ceil(clip.w/layout.w*canvas.width),Math.ceil(clip.h/layout.h*canvas.height));
    }
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture(source));gl.uniform4f(box,rect.x,rect.y,rect.w,rect.h);
    uniforms.set([transform.a,transform.b,0,transform.c,transform.d,0,transform.tx,transform.ty,1]);
    gl.uniformMatrix3fv(matrix,false,uniforms);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    if (clip) gl.disable(gl.SCISSOR_TEST);
  };
  return {
    draw(seconds,_greeting) {
      gl.clearColor(.984,.89,.78,1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      paintStorefront(paint,scene,layout,seconds);
    },
    resize(width,height) {
      layout = storefrontLayout(width,height);
      const ratio = Math.min(window.devicePixelRatio || 1,2,3344/width);
      canvas.width = Math.max(1,Math.round(width*ratio));canvas.height = Math.max(1,Math.round(height*ratio));
      gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(view,layout.w,layout.h);
    },
    dispose() {gl.deleteBuffer(buffer);gl.deleteProgram(program);for (const t of textures.values()) gl.deleteTexture(t);},
  };
}
