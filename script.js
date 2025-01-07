// script.js

// Constants
const ROTATION_SPEED = 0.005; // Basis rotatiesnelheid
const TEXTURE_PATHS = [
    "textures/die1.png",
    "textures/die2.png",
    "textures/die3.png",
    "textures/die4.png",
    "textures/die5.png",
    "textures/die6.png"
];

// Global Variables
let gl;
let program;
let canvas;
let score = 0;
let isRolling = false;
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };
let textures = [];
let lastTime = 0;

// Uniform Locations
let uProjection, uTranslation, uRotationX, uRotationY;
let uLightPos, uAmbient, uDiffuse, uSpecular;

// HTML Elements
const scoreElement = document.getElementById("score");

// Initialisatie bij het laden van de pagina
window.onload = function() {
    canvas = document.getElementById("myCanvas");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        alert("WebGL 2.0 is niet beschikbaar.");
        return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);

    initializeShaders();
    initializeBuffers();
    loadTextures();
    initializeMatrices();
    initializeLighting();
    initializeEvents();

    requestAnimationFrame(render);
};

// Shader Initialisatie
function initializeShaders() {
    const vsSource = `#version 300 es
    in vec3 aPos;
    in vec3 aNormal;
    in vec2 aTexCoord;

    uniform mat4 uProjection;
    uniform mat4 uTranslation;
    uniform float uRotationX;
    uniform float uRotationY;

    out vec3 Normal;
    out vec3 FragPos;
    out vec2 TexCoord;

    void main() {
        // Rotatie rond X-as
        mat4 rotationX = mat4(
            1.0, 0.0, 0.0, 0.0,
            0.0, cos(uRotationX), sin(uRotationX), 0.0,
            0.0, -sin(uRotationX), cos(uRotationX), 0.0,
            0.0, 0.0, 0.0, 1.0
        );

        // Rotatie rond Y-as
        mat4 rotationY = mat4(
            cos(uRotationY), 0.0, -sin(uRotationY), 0.0,
            0.0, 1.0, 0.0, 0.0,
            sin(uRotationY), 0.0, cos(uRotationY), 0.0,
            0.0, 0.0, 0.0, 1.0
        );

        mat4 rotation = rotationY * rotationX;
        mat4 model = uTranslation * rotation;

        gl_Position = uProjection * model * vec4(aPos, 1.0);
        FragPos = vec3(model * vec4(aPos, 1.0));
        Normal = mat3(transpose(inverse(model))) * aNormal;
        TexCoord = aTexCoord;
    }`;

    const fsSource = `#version 300 es
    precision mediump float;

    in vec3 Normal;
    in vec3 FragPos;
    in vec2 TexCoord;

    uniform sampler2D uTextures[6];
    uniform vec3 uLightPos;
    uniform float uAmbient;
    uniform float uDiffuse;
    uniform float uSpecular;

    out vec4 FragColor;

    void main() {
        // Bepaal welke zijde we bekijken
        // Gebruik de normale vector om de zijde te bepalen
        int face;
        if (abs(Normal.x - 1.0) < 0.001) {
            face = 0; // Rechts
        } else if (abs(Normal.x + 1.0) < 0.001) {
            face = 1; // Links
        } else if (abs(Normal.y - 1.0) < 0.001) {
            face = 2; // Boven
        } else if (abs(Normal.y + 1.0) < 0.001) {
            face = 3; // Onder
        } else if (abs(Normal.z - 1.0) < 0.001) {
            face = 4; // Voor
        } else {
            face = 5; // Achter
        }

        vec4 texColor = texture(uTextures[face], TexCoord);

        // Belichting berekeningen
        vec3 norm = normalize(Normal);
        vec3 lightDir = normalize(uLightPos - FragPos);
        float diff = max(dot(norm, lightDir), 0.0);

        vec3 viewDir = normalize(-FragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

        vec3 ambient = uAmbient * vec3(texColor);
        vec3 diffuse = uDiffuse * diff * vec3(texColor);
        vec3 specular = uSpecular * spec * vec3(1.0);

        vec3 finalColor = ambient + diffuse + specular;
        FragColor = vec4(finalColor, texColor.a);
    }`;

    const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Shader programma mislukt:", gl.getProgramInfoLog(program));
        return;
    }

    gl.useProgram(program);
}

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilatie mislukt:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Buffer Initialisatie
let vao;
let positionBuffer, normalBuffer, texCoordBuffer;
function initializeBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Definieer de vertices van de kubus met posities, normals en texcoords
    const vertices = new Float32Array([
        // Posities         // Normals          // TexCoords
        // Front face
        1,  1,  1,          0,  0,  1,           1, 1,
        1, -1,  1,          0,  0,  1,           1, 0,
       -1, -1,  1,          0,  0,  1,           0, 0,
       -1, -1,  1,          0,  0,  1,           0, 0,
       -1,  1,  1,          0,  0,  1,           0, 1,
        1,  1,  1,          0,  0,  1,           1, 1,

        // Back face
        1,  1, -1,          0,  0, -1,           1, 1,
        1, -1, -1,          0,  0, -1,           1, 0,
       -1, -1, -1,          0,  0, -1,           0, 0,
       -1, -1, -1,          0,  0, -1,           0, 0,
       -1,  1, -1,          0,  0, -1,           0, 1,
        1,  1, -1,          0,  0, -1,           1, 1,

        // Right face
        1,  1,  1,          1,  0,  0,           1, 1,
        1, -1,  1,          1,  0,  0,           1, 0,
        1, -1, -1,          1,  0,  0,           0, 0,
        1, -1, -1,          1,  0,  0,           0, 0,
        1,  1, -1,          1,  0,  0,           0, 1,
        1,  1,  1,          1,  0,  0,           1, 1,

        // Left face
       -1,  1,  1,         -1,  0,  0,           1, 1,
       -1, -1,  1,         -1,  0,  0,           1, 0,
       -1, -1, -1,         -1,  0,  0,           0, 0,
       -1, -1, -1,         -1,  0,  0,           0, 0,
       -1,  1, -1,         -1,  0,  0,           0, 1,
       -1,  1,  1,         -1,  0,  0,           1, 1,

        // Top face
        1,  1,  1,          0,  1,  0,           1, 1,
       -1,  1,  1,          0,  1,  0,           1, 1,
       -1,  1, -1,          0,  1,  0,           0, 1,
       -1,  1, -1,          0,  1,  0,           0, 1,
        1,  1, -1,          0,  1,  0,           0, 1,
        1,  1,  1,          0,  1,  0,           1, 1,

        // Bottom face
        1, -1,  1,          0, -1,  0,           1, 1,
       -1, -1,  1,          0, -1,  0,           1, 1,
       -1, -1, -1,          0, -1,  0,           0, 1,
       -1, -1, -1,          0, -1,  0,           0, 1,
        1, -1, -1,          0, -1,  0,           0, 1,
        1, -1,  1,          0, -1,  0,           1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Position attrib
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 32, 0);

    // Normal attrib
    const aNormal = gl.getAttribLocation(program, "aNormal");
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 32, 12);

    // TexCoord attrib
    const aTexCoord = gl.getAttribLocation(program, "aTexCoord");
    gl.enableVertexAttribArray(aTexCoord);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 32, 24);
}

