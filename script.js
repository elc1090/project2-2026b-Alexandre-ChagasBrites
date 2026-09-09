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
        texture: assets.ships,
        textureRegion: { x: 0, y: 0, w: 32, h: 32 },
        time: 0.0
    }
];

let input = {};

assets.ships.src = "assets/ships.png";
assets.tiles.src = "assets/tiles.png";
assets.map.src = "assets/map.png";

function onStep(deltatime) {
    const newObjects = [];
    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        let shouldRemove = false;

        if (object.type === "player") {
            const x = (input["ArrowRight"] || 0.0) - (input["ArrowLeft"] || 0.0);
            const y = (input["ArrowUp"] || 0.0) - (input["ArrowDown"] || 0.0);

            object.x += Math.sin(object.rotation) * y * deltatime * 16.0;
            object.y -= Math.cos(object.rotation) * y * deltatime * 16.0;
            object.rotation += x * deltatime * Math.PI;

            if (object.time === 0.0 && (input["z"] || input["Z"])) {
                object.time = 0.1;
                objects.push({
                    type: "munition",
                    x: object.x + Math.sin(object.rotation) * 1.0,
                    y: object.y - Math.cos(object.rotation) * 1.0,
                    rotation: object.rotation,
                    texture: assets.tiles,
                    textureRegion: { x: 0, y: 0, w: 16, h: 16 },
                    time: 0.0
                });
            } else if (object.time > 0.0) {
                object.time = Math.max(0.0, object.time - deltatime);
            }

        } else if (object.type === "munition") {
            object.x += Math.sin(object.rotation) * deltatime * 32.0;
            object.y -= Math.cos(object.rotation) * deltatime * 32.0;
            object.time += deltatime;
            if (object.time >= 1.0) {
                shouldRemove = true;
            }
        }

        if (!shouldRemove) {
            newObjects.push(object);
        }
    }
    objects = newObjects;
}

function onEvent(e) {
    
}

function onRender() {
    ctx.reset();
    ctx.imageSmoothingEnabled = false;
    //ctx.fillStyle = "black";
    //ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(2, 2);
    ctx.filter = "blur(1px)";
    ctx.fillStyle = ctx.createPattern(assets.map, "repeat");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "none";

    ctx.resetTransform();
    ctx.translate(canvas.width * 0.5, canvas.height * 0.5);
    ctx.scale(32, 32);

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

        ctx.translate(object.x, object.y);
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
