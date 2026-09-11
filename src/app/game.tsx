"use client";

import { useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update, push, onValue, onChildAdded, onChildRemoved, onDisconnect } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAF7df33ABVrRoHnyXeRAkAqHchsMSDSzk",
  authDomain: "pixel-shmup.firebaseapp.com",
  projectId: "pixel-shmup",
  storageBucket: "pixel-shmup.firebasestorage.app",
  messagingSenderId: "226791231751",
  appId: "1:226791231751:web:cb34c8d4d9478c0a2735a2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const offsetRef = ref(db, ".info/serverTimeOffset");
let offsetVal = 0.0;

onValue(offsetRef, (data) => {
    offsetVal = data.val() || 0.0;
});

let canvas: HTMLCanvasElement | null;
let ctx: CanvasRenderingContext2D | null;

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
        ref: push(ref(db, "players")),
        x: 0, 
        y: 0,
        rotation: 0,
        velocity: 16.0,
        serverRotation: 0.0,
        serverVelocity: 0.0,
        texture: assets.ships,
        textureRegion: { x: 0, y: 0, w: 32, h: 32 },
        time: 0.0,
        updateTime: 0.0
    }
];

onDisconnect(objects[0].ref).remove();

let input = {};

assets.ships.src = "./ships.png";
assets.tiles.src = "./tiles.png";
assets.map.src = "./map.png";

onChildAdded(ref(db, "players"), (data) => {
    if (data.key === objects[0].ref.key) {
        return;
    }

    const objectRef = ref(db, "players/" + data.key);

    let t = data.val().timestamp || 0.0;
    if (t !== 0.0 && offsetVal != null) {
        t = (new Date().getTime() + offsetVal - data.val().timestamp) / 1000.0;
    }
    const x = data.val().serverX + Math.sin(data.val().serverRotation) * data.val().serverVelocity * t;
    const y = data.val().serverY - Math.cos(data.val().serverRotation) * data.val().serverVelocity * t;

    const object = {
        ref: objectRef,
        x: x,
        y: y,
        rotation: data.val().serverRotation,
        velocity: data.val().serverVelocity,
        clientX: x,
        clientY: y,
        clientRotation: data.val().serverRotation,
        clientVelocity: data.val().serverVelocity,
        serverX: x,
        serverY: y,
        serverRotation: data.val().serverRotation,
        serverVelocity: data.val().serverVelocity,
        texture: Object.values(assets).find(asset => asset.src === data.val().texture),
        textureRegion: data.val().textureRegion,
        time: 0.0,
        blend: 1.0
    };
    objects.push(object);

    onValue(objectRef, (data) => {
        if (data.val() !== null) {
            object.clientX = object.x;
            object.clientY = object.y;
            object.clientRotation = object.rotation;
            object.clientVelocity = object.velocity;
            object.serverRotation = data.val().serverRotation;
            object.serverVelocity = data.val().serverVelocity;

            let t = data.val().timestamp || 0.0;
            if (t !== 0.0 && offsetVal != null) {
                t = (new Date().getTime() + offsetVal - data.val().timestamp) / 1000.0;
            }

            object.serverX = data.val().serverX + Math.sin(object.serverRotation) * object.serverVelocity * t;
            object.serverY = data.val().serverY - Math.cos(object.serverRotation) * object.serverVelocity * t;
            object.time = 0.0;
            object.blend = 0.0;
        }
    });
});

onChildRemoved(ref(db, "players"), (data) => {
    for (let i = 0; i < objects.length; i++) {
        if (objects[i].ref.key === data.key) {
            objects.splice(i, 1);
            return;
        }
    }
});

export default function Canvas() {

    useEffect(() => {
        canvas = document.querySelector("canvas");
        ctx = canvas.getContext("2d");

        const object = objects[0];
        let timestamp = 0.0;
        if (offsetVal !== null) {
            timestamp = new Date().getTime() + offsetVal;
        }

        set(object.ref, {
            serverX: object.x, 
            serverY: object.y,
            serverRotation: object.rotation,
            serverVelocity: object.velocity,
            texture: object.texture.src,
            textureRegion: object.textureRegion,
            timestamp: timestamp
        });
    }, []);

    return (
        <canvas></canvas>
    );
}

function lerp(a: number, b: number, t: number) {
    return a * (1.0 - t) + b * t;
}

function boundedLerp(a: number, b: number, t: number, min: number, max: number) {
    let delta = b - a;
    if ((max - min) - Math.abs(delta) < Math.abs(delta)) { delta = ((max - min) - Math.abs(delta)) * Math.sign(-delta); }
    return a + delta * t;
}

function onStep(deltatime: number) {
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

            if (object.updateTime === 0.0 && (object.rotation !== object.serverRotation || object.velocity !== object.serverVelocity)) {
                object.updateTime = 0.1;
                object.serverRotation = object.rotation;
                object.serverVelocity = object.velocity;

                let timestamp = 0.0;
                if (offsetVal !== null) {
                    timestamp = new Date().getTime() + offsetVal;
                }

                update(object.ref, {
                    serverX: object.x, 
                    serverY: object.y,
                    serverRotation: object.rotation,
                    serverVelocity: object.velocity,
                    timestamp: timestamp
                });
            } else if (object.updateTime > 0.0) {
                object.updateTime = Math.max(0.0, object.updateTime - deltatime);
            }

        } else if (object.type === "munition") {
            object.x += Math.sin(object.rotation) * object.velocity * deltatime;
            object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            object.time += deltatime;
            if (object.time < 1.0) {
                newObjects.push(object);
            }
        } else {
            if (object.blend < 1.0) {
                object.time += deltatime;
                object.blend = Math.min(object.blend + deltatime / 0.2, 1.0);
                object.rotation = boundedLerp(object.clientRotation, object.serverRotation, object.blend, -Math.PI, Math.PI);
                object.velocity = lerp(object.clientVelocity, object.serverVelocity, object.blend);
                const clientX = object.clientX + Math.sin(object.rotation) * object.velocity * object.time;
                const clientY = object.clientY - Math.cos(object.rotation) * object.velocity * object.time;
                const serverX = object.serverX + Math.sin(object.serverRotation) * object.serverVelocity * object.time;
                const serverY = object.serverY - Math.cos(object.serverRotation) * object.serverVelocity * object.time;
                object.x = boundedLerp(clientX, serverX, object.blend, 0, assets.map.width / 16.0);
                object.y = boundedLerp(clientY, serverY, object.blend, 0, assets.map.height / 16.0);
            } else {
                object.x += Math.sin(object.rotation) * object.velocity * deltatime;
                object.y -= Math.cos(object.rotation) * object.velocity * deltatime;
            }
            newObjects.push(object);
        }

        while (object.x > assets.map.width / 16.0) { object.x -= assets.map.width / 16.0; }
        while (object.x < 0.0) { object.x += assets.map.width / 16.0; }
        while (object.y > assets.map.height / 16.0) { object.y -= assets.map.height / 16.0; }
        while (object.y < 0.0) { object.y += assets.map.height / 16.0; }
        while (object.rotation > Math.PI) { object.rotation -= Math.PI * 2.0; }
        while (object.rotation < -Math.PI) { object.rotation += Math.PI * 2.0; }
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
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
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
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
}

function gameloop(timestamp: DOMHighResTimeStamp) {
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
