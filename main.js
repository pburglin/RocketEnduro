// Three.js is loaded via CDN script in index.html, using global THREE object
// Game variables
let score = 0;
let highScore = Number(localStorage.getItem('enduroHighScore')) || 0;
let gameSpeed = 1;
let isGameOver = false;
let leftPressed = false;
let rightPressed = false;
let upPressed = false;
const carSpeedX = 0.15; // Horizontal speed of the car
const carAcceleration = 0.005; // Increased acceleration
const carDeceleration = 0.0015; // Slightly faster deceleration
const maxSpeed = 0.6; // Increased max speed
const minSpeed = 0.3;
let currentSpeed = 0.1; // Start at min speed
const baseCameraDistance = 5;
const maxCameraDistance = 10;
const roadWidth = 9; // Effective playable width (Road width 10 - Car width 1)

// Curve variables
let currentCurve = 0; // Current curve angle in radians
let curveSegments = []; // Array of {zPos, curveAngle}
let nextCurveZ = 200; // Z position of next curve
const maxCurveAngle = Math.PI/8; // Maximum curve angle
let curveSpawnTimer = 0;

// Opponent variables
const opponentCars = [];
let opponentSpawnTimer = 100; // Initial delay before first spawn
const opponentSpawnIntervalBase = 120; // Base frames between spawns (adjusts with speed)
const opponentSpeedFactor = 0.8; // Opponents move slightly slower than gameSpeed scroll

// Scenario variables
let currentScenario = 'start'; // 'start', 'snow', 'mist', 'night'
const scenarioThresholds = {
    snow: 500,
    mist: 2500,
    night: 3500,
    start: 4500,
    mist: 5500,
    snow: 6500,
    night: 7500,
    start: 8500,
    // Add more thresholds for cycling or increasing difficulty within scenarios
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

// Road
const roadGeometry = new THREE.BoxGeometry(10, 0.1, 1000);
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
const road = new THREE.Mesh(roadGeometry, roadMaterial);
road.position.y = -0.5;
scene.add(road);

// Road Markers
const guardrailGeometry = new THREE.BoxGeometry(0.1, 0.5, 1000);
const dashGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5);
const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

// Store marker references
const roadMarkers = {
    leftGuardrail: null,
    rightGuardrail: null,
    laneDashes: []
};

// Left guardrail
roadMarkers.leftGuardrail = new THREE.Mesh(guardrailGeometry, markerMaterial);
roadMarkers.leftGuardrail.position.set(-5.5, -0.25, 0);
scene.add(roadMarkers.leftGuardrail);

// Right guardrail
roadMarkers.rightGuardrail = new THREE.Mesh(guardrailGeometry, markerMaterial);
roadMarkers.rightGuardrail.position.set(5.5, -0.25, 0);
scene.add(roadMarkers.rightGuardrail);

// Lane dashes
const dashSpacing = 2;
for (let z = -500; z < 500; z += dashSpacing) {
    const dash = new THREE.Mesh(dashGeometry, markerMaterial);
    dash.position.set(0, -0.45, z);
    roadMarkers.laneDashes.push(dash);
    scene.add(dash);
}

// Player car
const carGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const car = new THREE.Mesh(carGeometry, carMaterial);
car.position.z = -5;
scene.add(car);

// Opponent Car Setup
const opponentGeometry = new THREE.BoxGeometry(1, 0.5, 2);
const opponentMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });

function spawnOpponentCar() {
    const opponent = new THREE.Mesh(opponentGeometry, opponentMaterial);
    
    // Position opponent
    opponent.position.x = (Math.random() - 0.5) * roadWidth;
    opponent.position.y = 0; // Same level as player car
    opponent.position.z = car.position.z - 100 - (Math.random() * 100); // Spawn ahead of the player
    
    scene.add(opponent);
    opponentCars.push(opponent);
}


// Camera setup (behind the car)
camera.position.set(0, 2, car.position.z + 5); // Position behind and slightly above the car
camera.lookAt(car.position.x, car.position.y, car.position.z); // Look at the car

// Controls (Removed OrbitControls)

// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    
    if (!isGameOver) {
        // Handle acceleration/deceleration
        if (upPressed) {
            currentSpeed += carAcceleration;
        } else {
            currentSpeed -= carDeceleration;
        }
        currentSpeed = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed));

        // Move car forward
        car.position.z -= currentSpeed * gameSpeed;

        // Handle car horizontal movement with curve physics
        if (leftPressed || rightPressed) {
            // Calculate curve resistance factor (0-1 based on speed)
            const resistance = Math.min(1, currentSpeed * 2.5);
            
            // Apply movement with curve resistance
            if (leftPressed) {
                car.position.x -= carSpeedX * (1 - resistance * Math.max(0, currentCurve));
            }
            if (rightPressed) {
                car.position.x += carSpeedX * (1 - resistance * Math.max(0, -currentCurve));
            }
            
            // Natural drift toward tangent of curve
            car.position.x += currentCurve * currentSpeed * 0.1;
        }

        // Clamp car position to road boundaries
        car.position.x = Math.max(-roadWidth / 2, Math.min(roadWidth / 2, car.position.x));

        // Move road and markers illusion
        const moveSpeed = currentSpeed * 0.5 * gameSpeed;
        road.position.z += moveSpeed;
        
        // Move guardrails
        roadMarkers.leftGuardrail.position.z += moveSpeed;
        roadMarkers.rightGuardrail.position.z += moveSpeed;
        
        // Move lane dashes
        roadMarkers.laneDashes.forEach(dash => {
            dash.position.z += moveSpeed;
        });
        
        // Reset positions periodically
        if (road.position.z > 500) {
            road.position.z -= 1000;
            roadMarkers.leftGuardrail.position.z -= 1000;
            roadMarkers.rightGuardrail.position.z -= 1000;
            roadMarkers.laneDashes.forEach(dash => {
                if (dash.position.z > 500) dash.position.z -= 1000;
            });
        }

       // --- Opponent Logic ---
       // Spawn opponents
       opponentSpawnTimer--;
       if (opponentSpawnTimer <= 0) {
           // Spawn more opponents as score increases (1-3 cars)
           const carsToSpawn = 1 + Math.min(2, Math.floor(score / 2000));
           for (let i = 0; i < carsToSpawn; i++) {
               spawnOpponentCar();
           }
           // Reset timer - faster spawns as game speeds up
           opponentSpawnTimer = Math.max(20, opponentSpawnIntervalBase / (gameSpeed * 1.5));
       }

       // Move opponents and check collisions
       const playerBox = new THREE.Box3().setFromObject(car);
       for (let i = opponentCars.length - 1; i >= 0; i--) {
           const opponent = opponentCars[i];
           
           // Move opponent forward (relative to car movement) with curve effect
           opponent.position.z += currentSpeed * gameSpeed * opponentSpeedFactor;
           opponent.position.x += currentCurve * currentSpeed * 0.05; // Slight curve drift

           // Check for collision
           const opponentBox = new THREE.Box3().setFromObject(opponent);
           if (playerBox.intersectsBox(opponentBox)) {
               // Crash effect - red flicker
               let flashCount = 0;
               const flashInterval = setInterval(() => {
                   scene.background = flashCount % 2 === 0 ?
                       new THREE.Color(0xff0000) :
                       new THREE.Color(0x000000);
                   flashCount++;
                   if (flashCount > 5) {
                       clearInterval(flashInterval);
                       isGameOver = true;
                       carMaterial.color.set(0x888888);
                       opponentMaterial.color.set(0x888888);
                       console.log("Game Over! Collision detected.");
                   }
               }, 100);
               break;
           }

           // Remove opponents that are behind the camera
           if (opponent.position.z > camera.position.z) {
               scene.remove(opponent);
               opponentCars.splice(i, 1);
           }
       }
       // --- End Opponent Logic ---

       // Update score based on distance moved (faster when accelerating)
       // Base score of 0.1 at minSpeed, up to 0.2 at maxSpeed, multiplied by gameSpeed
       score += (0.1 + (currentSpeed - minSpeed) * 0.25) * gameSpeed;
       const currentScore = Math.floor(score);
       
       // Update high score if current score is higher
       if (currentScore > highScore) {
           highScore = currentScore;
           localStorage.setItem('enduroHighScore', highScore);
       }
       
       document.getElementById('score-display').innerHTML = `
           <div>Score: ${currentScore}</div>
           <div>High Score: ${highScore}</div>
       `;

       // --- Scenario Update Logic ---
       let nextScenario = 'start';
       if (currentScore >= scenarioThresholds.night) {
           nextScenario = 'night';
       } else if (currentScore >= scenarioThresholds.mist) {
           nextScenario = 'mist';
       } else if (currentScore >= scenarioThresholds.snow) {
           nextScenario = 'snow';
       }
       
       if (nextScenario !== currentScenario) {
           currentScenario = nextScenario;
           console.log(`Switching to scenario: ${currentScenario}`);
           switch (currentScenario) {
               case 'start': setStartScenario(); break;
               case 'snow': setSnowScenario(); break;
               case 'mist': setMistScenario(); break;
               case 'night': setNightScenario(); break;
           }
       }
       // --- End Scenario Update Logic ---
       
       // Generate curves periodically
       if (curveSpawnTimer <= 0 && Math.abs(currentCurve) < 0.01) {
           // More frequent and sharper curves as score increases
           const difficultyFactor = Math.min(2, 1 + score / 5000); // Scales from 1 to 2
           currentCurve = (Math.random() > 0.5 ? 1 : -1) *
                        (0.5 + Math.random() * 0.5) * // 50-100% of max angle
                        maxCurveAngle * difficultyFactor;
           
           // Reduce spawn interval based on score
           curveSpawnTimer = Math.max(50, 300 / difficultyFactor + Math.random() * 100);
       } else if (curveSpawnTimer > 0) {
           curveSpawnTimer--;
       }
       
       // Gradually reduce current curve
       if (Math.abs(currentCurve) > 0.01) {
           currentCurve *= 0.99;
       } else {
           currentCurve = 0;
       }
       
       // Increase difficulty
       gameSpeed += 0.0001;
       
       // More opponents during curves
       if (Math.abs(currentCurve) > 0.1) {
           opponentSpawnTimer -= 2; // Spawn twice as fast during curves
       }

        // Update camera to follow car with dynamic distance based on speed
        const cameraDistance = baseCameraDistance +
            ((currentSpeed - minSpeed) / (maxSpeed - minSpeed)) * (maxCameraDistance - baseCameraDistance);
        camera.position.x = car.position.x * 0.5; // Dampen camera horizontal movement
        camera.position.y = 2;
        camera.position.z = car.position.z + cameraDistance;
        camera.lookAt(car.position.x, car.position.y, car.position.z);

    }
    
    // controls.update(); // Removed OrbitControls update
    renderer.render(scene, camera);
} // <-- Added missing closing brace for animate function

