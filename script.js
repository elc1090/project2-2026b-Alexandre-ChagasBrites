/*import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  databaseURL: "https://elc1090-project2-2026b-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);*/

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const game = {
    timestamp: undefined,
    accum: 0
};

const assets = {
    ships: new Image(),
    tiles: new Image(),
    map: new Image()
};

let objects = [
    { 
        type: "player",
        x: 0, 
        y: 0,
        rotation: 0,
        velocity: 16.0,
        texture: assets.ships,
        textureRegion: { x: 0, y: 0, w: 32, h: 32 },
        time: 0.0
    }
];

let input = {};

assets.ships.src = "assets/ships.png";
assets.tiles.src = "assets/tiles.png";
assets.map.src = "assets/map.png";

function fract(n) { return n - Math.floor(n); }

function onStep(deltatime) {
    const newObjects = [];
    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];

        if (object.type === "player") {
            const x = (input["ArrowRight"] || 0.0) - (input["ArrowLeft"] || 0.0);
            const y = (input["ArrowUp"] || 0.0) - (input["ArrowDown"] || 0.0);

            object.velocity = Math.max(8.0, Math.min(object.velocity + y * deltatime * 8.0, 32.0));
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.rotation += x * deltatime * Math.PI;
            newObjects.push(object);

            if (object.time === 0.0 && (input["z"] || input["Z"])) {
                object.time = 0.1;
                newObjects.push({
                    type: "munition",
                    x: object.x + Math.sin(object.rotation) * 1.0,
                    y: object.y - Math.cos(object.rotation) * 1.0,
                    rotation: object.rotation,
                    velocity: 64.0,
                    texture: assets.tiles,
                    textureRegion: { x: 0, y: 0, w: 16, h: 16 },
                    time: 0.0
                });
            } else if (object.time > 0.0) {
                object.time = Math.max(0.0, object.time - deltatime);
            }

        } else if (object.type === "munition") {
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.time += deltatime;
            if (object.time < 1.0) {
                newObjects.push(object);
            }
        }

        if (object.x > assets.map.width / 16.0) { object.x -= assets.map.width / 16.0; }
        if (object.x < 0.0) { object.x += assets.map.width / 16.0; }
        if (object.y > assets.map.height / 16.0) { object.y -= assets.map.height / 16.0; }
        if (object.y < 0.0) { object.y += assets.map.height / 16.0; }
    }
    objects = newObjects;
}

function onEvent(e) {
    
}

function onRender() {
    ctx.reset();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.resetTransform();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    ctx.scale(32, 32);
    ctx.translate(-objects[0].x, -objects[0].y);

    {
        ctx.save();
        ctx.filter = "blur(1px)";
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                ctx.drawImage(assets.map, x * assets.map.width / 16.0, y * assets.map.height / 16.0, assets.map.width / 16.0, assets.map.height / 16.0);
            }
        }
        ctx.restore();
    }

    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        ctx.save();

        if (object.type === "player") {
            ctx.shadowColor = "rgb(0 0 0 / 25%)";
            ctx.shadowBlur = 2;
            ctx.shadowOffsetY = 24;
        } else if (object.type === "munition") {
            ctx.shadowColor = "#ffbd20";
            ctx.shadowBlur = 16;
        }

        let x = object.x;
        let y = object.y;

        if (x - objects[0].x > assets.map.width / 32.0) { x -= assets.map.width / 16.0; }
        if (x - objects[0].x < -assets.map.width / 32.0) { x += assets.map.width / 16.0; }
        if (y - objects[0].y > assets.map.height / 32.0) { y -= assets.map.height / 16.0; }
        if (y - objects[0].y < -assets.map.height / 32.0) { y += assets.map.height / 16.0; }

        ctx.translate(x, y);
        ctx.rotate(object.rotation);
        ctx.translate(-object.textureRegion.w / 32, -object.textureRegion.h / 32);
        ctx.drawImage(object.texture, object.textureRegion.x, object.textureRegion.y, object.textureRegion.w, object.textureRegion.h, 0, 0, object.textureRegion.w / 16, object.textureRegion.h / 16);
        ctx.restore();
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function gameloop(timestamp) {
    if (game.timestamp !== undefined) {
        const deltatime = timestamp - game.timestamp;
        onStep(deltatime / 1000.0);

        /*game.accum = Math.min(game.accum + deltatime, 100.0);
        while (game.accum >= 1000.0 / 60.0) {
            onStep(1.0 / 60.0);
            game.accum -= 1000.0 / 60.0;
        }*/
    }
    game.timestamp = timestamp;

    onRender();
    requestAnimationFrame(gameloop);
}

window.addEventListener("keydown", (e) => { input[e.key] = true; onEvent(e); });
window.addEventListener("keyup", (e) => { input[e.key] = false; });
window.addEventListener("blur", (e) => { input = {}; });

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
    resizeCanvas();
    requestAnimationFrame(gameloop);
});