// Texturen Laden
function loadTextures() {
    for (let i = 0; i < TEXTURE_PATHS.length; i++) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Placeholder 1x1 pixel
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        const pixel = new Uint8Array([255, 255, 255, 255]); // Witte pixel
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

        // Laad de daadwerkelijke afbeelding
        const image = new Image();
        image.src = TEXTURE_PATHS[i];
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
            gl.generateMipmap(gl.TEXTURE_2D);
        };
        image.onerror = function() {
            console.error(`Fout bij het laden van de texture: ${TEXTURE_PATHS[i]}`);
        };

        // Texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        textures.push(texture);
    }

    // Wijs texturen toe aan de shader
    const uTextures = gl.getUniformLocation(program, "uTextures");
    gl.uniform1i(uTextures, 0); // Texture unit 0
}

// Matrix Initialisatie
function initializeMatrices() {
    // Projection matrix (perspectief)
    uProjection = gl.getUniformLocation(program, "uProjection");
    const fov = 45 * Math.PI / 180; // 45 graden
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = perspective(fov, aspect, zNear, zFar);
    gl.uniformMatrix4fv(uProjection, false, projectionMatrix);

    // Translation matrix
    uTranslation = gl.getUniformLocation(program, "uTranslation");
    const translationMatrix = translate(0, 0, -6);
    gl.uniformMatrix4fv(uTranslation, false, translationMatrix);
}

// Belichting Initialisatie
function initializeLighting() {
    uLightPos = gl.getUniformLocation(program, "uLightPos");
    uAmbient = gl.getUniformLocation(program, "uAmbient");
    uDiffuse = gl.getUniformLocation(program, "uDiffuse");
    uSpecular = gl.getUniformLocation(program, "uSpecular");

    // Initiale waarden
    gl.uniform3fv(uLightPos, [5.0, 5.0, 5.0]);
    gl.uniform1f(uAmbient, 0.3);
    gl.uniform1f(uDiffuse, 0.7);
    gl.uniform1f(uSpecular, 1.0);
}