// --- Scenario Functions ---
function resetScenario() {
    scene.background = null; // Default background
    scene.fog = null; // Remove fog
    ambientLight.intensity = 0.5;
    directionalLight.intensity = 0.8;
    directionalLight.color.set(0xffffff);
    roadMaterial.color.set(0x333333); // Reset road color
    
    // Show/hide road markers based on scenario
    const showMarkers = currentScenario === 'start' || currentScenario === 'night';
    roadMarkers.leftGuardrail.visible = showMarkers;
    roadMarkers.rightGuardrail.visible = showMarkers;
    roadMarkers.laneDashes.forEach(dash => dash.visible = showMarkers);
    
    // Remove snow particles if they exist
}

function setStartScenario() {
    resetScenario();
    // Any specific setup for the start? Usually just the default.
}

function setSnowScenario() {
    resetScenario();
    scene.background = new THREE.Color(0xcccccc); // Light grey background
    roadMaterial.color.set(0xffffff); // White road
    
    // Snow physics - reduced friction and momentum
    const originalCarSpeedX = carSpeedX;
    let momentumX = 0;
    const snowFriction = 0.3; // Reduced friction coefficient
    
    // Modify car movement during snow
    const originalAnimate = animate;
    animate = function() {
        if (currentScenario === 'snow') {
            // Apply momentum
            if (leftPressed) momentumX = -carSpeedX * snowFriction;
            if (rightPressed) momentumX = carSpeedX * snowFriction;
            
            // Continue drifting with momentum
            car.position.x += momentumX;
            
            // Gradually reduce momentum
            momentumX *= 0.95;
        }
        originalAnimate.apply(this, arguments);
    };
}

function setMistScenario() {
    resetScenario();
    scene.background = new THREE.Color(0xaaaaaa); // Grey background
    scene.fog = new THREE.Fog(0xaaaaaa, 10, 50); // Add fog (color, near, far)
}

function setNightScenario() {
    resetScenario();
    scene.background = new THREE.Color(0x111122); // Dark blue background
    ambientLight.intensity = 0.1; // Dim ambient light
    directionalLight.intensity = 0.3; // Dim directional light
    directionalLight.color.set(0xaaaaff); // Bluish light
    // TODO: Add car headlights
}
// --- End Scenario Functions ---

animate();

// Event listeners
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Keyboard controls
window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        leftPressed = true;
    } else if (event.key === 'ArrowRight') {
        rightPressed = true;
    } else if (event.key === 'ArrowUp') {
        upPressed = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') {
        leftPressed = false;
    } else if (event.key === 'ArrowRight') {
        rightPressed = false;
    } else if (event.key === 'ArrowUp') {
        upPressed = false;
    }
});