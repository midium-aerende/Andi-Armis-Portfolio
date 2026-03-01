(() => {
  const vertexShader = `
            varying vec2 vUv;
            varying float vDistortion;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            uniform float uTime;
            uniform vec2 uCursor;
            uniform float uSpeed;

            float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
            vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
            vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
            vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
            vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

            float snoise(vec3 v){
              const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
              const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
              vec3 i  = floor(v + dot(v, C.yyy) );
              vec3 x0 =   v - i + dot(i, C.xxx) ;
              vec3 g = step(x0.yzx, x0.xyz);
              vec3 l = 1.0 - g;
              vec3 i1 = min( g.xyz, l.zxy );
              vec3 i2 = max( g.xyz, l.zxy );
              vec3 x1 = x0 - i1 + C.xxx;
              vec3 x2 = x0 - i2 + C.yyy;
              vec3 x3 = x0 - D.yyy;
              i = mod289(i);
              vec4 p = permute( permute( permute(
                         i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                       + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                       + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
              float n_ = 0.142857142857;
              vec3  ns = n_ * D.wyz - D.xzx;
              vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
              vec4 x_ = floor(j * ns.z);
              vec4 y_ = floor(j - 7.0 * x_ );
              vec4 x = x_ *ns.x + ns.yyyy;
              vec4 y = y_ *ns.x + ns.yyyy;
              vec4 h = 1.0 - abs(x) - abs(y);
              vec4 b0 = vec4( x.xy, y.xy );
              vec4 b1 = vec4( x.zw, y.zw );
              vec4 s0 = floor(b0)*2.0 + 1.0;
              vec4 s1 = floor(b1)*2.0 + 1.0;
              vec4 sh = -step(h, vec4(0.0));
              vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
              vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
              vec3 p0 = vec3(a0.xy,h.x);
              vec3 p1 = vec3(a0.zw,h.y);
              vec3 p2 = vec3(a1.xy,h.z);
              vec3 p3 = vec3(a1.zw,h.w);
              vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
              p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
              vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
              m = m * m;
              return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
            }

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                float noise = snoise(vec3(position.xy * 0.04 + uCursor * 0.3, uTime * 0.3));
                float distortion = noise * (uSpeed * 0.0 + 1.5);
                vDistortion = distortion;
                vec3 newPosition = position + normal * distortion;
                vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

  const fragmentShader = `
            varying vec2 vUv;
            varying float vDistortion;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            uniform float uTime;

            vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
                return a + b*cos( 6.28318*(c*t+d) );
            }

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - dot(viewDir, normal), 2.5);

                float noiseShift = vDistortion * 0.25;

                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.00, 0.33, 0.67);

                vec3 spectral = pal(fresnel * 1.5 + uTime * 0.1 + noiseShift, a, b, c, d);

                vec2 grid = abs(fract(vUv * 30.0 - 0.5) - 0.5) / fwidth(vUv * 30.0);
                float line = min(grid.x, grid.y);
                float wireframe = 1.0 - smoothstep(0.0, 1.2, line);

                vec3 wireColor = vec3(0.0, 0.4, 1.0) * wireframe * 0.3;
                float spec = pow(fresnel, 15.0);

                vec3 finalColor = spectral * fresnel + wireColor + spec * 1.2;

                float alpha = mix(0.05, 0.85, fresnel);

                gl_FragColor = vec4(finalColor, alpha);
            }
        `;

  const cursor = document.getElementById('cursor');
  const revealImg = document.getElementById('reveal-img');
  const container = document.getElementById('canvas-container');

  const markLoaded = () => document.body.classList.add('loaded');
  if (document.readyState === 'complete') {
    markLoaded();
  } else {
    window.addEventListener('load', markLoaded, { once: true });
  }

  if (!container || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const uniforms = {
    uTime: { value: 0.0 },
    uCursor: { value: new THREE.Vector2(0, 0) },
    uSpeed: { value: 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending
  });

  const geometry = new THREE.IcosahedronGeometry(18, 64);
  const bubble = new THREE.Mesh(geometry, material);
  scene.add(bubble);
  camera.position.z = 45;

  const lastMousePos = new THREE.Vector2(0, 0);
  const currentMousePos = new THREE.Vector2(0, 0);

  function animate(time) {
    requestAnimationFrame(animate);
    uniforms.uTime.value = time * 0.001;
    const speed = Math.sqrt(
      Math.pow(currentMousePos.x - lastMousePos.x, 2) +
      Math.pow(currentMousePos.y - lastMousePos.y, 2)
    );
    uniforms.uSpeed.value += (speed * 20.0 - uniforms.uSpeed.value) * 0.05;
    lastMousePos.copy(currentMousePos);
    bubble.rotation.y += 0.001;
    renderer.render(scene, camera);
  }

  animate(0);

  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    currentMousePos.set(x, y);

    if (typeof gsap !== 'undefined') {
      gsap.to(uniforms.uCursor.value, { x, y, duration: 2.0 });
      if (cursor) {
        gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.1 });
      }
      if (revealImg) {
        gsap.to(revealImg, { x: e.clientX, y: e.clientY, duration: 0.6 });
      }
    } else {
      uniforms.uCursor.value.set(x, y);
      if (cursor) {
        cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
      if (revealImg) {
        revealImg.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