// Evenementen Initialisatie
function initializeEvents() {
    // Spatiebalk om te rollen
    window.addEventListener("keydown", function(event) {
        if (event.code === "Space" && !isRolling) {
            rollDie();
        }
    });

    // Muis bewegen om de lichtbron aan te passen
    canvas.addEventListener("mousemove", function(event) {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / canvas.width) * 10 - 5; // Van -5 tot +5
        const y = ((event.clientY - rect.top) / canvas.height) * 10 - 5; // Van -5 tot +5
        gl.uniform3fv(uLightPos, [x, y, 5.0]);
    });

    // Toetsenbord controles voor belichting
    window.addEventListener("keydown", function(event) {
        switch (event.key) {
            case "a": // Verhoog ambient
                gl.uniform1f(uAmbient, Math.min(1.0, gl.getUniform(program, uAmbient) + 0.05));
                break;
            case "z": // Verlaag ambient
                gl.uniform1f(uAmbient, Math.max(0.0, gl.getUniform(program, uAmbient) - 0.05));
                break;
            case "s": // Verhoog diffuse
                gl.uniform1f(uDiffuse, Math.min(5.0, gl.getUniform(program, uDiffuse) + 0.05));
                break;
            case "x": // Verlaag diffuse
                gl.uniform1f(uDiffuse, Math.max(0.0, gl.getUniform(program, uDiffuse) - 0.05));
                break;
            case "d": // Verhoog specular
                gl.uniform1f(uSpecular, Math.min(5.0, gl.getUniform(program, uSpecular) + 0.05));
                break;
            case "c": // Verlaag specular
                gl.uniform1f(uSpecular, Math.max(0.0, gl.getUniform(program, uSpecular) - 0.05));
                break;
        }
    });
}

// Render Functie
function render(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Automatische rotatie als niet aan het rollen
    if (!isRolling) {
        currentRotation.x += ROTATION_SPEED;
        currentRotation.y += ROTATION_SPEED;
    }

    // Update rotatie uniformen
    const uRotationX = gl.getUniformLocation(program, "uRotationX");
    const uRotationY = gl.getUniformLocation(program, "uRotationY");
    gl.uniform1f(uRotationX, currentRotation.x);
    gl.uniform1f(uRotationY, currentRotation.y);

    // Bind texturen
    for (let i = 0; i < textures.length; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, textures[i]);
    }

    // Render de kubus (dobbelsteen)
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 36);

    requestAnimationFrame(render);
}

// Dobbelsteen Rollen
function rollDie() {
    isRolling = true;

    // Genereer een willekeurig nummer tussen 1 en 6
    const randomNumber = Math.floor(Math.random() * 6) + 1;
    console.log(`Gegooid: ${randomNumber}`);

    // Update score
    score += randomNumber;
    scoreElement.innerText = `Score: ${score}`;

    // Bepaal de eindrotatie zodat de juiste zijde naar boven komt
    // Dit is vereenvoudigd en kan worden aangepast voor nauwkeurigere uitlijning
    const rotations = {
        1: { x: 0, y: 0 },
        2: { x: Math.PI / 2, y: 0 },
        3: { x: Math.PI, y: 0 },
        4: { x: -Math.PI / 2, y: 0 },
        5: { x: 0, y: Math.PI / 2 },
        6: { x: 0, y: -Math.PI / 2 }
    };

    const target = rotations[randomNumber];
    targetRotation.x = currentRotation.x + target.x + (Math.random() * Math.PI * 4); // Extra rotaties voor realisme
    targetRotation.y = currentRotation.y + target.y + (Math.random() * Math.PI * 4);

    // Animatie functie
    function animate() {
        if (currentRotation.x < targetRotation.x) {
            currentRotation.x += ROTATION_SPEED;
            gl.uniform1f(uRotationX, currentRotation.x);
        }
        if (currentRotation.y < targetRotation.y) {
            currentRotation.y += ROTATION_SPEED;
            gl.uniform1f(uRotationY, currentRotation.y);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Bind texturen
        for (let i = 0; i < textures.length; i++) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        }

        // Render de kubus
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 36);

        if (currentRotation.x < targetRotation.x || currentRotation.y < targetRotation.y) {
            requestAnimationFrame(animate);
        } else {
            isRolling = false;
        }
    }

    requestAnimationFrame(animate);
}

// Matrix Hulpfuncties
function perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
}

function translate(x, y, z) {
    const out = new Float32Array(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = x;
    out[13] = y;
    out[14] = z;
    out[15] = 1;
    return out;
}
