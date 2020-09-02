export { generate_chars_svg, main }

// base from https://threejsfundamentals.org/threejs/threejs-shadertoy-bleepy-blocks.html

import * as THREE from "./three.module.js"

function rando_canvas() {
  let canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256

  let ctx = canvas.getContext("2d")
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  imageData.data.forEach((x, i) => {
    if (i % 4 === 3) {
      //hopefully alpha :D
      imageData.data[i] = 255
    } else {
      imageData.data[i] = Math.floor(Math.random() * 255)
    }
  })
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL("image/png")
}

function chars_svg(val) {
  let one_sym = []
  for (let i in val) {
    if (i.length == 1) {
      one_sym.push(i)
    }
  }

  let width = 16
  let height = 16

  let svg_namespace = "http://www.w3.org/2000/svg"
  let nsvg = document.createElementNS(svg_namespace, "svg")
  nsvg.setAttribute("xmlns", svg_namespace)
  nsvg.setAttribute("width", "1024px")
  nsvg.setAttribute("height", "1024px")
  let rect = document.createElementNS(svg_namespace, "rect")
  rect.setAttribute("width", "100%")
  rect.setAttribute("height", "100%")
  nsvg.appendChild(rect)

  for (let count = 0; count < width * height; count++) {
    let rando = Math.floor(Math.random() * one_sym.length)
    let txt = document.createElementNS(svg_namespace, "text")
    txt.setAttribute("x", 64 * (count % width) + 8)
    txt.setAttribute("y", 64 * Math.floor(count / height) + 48)
    txt.setAttribute("font-size", "45")
    txt.setAttribute("fill", "red")
    txt.innerHTML = one_sym[rando]
    nsvg.appendChild(txt)
  }

  return "data:image/svg+xml;utf8," + nsvg.outerHTML
}

function generate_chars_svg() {
  if (window.audio_map) {
    return new Promise((x) => {
      x(chars_svg(window.audio_map))
    })
  } else {
    return fetch("data/flac/key.json").then((x) => {
      if (x.ok) {
        return x.json().then((val) => {
          window.audio_map = val
          return chars_svg(val)
        })
      }
    })
  }
}

function main(chars_svg, start_color = "green") {
  const canvas = document.querySelector("#c")
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true })

  const camera = new THREE.OrthographicCamera(
    -1, // left
    1, // right
    1, // top
    -1, // bottom
    -1, // near,
    1 // far
  )
  const scene = new THREE.Scene()
  const plane = new THREE.PlaneBufferGeometry(2, 2)

  const fragmentShader = `
  #include <common>

  uniform vec3 iResolution;
  uniform vec3 iChannelResolution[4]; // channel resolution (in pixels)
  uniform float iTime;
  uniform sampler2D iChannel0;
  uniform sampler2D iChannel1;
  uniform vec3 color;

  // ripped from https://www.shadertoy.com/embed/ldccW4

  vec3 rain(in vec2 fragCoord)
  {
    fragCoord.x -= mod(fragCoord.x, 32.);
    float rando = texture(iChannel1, vec2((fragCoord.x / iResolution.x) , fragCoord.x)).x;
    float speed = (rando * .3) + .1 ;

    float y = fract(fragCoord.y / iResolution.y + iTime * speed + rando);
    return color / (y * 20.);
  }

  float text(vec2 fragCoord)
  {
    float scale = 1. / 32.;
    vec2 uv = fract(fragCoord.xy / 32.);
    vec2 block = fragCoord * scale - uv;
    uv = uv * .9 + .001; // scale the letters up a bit
    uv += floor(texture(iChannel1, block/vec2(256.0, 256.0) + iTime*.0005).xy * 16.); // randomize letters
    uv *= 1. / 16.; // bring back into 0-1 range
    return texture(iChannel0, uv).r;
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {    
   // float text =text(fragCoord);
   // fragColor = vec4(0,text,0.0,1.0);
    fragColor = vec4(text(fragCoord) * rain(fragCoord), fragCoord.y / iResolution.y / 2.);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
  `
  const loader = new THREE.TextureLoader()
  const noise_texture = loader.load(rando_canvas())
  const chars_texture = loader.load(chars_svg)
  chars_texture.minFilter = THREE.NearestFilter
  chars_texture.magFilter = THREE.NearestFilter
  chars_texture.wrapS = THREE.RepeatWrapping
  chars_texture.wrapT = THREE.RepeatWrapping

  let cred = new THREE.Vector3(1.0, 0.2, 0.15)
  let cgreen = new THREE.Vector3(0.1, 1.0, 0.35)

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
    iChannel0: { value: chars_texture },
    iChannel1: { value: noise_texture },
    color: { value: start_color == "green" ? cgreen : cred },
  }
  const material = new THREE.ShaderMaterial({
    fragmentShader,
    uniforms,
    transparent: true,
  })
  scene.add(new THREE.Mesh(plane, material))

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const needResize = canvas.width !== width || canvas.height !== height
    if (needResize) {
      renderer.setSize(width, height, false)
    }
    return needResize
  }

  let rando_off = Math.random() * 10000

  function render(time) {
    if (document.querySelector("#c").style.visibility == "hidden") {
      console.log(time)
      return
    }

    time += rando_off
    time *= 0.001 // convert to seconds
    resizeRendererToDisplaySize(renderer)

    const canvas = renderer.domElement
    uniforms.iResolution.value.set(canvas.width, canvas.height, 1)
    uniforms.iTime.value = time

    renderer.render(scene, camera)

    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)
}
